// "Музыка": now playing with big touch targets, and Yandex Music beside it. The upstream media card does the
// player's work (art, seek, volume, the agent's media actions); the page gives it the instrument look.
import { W } from '../../registry.js';
import { cell } from '../lib/ui.js';
import { embed } from '../lib/embed.js';
import { yandexCell } from '../cells/yandex.js';

W['x-music'] = {
  needs: [...new Set([...W.media.needs, 'tick'])],
  bare: true,
  create(box) {
    box.classList.add('x-page', 'x-music');
    const media = embed('media', {}, 'x-media');
    const yandex = yandexCell();
    box.append(cell('last', media.el), yandex.el);
    return {
      update(kind) {
        if (W.media.needs.includes(kind)) media.handle.update?.(kind);
        if (kind === 'tick') yandex.update();
      },
    };
  },
};
