// "Музыка": the playing track large, tinted by its cover, with its like and dislike beside it; Yandex Music's wave and
// liked tracks in the column on the right. The upstream media card still does the player's work (seek, volume, the
// agent's media actions); this page lays it out, swaps its small cover for Yandex's 800 px one and adds the rating.
import { W } from '../../registry.js';
import { API, D, api, averageColor, h, haptic, toast } from '../../main.js';
import { cell, icon } from '../lib/ui.js';
import { embed } from '../lib/embed.js';
import { fork, loadMusic } from '../lib/fork.js';
import { yandexCell } from '../cells/yandex.js';

const APPS = { 'yandex-browser': 'Яндекс Браузер', 'com.yandex.music': 'Яндекс Музыка' };

function rateButtons(onDislike) {
  const like = h('button', 'x-rate-btn like', icon('heart'), h('span', null, 'Нравится'));
  const dislike = h('button', 'x-rate-btn', icon('ban'), h('span', null, 'Не то'));
  like.addEventListener('click', async () => {
    haptic();
    like.classList.toggle('on'); // at once; the answer corrects it
    try {
      const r = await api('/fork/music/like', 'POST', 12_000);
      if (fork.music) fork.music.nowLiked = r.liked;
      toast(r.liked ? 'В любимых' : 'Убрал из любимых', 'ok');
      loadMusic();
    } catch (_) { toast(fork.music?.token ? 'Яндекс не принял' : 'Сначала войди в Яндекс', 'err'); }
    paint();
  });
  dislike.addEventListener('click', async () => {
    haptic();
    try { await api('/fork/music/dislike', 'POST', 12_000); onDislike(); toast('Больше не покажу', 'ok'); }
    catch (_) { toast(fork.music?.token ? 'Не нашёл трек у Яндекса' : 'Сначала войди в Яндекс', 'err'); }
  });
  const paint = () => {
    const on = !!fork.music?.nowLiked;
    like.classList.toggle('on', on);
    like.lastChild.textContent = on ? 'В любимых' : 'Нравится';
  };
  return { el: h('div', 'x-rate', like, dislike), paint };
}

W['x-music'] = {
  needs: [...new Set([...W.media.needs, 'tick'])],
  bare: true,
  create(box) {
    box.classList.add('x-page', 'x-music');
    const media = embed('media', {}, 'x-media');
    const player = media.el;
    const img = player.querySelector('.art');
    const rate = rateButtons(() => api('/media/next', 'POST').catch(() => {}));
    player.append(rate.el);
    const yandex = yandexCell();
    const left = cell('x-player last', player);
    box.append(left, yandex.el);

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

    return {
      update(kind) {
        if (W.media.needs.includes(kind)) media.handle.update?.(kind);
        if (kind === 'state') {
          cover();
          const app = player.querySelector('.m-app-name');
          app.textContent = APPS[app.textContent] || app.textContent;
        }
        if (kind === 'tick') { yandex.update(); rate.paint(); }
      },
    };
  },
};
