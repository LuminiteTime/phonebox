// Claude Code tokens by day (agent/PhoneBox.Agent/Fork/ClaudeTokens.cs), shaped for the week chart.
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** 1234 → "1K", 1_570_000 → "1.6M", 25_000_000 → "25M". */
export const compact = (n) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${n}`;

/** The agent's days (oldest first, today last) → bars: weekday label, share of the busiest day, value text. */
export function tokenDays(week) {
  const top = Math.max(1, ...week.map((d) => d.tokens));
  return week.map((d, i) => ({
    label: WEEKDAYS[new Date(`${d.date}T12:00`).getDay()],
    share: d.tokens / top,
    text: d.tokens ? compact(d.tokens) : '—',
    today: i === week.length - 1,
  }));
}
