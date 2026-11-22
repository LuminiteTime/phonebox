// Claude cells: a usage window with its own reset time and pace, and the coding sessions.
import { D, h } from '../../main.js';
import { cell, label } from '../lib/ui.js';
import { clockLabel, countdown, elapsedPct, paceGap } from '../lib/quota.js';

/** "хватит до сброса" / "впереди темпа на 6 п.п." */
export function paceNote(limit) {
  const gap = paceGap(limit);
  if (gap == null) return '';
  return gap >= 0 ? `запас ${gap} п.п.` : `быстрее темпа на ${-gap} п.п.`;
}

/** The bar with the pace marker; set(limit) fills both. */
export function quotaBar() {
  const fill = h('b');
  const marker = h('em');
  const el = h('div', 'x-qbar', fill, marker);
  el.set = (limit) => {
    fill.style.transform = `scaleX(${Math.min(100, limit.percent) / 100})`;
    marker.style.left = `${elapsedPct(limit) ?? 0}%`;
    el.classList.toggle('over', paceGap(limit) < 0);
  };
  return el;
}

/** Compact window cell for the system page: "Claude · 5 ч   сброс 19:40 · 1:41:55". */
export function quotaCell(title, pick, cls = '') {
  const head = label(title);
  const bar = quotaBar();
  const sub = h('div', 'x-sub');
  return {
    el: cell(`last ${cls}`, head, bar, sub),
    update() {
      const limit = pick();
      if (!limit) { sub.textContent = 'нет данных о лимите'; return; }
      bar.set(limit);
      head.status.textContent = `сброс ${clockLabel(limit.resetsAt)} · ${countdown(limit.resetsAt - Date.now())}`;
      sub.textContent = `${Math.round(limit.percent)}% · ${paceNote(limit)}`;
    },
  };
}

const STATUS = {
  busy: ['ok', 'работает'],
  waiting: ['warn', 'ждёт разрешения'],
  idle: ['', 'простой'],
  shell: ['', 'терминал'],
};

/** Coding sessions: who is working, who waits for an answer (the approval card itself is upstream's). */
export function sessionsCell(max = 3, cls = 'last end') {
  const head = label('Сессии');
  const list = h('div', 'x-ses');
  return {
    el: cell(cls, head, list),
    update() {
      const sessions = D.work?.sessions || [];
      head.status.textContent = String(sessions.length);
      if (!sessions.length) { list.replaceChildren(h('div', 'x-empty', 'нет активных сессий')); return; }
      list.replaceChildren(...sessions.slice(0, max).map((s) => {
        const [tone, word] = STATUS[s.status] || STATUS.idle;
        const since = s.since ? ` · ${Math.max(1, Math.round((Date.now() - s.since) / 60000))} мин` : '';
        return h('div', `x-dot ${tone}`, `${s.project || s.name} · ${word}${since}`);
      }));
    },
  };
}
