// State-change motion on the native Web Animations API: hold-to-confirm and FLIP reordering.
import { h, haptic } from '../../main.js';
import { reducedMotion } from './ui.js';

const HOLD_MS = 700;
const EASE_SOFT = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** A button that acts only after being held for HOLD_MS, so a stray tap cannot end a process. */
export function holdButton(text, onConfirm, cls = 'danger') {
  const progress = h('span', 'x-prog');
  const btn = h('button', `x-btn ${cls}`, progress, text);
  let run = null;
  const reset = () => {
    run?.cancel();
    run = null;
  };
  btn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    reset();
    run = progress.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: HOLD_MS, easing: 'linear' });
    run.onfinish = () => { reset(); haptic(); onConfirm(); };
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, reset);
  return btn;
}

/** Puts nodes into container in the given order and glides each from where it was. */
export function reorder(container, nodes) {
  const before = new Map(nodes.map((n) => [n, n.isConnected ? n.offsetTop : null]));
  for (const child of [...container.children]) if (!nodes.includes(child)) child.remove();
  container.append(...nodes);
  if (reducedMotion()) return;
  for (const n of nodes) {
    const from = before.get(n);
    const dy = from == null ? 0 : from - n.offsetTop;
    if (dy) n.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 700, easing: EASE_SOFT });
  }
}
