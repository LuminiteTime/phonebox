// CPU and GPU cells: smoothed load, heat colour, alert fill and the culprit with an action.
import { D, h, hist, loadProcs, postKill, t, toast } from '../../main.js';
import { cell, label, number } from '../lib/ui.js';
import { historyBars, ticks } from '../lib/meters.js';
import { calm, heat } from '../lib/signal.js';
import { alertState } from '../lib/alert.js';
import { holdButton } from '../lib/motion.js';

const LOAD_CALM = { band: 3, roll: 12 };
const temp = (c) => (c == null ? '' : `${Math.round(c)}°C`);

function loadCell(name, meter) {
  const fill = h('div', 'x-fill');
  const head = label(name);
  const num = number('%');
  const sub = h('div', 'x-sub');
  const who = h('div', 'x-who');
  const el = cell('', fill, head, num, sub, who, meter);
  const alert = alertState(el);
  const smooth = calm(LOAD_CALM);
  /** Returns the smoothed load after showing it. */
  const show = (raw, tempC) => {
    const step = smooth.push(raw);
    if (step) num.set(step.value, step.big);
    const value = smooth.value ?? 0;
    num.style.color = heat(value);
    head.status.textContent = alert.update(value) ?? temp(tempC);
    return value;
  };
  return { el, sub, who, alert, show };
}

const topGroup = () => (D.procs?.groups || []).reduce((top, g) => (!top || g.cpu > top.cpu ? g : top), null);

async function endGroup(g) {
  try {
    const { ok, body } = await postKill('name=' + encodeURIComponent(g.name));
    ok ? toast(t('panel.endedGroup', { killed: body.killed, title: g.title }), 'ok') : toast(body.error || t('panel.couldNotEndThem'), 'err');
  } catch (_) { toast(t('panel.pcUnreachable'), 'err'); }
  setTimeout(loadProcs, 500);
}

export function cpuCell() {
  const bars = historyBars(24);
  const c = loadCell('CPU', bars);
  const culprit = h('span');
  c.who.append(culprit, holdButton('ЗАВЕРШИТЬ', () => { const g = topGroup(); if (g) endGroup(g); }));
  return {
    el: c.el,
    update(pc) {
      c.show(pc.cpu, pc.cpuTemp);
      c.sub.textContent = pc.cpuName || '';
      bars.set(hist.cpu.filter((_, i) => i % 3 === 0));
      const g = topGroup();
      culprit.textContent = g ? `${g.title} ${Math.round(g.cpu)}%` : '';
    },
  };
}

export function gpuCell() {
  const meter = ticks();
  const c = loadCell('GPU', meter);
  const vram = h('span');
  c.who.append(vram);
  return {
    el: c.el,
    update(pc) {
      const g = pc.gpu || {};
      const load = c.show(g.util, g.temp);
      meter.set(load);
      c.sub.textContent = g.vramUsed != null ? `память ${g.vramUsed.toFixed(1)} / ${Math.round(g.vramTotal)}G` : g.name || '';
      vram.textContent = g.temp != null ? `${temp(g.temp)} · ${g.name || ''}` : g.name || '';
    },
  };
}
