// The heaviest processes, with a sticky order: rows swap only when one clearly overtakes another.
import { D, h, fmtMem } from '../../main.js';
import { cell, label } from '../lib/ui.js';
import { reorder } from '../lib/motion.js';

const ROWS = 4;
const OVERTAKE = 3; // CPU points a process must lead by before it moves up
const HOT = 30;

/** Previous order kept where the CPU gap is small; new names join at the end. */
export function stickyOrder(prev, groups) {
  const cpu = new Map(groups.map((g) => [g.name, g.cpu]));
  const order = prev.filter((n) => cpu.has(n));
  for (const g of groups) if (!order.includes(g.name)) order.push(g.name);
  for (let pass = 0; pass < order.length; pass++) {
    for (let i = order.length - 1; i > 0; i--) {
      if (cpu.get(order[i]) > cpu.get(order[i - 1]) + OVERTAKE) [order[i - 1], order[i]] = [order[i], order[i - 1]];
    }
  }
  return order;
}

export function procsCell() {
  const list = h('div', 'x-list');
  const rows = new Map();
  let order = [];
  const row = (name) => {
    if (!rows.has(name)) rows.set(name, h('div', null, h('span'), h('span'), h('span')));
    return rows.get(name);
  };
  return {
    el: cell('', label('Топ CPU', '% · RAM'), list),
    update() {
      const groups = [...(D.procs?.groups || [])].sort((a, b) => b.cpu - a.cpu).slice(0, ROWS * 3);
      if (!groups.length) { list.replaceChildren(h('div', 'x-empty', 'ждём данные…')); return; }
      order = stickyOrder(order, groups);
      const byName = new Map(groups.map((g) => [g.name, g]));
      const top = order.slice(0, ROWS).map((name) => {
        const g = byName.get(name);
        const r = row(name);
        const [title, cpu, mem] = r.children;
        title.textContent = g.title;
        cpu.textContent = Math.round(g.cpu);
        mem.textContent = fmtMem(g.memMb).replace(' GB', 'G').replace(' MB', 'M');
        r.classList.toggle('hot', g.cpu >= HOT);
        return r;
      });
      reorder(list, top);
    },
  };
}
