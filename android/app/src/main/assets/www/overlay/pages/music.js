// "Музыка": the playing track large, tinted by its cover, with its Yandex like and dislike beside it. The upstream media
// card still does the player's work (seek, volume, the agent's media actions); this page lays it out, swaps its small
// cover for Yandex's 800 px one and adds the rating.
import { W } from '../../registry.js';
import { API, D, api, averageColor, haptic, toast } from '../../main.js';
import { cell } from '../lib/ui.js';
import { embed } from '../lib/embed.js';
import { fork, loadMusic, pollMusic } from '../lib/fork.js';
import { yandexRate } from '../cells/yandex.js';

const APPS = { 'yandex-browser': 'Яндекс Браузер', 'com.yandex.music': 'Яндекс Музыка' };

W['x-music'] = {
  needs: [...new Set([...W.media.needs, 'tick'])],
  bare: true,
  create(box) {
    box.classList.add('x-page', 'x-music');
    const media = embed('media', {}, 'x-media');
    const player = media.el;
    const img = player.querySelector('.art');
    const rate = yandexRate(() => api('/media/next', 'POST').catch(() => {}));
    player.append(rate.el);
    box.append(cell('x-player last', player));

    // Yandex's cover when it knows the song, the system's small one otherwise; the cover's colour tints the player
    let song = '', large = '';
    img.addEventListener('load', () => { const c = averageColor(img); if (c) box.style.setProperty('--x-art', c); });
    img.addEventListener('error', () => { if (img.src.endsWith(large)) { large = 'failed'; img.src = `${API}/art?id=${D.state?.media?.artId}`; } });
    const cover = () => {
      const m = D.state?.media;
      const key = m ? `${m.artist}\n${m.title}` : '';
      if (key !== song) { song = key; large = ''; if (key) loadMusic(); } // a new song: its like and cover
      if (!m || !fork.music?.now?.cover || large === 'failed') return; // the agent found the song and its cover
      large = `/fork/music/cover?song=${encodeURIComponent(key)}`;
      if (!img.src.endsWith(large)) img.src = API + large;
    };

    // Next and back take the Mac about a second (nowplaying-cli, then the web player loads the song): the player dims at
    // once until the new song shows. Back restarts a song past its first seconds, as players do; when the player has no
    // previous song (My Wave), the page says so instead of doing nothing.
    const title = () => D.state?.media?.title ?? '';
    let leaving = null;
    for (const b of player.querySelectorAll('[data-media="next"], [data-media="prev"]')) {
      const back = b.dataset.media === 'prev';
      b.addEventListener('click', (e) => {
        const m = D.state?.media;
        if (back && m?.canSeek && m.posMs > 4000) {
          e.stopImmediatePropagation(); // instead of the media card's own handler
          haptic();
          api('/media/seek?ms=0', 'POST').catch(() => {});
          return;
        }
        const from = leaving = title();
        player.classList.add('x-switching');
        setTimeout(() => {
          if (leaving !== from || title() !== from) return;
          leaving = null;
          player.classList.remove('x-switching');
          if (back) toast('Плеер не вернулся назад: в «Моей волне» предыдущего трека нет', 'err');
        }, 4000);
      }, true);
    }

    return {
      update(kind) {
        if (W.media.needs.includes(kind)) media.handle.update?.(kind);
        if (kind === 'state') {
          if (leaving !== null && title() !== leaving) { leaving = null; player.classList.remove('x-switching'); }
          cover();
          const app = player.querySelector('.m-app-name');
          app.textContent = APPS[app.textContent] || app.textContent;
        }
        if (kind === 'tick') { pollMusic(); rate.update(); }
      },
    };
  },
};
