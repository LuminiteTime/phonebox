// "Система": load at a glance. Calm when idle, loud only past 80 / 90 %.
import { W } from '../../registry.js';
import { D, h } from '../../main.js';
import { cpuCell, gpuCell } from '../cells/load.js';
import { diskCell, memoryCell, networkCell } from '../cells/resources.js';
import { procsCell } from '../cells/procs.js';
import { quotaCell, sessionsCell } from '../cells/claude.js';
import { claudeLimits } from '../lib/quota.js';

W['x-system'] = {
  needs: ['state', 'procs', 'quotas', 'work', 'tick'],
  bare: true,
  create(box) {
    box.classList.add('x-page', 'x-system');
    const cpu = cpuCell();
    const gpu = gpuCell();
    const memory = memoryCell();
    const network = networkCell();
    const disk = diskCell();
    const procs = procsCell();
    const session = quotaCell('Claude · 5 ч', () => claudeLimits(D.quotas).session);
    const week = quotaCell('Claude · неделя', () => claudeLimits(D.quotas).week);
    const sessions = sessionsCell();
    memory.el.classList.add('end');
    disk.el.classList.add('end');
    box.append(cpu.el, gpu.el, memory.el, procs.el, network.el, disk.el, h('div', 'x-foot', session.el, week.el, sessions.el));

    const byKind = {
      state: () => {
        const pc = D.state?.pc;
        if (!pc) return;
        for (const c of [cpu, gpu, memory, disk]) c.update(pc);
        network.update(pc, D.state.ping);
      },
      procs: () => procs.update(),
      quotas: () => { session.update(); week.update(); },
      tick: () => { session.update(); week.update(); },
      work: () => sessions.update(),
    };
    return { update: (kind) => byKind[kind]?.() };
  },
};
