// The heaviest processes, with a sticky order: rows swap only when one clearly overtakes another.
import { D, h, fmtMem } from '../../main.js';
import { cell, label } from '../lib/ui.js';
import { reorder } from '../lib/motion.js';
import { stickyOrder } from '../lib/order.js';

const ROWS = 4;
const HOT = 30;

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
