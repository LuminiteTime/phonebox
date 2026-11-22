// "Claude": both usage windows in full (each with its own reset), the week by day, and the sessions.
import { W } from '../../registry.js';
import { D, h, store } from '../../main.js';
import { cell, label, number } from '../lib/ui.js';
import { claudeLimits, clockLabel, countdown, openedAt, paceGap } from '../lib/quota.js';
import { dailyUsage, remember } from '../lib/week.js';
import { paceNote, quotaBar, sessionsCell } from '../cells/claude.js';

const WEEK_KEY = 'x-week-usage';

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

function weekCell() {
  const chart = h('div', 'x-days');
  return {
    el: cell('last', label('Неделя по дням', '% лимита'), chart),
    update(limit) {
      if (!limit) return;
      const record = remember(store.get(WEEK_KEY, null), limit);
      store.set(WEEK_KEY, record);
      const days = dailyUsage(record, limit);
      const top = Math.max(10, ...days.map((d) => d.pct ?? 0));
      chart.replaceChildren(...days.map((d) => h('div', d.when,
        h('i', null), h('span', null, d.when === 'future' ? '' : d.pct == null ? '—' : `${Math.round(d.pct)}`), h('small', null, d.label))));
      [...chart.children].forEach((col, i) => col.style.setProperty('--v', (days[i].pct ?? 0) / top));
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
    const days = weekCell();
    const sessions = sessionsCell(5);
    box.append(session.el, week.el, days.el, sessions.el);
    const windows = () => { const { plan } = limits(); session.update(plan); week.update(); };
    const byKind = {
      quotas: () => { windows(); days.update(limits().week); },
      tick: windows,
      work: () => sessions.update(),
    };
    return { update: (kind) => byKind[kind]?.() };
  },
};
