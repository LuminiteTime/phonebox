// Alert state of a metric cell: toggles .warn / .crit with hysteresis and remembers since when.
import { level, WARN_AT, CRIT_AT } from './signal.js';

const clock = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function alertState(cellEl) {
  let current = 'ok';
  let since = Date.now();
  return {
    get level() { return current; },
    /** Feeds a smoothed load (0–100); returns the label for the status slot, or null when calm. */
    update(pct) {
      const next = level(pct, current);
      if (next !== current) {
        current = next;
        since = Date.now();
        cellEl.classList.toggle('warn', next === 'warn');
        cellEl.classList.toggle('crit', next === 'crit');
      }
      if (current === 'ok') return null;
      return `> ${current === 'crit' ? CRIT_AT : WARN_AT}% · ${clock(Date.now() - since)}`;
    },
  };
}
