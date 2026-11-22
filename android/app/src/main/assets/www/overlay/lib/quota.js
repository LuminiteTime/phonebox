// Claude usage windows: how much of the window has passed, the pace, and when it resets.

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Share (0–100) of the window that has already passed. */
export function elapsedPct(limit, now = Date.now()) {
  if (!limit?.resetsAt || !limit.windowSec) return null;
  const span = limit.windowSec * 1000;
  return Math.max(0, Math.min(100, 100 - ((limit.resetsAt - now) / span) * 100));
}

/** When the window opened (unix ms). */
export const openedAt = (limit) => limit.resetsAt - limit.windowSec * 1000;

/** Positive: points of headroom against an even pace; negative: ahead of it. */
export function paceGap(limit, now = Date.now()) {
  const elapsed = elapsedPct(limit, now);
  return elapsed == null ? null : Math.round(elapsed - limit.percent);
}

/** "1:41:55" for short spans, "2 д 23 ч" from a day on. */
export function countdown(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (ms >= DAY) return `${Math.floor(s / 86400)} д ${Math.floor((s % 86400) / 3600)} ч`;
  const pad = (n) => String(n).padStart(2, '0');
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** "19:40" today, "пт 14:00" on another day. */
export function clockLabel(ms, now = Date.now()) {
  const d = new Date(ms);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return new Date(now).toDateString() === d.toDateString() ? time : `${WEEKDAYS[d.getDay()]} ${time}`;
}

/** The 5-hour and weekly limits of the Claude provider in a /quotas answer. */
export function claudeLimits(quotas) {
  const limits = quotas?.providers?.find((p) => p.id === 'claude')?.limits || [];
  const byWindow = (sec) => limits.find((l) => l.windowSec === sec) || null;
  return { session: byWindow(5 * 3600), week: byWindow(7 * 86400), plan: quotas?.providers?.find((p) => p.id === 'claude')?.plan };
}
