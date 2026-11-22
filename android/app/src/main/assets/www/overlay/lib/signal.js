// Turning raw readings into calm signals: load colour, alert level with hysteresis, smoothed display values.

export const WARN_AT = 80;
export const CRIT_AT = 90;
const HYSTERESIS = 5; // a level is left only this many points below its threshold, so 89 ↔ 91 does not flicker

// [load %, L, C, H] stops of the heat scale: cool slate → green → amber → red
const HEAT_STOPS = [[0, 0.62, 0.03, 250], [45, 0.78, 0.14, 155], [75, 0.83, 0.15, 85], [90, 0.7, 0.19, 32]];

/** The colour of a load (0–100) as an oklch() string. */
export function heat(pct) {
  const p = Math.max(0, Math.min(100, pct));
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const [to, ...b] = HEAT_STOPS[i];
    if (p > to) continue;
    const [from, ...a] = HEAT_STOPS[i - 1];
    const t = (p - from) / (to - from);
    return `oklch(${a.map((v, k) => (v + (b[k] - v) * t).toFixed(3)).join(' ')})`;
  }
  const [, ...last] = HEAT_STOPS.at(-1);
  return `oklch(${last.join(' ')})`;
}

/** 'ok' | 'warn' | 'crit' for a load, remembering the previous level. */
export function level(pct, prev = 'ok') {
  if (pct >= CRIT_AT || (prev === 'crit' && pct >= CRIT_AT - HYSTERESIS)) return 'crit';
  if (pct >= WARN_AT || (prev !== 'ok' && pct >= WARN_AT - HYSTERESIS)) return 'warn';
  return 'ok';
}

/**
 * A reading smoothed with an exponential moving average and shown only when it moves past a dead band.
 * push() returns null while the shown value should stay, else { value, big } where big asks for a visible roll.
 */
export function calm({ band, roll, alpha = 0.3 }) {
  let avg = null;
  let shown = null;
  return {
    get value() { return avg; },
    push(raw) {
      if (raw == null || Number.isNaN(raw)) return null;
      avg = avg == null ? raw : avg + (raw - avg) * alpha;
      const moved = shown == null ? Infinity : Math.abs(avg - shown);
      if (moved < band) return null;
      shown = avg;
      return { value: avg, big: moved >= roll };
    },
  };
}
