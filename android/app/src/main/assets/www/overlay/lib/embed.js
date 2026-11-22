// Runs an upstream widget inside a fork page, so the page reuses its behaviour and only restyles it.
import { W } from '../../registry.js';
import { h } from '../../main.js';

/** { el, handle, needs } for upstream widget `type` with options `o`; el carries the upstream w-<type> class. */
export function embed(type, o = {}, cls = '') {
  const el = h('div', `w-${type} x-embed ${cls}`.trim());
  const handle = W[type].create(el, { o }) || {};
  return { el, handle, needs: W[type].needs || [] };
}

/** Forwards an update to every embedded widget that listens to that kind. */
export const forward = (embeds, kind) => embeds.forEach((e) => e.needs.includes(kind) && e.handle.update?.(kind));
