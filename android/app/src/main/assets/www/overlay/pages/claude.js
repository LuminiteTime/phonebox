// "Claude": both usage windows in full (each with its own reset), tokens by day, and the sessions.
import { W } from '../../registry.js';
import { D, h } from '../../main.js';
import { cell, label, number } from '../lib/ui.js';
import { claudeLimits, clockLabel, countdown, openedAt, paceGap } from '../lib/quota.js';
import { tokenDays } from '../lib/tokens.js';
import { fork, pollClaude } from '../lib/fork.js';
import { paceNote, quotaBar, sessionsCell } from '../cells/claude.js';

function metaRow(name) {
  const value = h('dd');
  return { nodes: [h('dt', null, name), value], value };
}

function windowCell(title, pick, cls = '') {
  const head = label(title);
  const num = number('%');
  const bar = quotaBar();
  const reset = metaRow('Сброс');
  const opened = metaRow('Открыто');
  const pace = metaRow('Темп');
  num.classList.add('x-big');
  const meta = h('dl', 'x-meta', ...reset.nodes, ...opened.nodes, ...pace.nodes);
  let lastPct = null;
  return {
    el: cell(cls, head, num, bar, meta),
    update(plan) {
      const limit = pick();
      head.status.textContent = plan || '';
      if (!limit) { reset.value.textContent = 'нет данных'; return; }
      if (limit.percent !== lastPct) { num.set(limit.percent, true); lastPct = limit.percent; }
      bar.set(limit);
      reset.value.replaceChildren(h('b', null, clockLabel(limit.resetsAt)), ` · через ${countdown(limit.resetsAt - Date.now())}`);
      opened.value.textContent = clockLabel(openedAt(limit));
      pace.value.textContent = paceNote(limit);
      pace.value.className = paceGap(limit) < 0 ? 'warn' : 'good';
    },
  };
}

/** Claude Code tokens of the last seven days, from the session logs on the Mac. */
function tokensCell() {
  const chart = h('div', 'x-days');
  const head = label('Токены по дням', '');
  let key = '';
  return {
    el: cell('last', head, chart),
    update() {
      pollClaude();
      const week = fork.claude?.week;
      if (!week?.length || JSON.stringify(week) === key) return;
      key = JSON.stringify(week);
      const days = tokenDays(week);
      head.status.textContent = `сегодня ${days.at(-1).text}`;
      chart.replaceChildren(...days.map((d) => h('div', d.today ? 'today' : '', h('i', null), h('span', null, d.text), h('small', null, d.label))));
      [...chart.children].forEach((col, i) => col.style.setProperty('--v', days[i].share));
    },
  };
}

W['x-claude'] = {
  needs: ['quotas', 'work', 'tick'],
  bare: true,
  create(box) {
    box.classList.add('x-page', 'x-claude');
    const limits = () => claudeLimits(D.quotas);
    const session = windowCell('Окно 5 часов', () => limits().session);
    const week = windowCell('Неделя · все модели', () => limits().week, 'end');
    const days = tokensCell();
    const sessions = sessionsCell(5);
    box.append(session.el, week.el, days.el, sessions.el);
    const windows = () => { const { plan } = limits(); session.update(plan); week.update(); };
    const byKind = {
      quotas: windows,
      tick: () => { windows(); days.update(); },
      work: () => sessions.update(),
    };
    return { update: (kind) => byKind[kind]?.() };
  },
};
