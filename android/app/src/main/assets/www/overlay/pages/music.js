// "Музыка": now playing with big touch targets. The upstream media card does the work (art, seek, volume, the
// agent's media actions); the page gives it the whole screen and the instrument look.
// ponytail: likes, My Wave and the liked list need the Yandex Music companion (DESIGN.md, stage 6); added with it.
import { W } from '../../registry.js';
import { h } from '../../main.js';
import { cell } from '../lib/ui.js';

W['x-music'] = {
  needs: W.media.needs,
  bare: true,
  create(box, ctx) {
    box.classList.add('x-page', 'x-music');
    const card = h('div', 'w-media x-media');
    box.append(cell('end last', card));
    return W.media.create(card, ctx);
  },
};
