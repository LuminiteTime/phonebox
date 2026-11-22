// "Музыка": now playing with big touch targets. The upstream media card does the work (art, seek, volume, the
// agent's media actions); the page gives it the whole screen and the instrument look.
// ponytail: likes, My Wave and the liked list need the Yandex Music companion (DESIGN.md, stage 6); added with it.
import { W } from '../../registry.js';
import { cell } from '../lib/ui.js';
import { embed } from '../lib/embed.js';

W['x-music'] = {
  needs: W.media.needs,
  bare: true,
  create(box) {
    box.classList.add('x-page', 'x-music');
    const media = embed('media', {}, 'x-media');
    box.append(cell('end last', media.el));
    return media.handle;
  },
};
