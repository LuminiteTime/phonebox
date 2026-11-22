// Load meters: a segmented bar for one value and history bars for recent values.
import { h } from '../../main.js';
import { heat } from './signal.js';

const SEGMENTS = 40;

/** 40 segments, each lit in the heat colour of its own position. */
export function ticks() {
  const el = h('div', 'x-ticks');
  for (let i = 0; i < SEGMENTS; i++) {
    const seg = h('i');
    seg.style.setProperty('--h', heat((i / (SEGMENTS - 1)) * 100));
    el.append(seg);
  }
  el.set = (pct) => {
    const lit = Math.round((Math.max(0, Math.min(100, pct)) / 100) * SEGMENTS);
    [...el.children].forEach((seg, i) => seg.classList.toggle('on', i < lit));
  };
  return el;
}

/** One bar per recent value (0–100), coloured by its own load. */
export function historyBars(count) {
  const el = h('div', 'x-bars');
  for (let i = 0; i < count; i++) el.append(h('i'));
  el.set = (values) => {
    const recent = values.slice(-count);
    [...el.children].forEach((bar, i) => {
      const v = recent[i - (count - recent.length)] ?? 0;
      bar.style.transform = `scaleY(${Math.max(0.03, v / 100)})`;
      bar.style.background = heat(v);
    });
  };
  return el;
}
