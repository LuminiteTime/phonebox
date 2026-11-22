// Small DOM building blocks shared by the fork's pages.
import { h } from '../../main.js';
import * as Lib from '../vendor/libs.js';

Lib.define('number-flow', Lib.NumberFlowLite);

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A grid cell of a page. */
export const cell = (cls, ...kids) => h('section', `x-cell ${cls || ''}`.trim(), ...kids);

/** The small caps label row of a cell; .st is the right-hand status slot. */
export function label(left, right = '') {
  const status = h('span', 'st', right);
  const row = h('div', 'x-lb', h('span', null, left), status);
  row.status = status;
  return row;
}

const pascal = (name) => name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());

/** A Lucide icon by its kebab-case name (see tools/fork/icons.list); null when it is not bundled. */
export function icon(name) {
  const node = Lib[pascal(name || '')];
  return node ? Lib.createElement(node) : null;
}

const FORMATS = {
  int: new Intl.NumberFormat('en', { maximumFractionDigits: 0 }),
  one: new Intl.NumberFormat('en', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
};

/** A big number that rolls its digits only when asked (calm() decides when). */
export function number(unit = '', { format = 'int', size = '' } = {}) {
  const flow = document.createElement('number-flow');
  const unitEl = h('small', null, unit);
  const el = h('div', `x-num ${size}`.trim(), flow, unitEl);
  el.set = (value, roll = false) => {
    flow.animated = roll && !reducedMotion();
    flow.data = Lib.formatToData(value, FORMATS[format]);
  };
  el.unit = (text) => { unitEl.textContent = text; };
  return el;
}
