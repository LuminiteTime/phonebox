// "Деки": the shortcut keys from Settings › Shortcuts. Upstream keys keep their behaviour (toggles, cycles, long press,
// uploaded icons); the page lays them out as one instrument grid. An icon written as "lucide:name" draws that icon.
import { W } from '../../registry.js';
import { cfg, h, keyButton } from '../../main.js';
import { applyToggles } from '../../widgets/basic.js';
import { cell, icon } from '../lib/ui.js';

const LUCIDE = 'lucide:';

function key(s) {
  const btn = keyButton(s);
  const glyph = String(s.icon || '').startsWith(LUCIDE) && icon(s.icon.slice(LUCIDE.length));
  if (glyph) btn.querySelector('.k-icon').replaceChildren(glyph);
  return btn;
}

W['x-deck'] = {
  needs: ['state'],
  bare: true,
  create(box) {
    box.classList.add('x-page', 'x-deck');
    const all = cfg.shortcuts || [];
    const grid = h('div', 'x-keys', ...all.map(key));
    const body = all.length ? grid : h('div', 'x-empty', 'Нет шорткатов: добавьте их в настройках агента › Shortcuts');
    box.append(cell('end last', body));
    return { update: () => applyToggles(box) };
  },
};
