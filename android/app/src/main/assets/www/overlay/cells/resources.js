// Memory, network and disk cells: quieter readings without alerts.
import { h, hist, fmtRate } from '../../main.js';
import { sparkLine } from '../../widgets/helpers.js';
import { cell, label, number } from '../lib/ui.js';
import { ticks } from '../lib/meters.js';
import { calm, heat } from '../lib/signal.js';

const MEMORY_TIGHT = 88; // % of RAM where the number turns warm

export function memoryCell() {
  const num = number('', { format: 'one' });
  const sub = h('div', 'x-sub');
  const meter = ticks();
  const smooth = calm({ band: 0.4, roll: 2 });
  return {
    el: cell('', label('Память'), num, sub, meter),
    update(pc) {
      const step = smooth.push(pc.ramUsedGb);
      if (step) num.set(step.value, step.big);
      num.unit(`/${Math.round(pc.ramTotalGb)}G`);
      const pct = (pc.ramUsedGb / pc.ramTotalGb) * 100;
      num.style.color = pct >= MEMORY_TIGHT ? heat(pct) : '';
      sub.textContent = `свободно ${(pc.ramTotalGb - pc.ramUsedGb).toFixed(1)}G`;
      meter.set(pct);
    },
  };
}

export function networkCell() {
  const head = label('Сеть');
  const num = number('MB/s ↓', { format: 'one', size: 's' });
  const sub = h('div', 'x-sub');
  const canvas = h('canvas', 'x-spark');
  const smooth = calm({ band: 0.3, roll: 3, alpha: 0.5 });
  return {
    el: cell('', head, num, sub, canvas),
    update(pc, ping) {
      const step = smooth.push((pc.netDownBps || 0) / 1e6);
      if (step) num.set(step.value, step.big);
      sub.textContent = `${fmtRate(pc.netUpBps).join(' ')} ↑`;
      head.status.textContent = ping?.ms != null ? `${Math.round(ping.ms)} ms` : '';
      sparkLine(canvas, hist.down, getComputedStyle(canvas).color);
    },
  };
}

export function diskCell() {
  const num = number('G free', { size: 's' });
  const sub = h('div', 'x-sub');
  const meter = ticks();
  return {
    el: cell('', label('Диск'), num, sub, meter),
    update(pc) {
      const d = pc.disks?.[0];
      if (!d) return;
      num.set(d.totalGb - d.usedGb);
      sub.textContent = `${Math.round(d.usedGb)} / ${Math.round(d.totalGb)}G`;
      meter.set((d.usedGb / d.totalGb) * 100);
    },
  };
}
