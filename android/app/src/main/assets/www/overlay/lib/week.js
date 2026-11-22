// Weekly usage by day. The agent only knows the current percentage, so the panel remembers, per day of the current
// weekly window, the first and the last percentage it saw. A new window (another reset time) starts a fresh record.

const DAY = 86400_000;
const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Adds one reading of the weekly limit to the record and returns the new record. */
export function remember(record, limit, now = Date.now()) {
  const fresh = !record || record.resetsAt !== limit.resetsAt;
  const days = fresh ? {} : { ...record.days };
  const key = dayKey(now);
  const seen = days[key];
  days[key] = { first: seen ? seen.first : limit.percent, last: limit.percent };
  return { resetsAt: limit.resetsAt, days };
}

/** Seven days of the window: { label, pct, when: 'past' | 'today' | 'future' }; pct is the share used that day,
 *  null for a day the panel did not see. */
export function dailyUsage(record, limit, now = Date.now(), weekdays = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']) {
  const start = limit.resetsAt - limit.windowSec * 1000;
  const today = dayKey(now);
  let previous = null;
  return Array.from({ length: 7 }, (_, i) => {
    const at = start + i * DAY;
    const key = dayKey(at);
    const seen = record?.days?.[key];
    const base = previous ?? seen?.first ?? 0;
    const pct = seen ? Math.max(0, seen.last - base) : null;
    if (seen) previous = seen.last;
    const when = key === today ? 'today' : at > now ? 'future' : 'past';
    return { label: weekdays[new Date(at).getDay()], pct, when };
  });
}
