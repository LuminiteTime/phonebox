// Rating the playing track in Yandex Music: like (toggles) and dislike (and skip), or signing in first.
// The agent finds the track in the catalog and calls Yandex (agent/PhoneBox.Agent/Fork/YandexMusic.cs).
import { api, h, haptic, toast } from '../../main.js';
import { icon } from '../lib/ui.js';
import { fork, loadMusic } from '../lib/fork.js';

// OAuth Device Flow (agent/PhoneBox.Agent/Fork/YandexAuth.cs): the agent opens Yandex's code page on the Mac, the panel
// shows the code and checks every few seconds until the agent has the token or the code ran out.
async function signIn() {
  try { fork.music = { ...fork.music, login: await api('/fork/music/login', 'POST', 12_000) }; }
  catch (_) { toast('Яндекс не ответил', 'err'); return; }
  const until = Date.now() + 10 * 60_000;
  const wait = setInterval(async () => {
    await loadMusic();
    if (!fork.music?.login || Date.now() > until) clearInterval(wait);
  }, 3000);
}

function button(cls, glyph, text, onClick) {
  const b = h('button', 'x-rate-btn ' + cls, icon(glyph), h('span', null, text));
  b.addEventListener('click', () => { haptic(); onClick(b); });
  return b;
}

/** The rating row; onDislike runs after Yandex took the dislike (the page skips the track). */
export function yandexRate(onDislike) {
  let busy = false;
  const like = button('like', 'heart', 'Нравится', async () => {
    if (busy) return; // one request at a time: the next tap acts on its answer
    busy = true;
    const want = !fork.music.nowLiked;
    fork.music.nowLiked = want; // shown at once; set, not toggled, so a slow answer cannot flip it back
    paint();
    try {
      await api(`/fork/music/like?on=${want}`, 'POST', 12_000);
      toast(want ? 'В любимых' : 'Убрал из любимых', 'ok');
    } catch (_) {
      fork.music.nowLiked = !want;
      toast('Яндекс не принял', 'err');
    }
    busy = false;
    paint();
  });
  const dislike = button('', 'ban', 'Не то', async () => {
    try { await api('/fork/music/dislike', 'POST', 12_000); onDislike(); toast('Больше не покажу', 'ok'); }
    catch (_) { toast('Не нашёл трек у Яндекса', 'err'); }
  });
  const enter = button('', 'log-in', 'Войти в Яндекс, чтобы ставить лайки', signIn);
  const el = h('div', 'x-rate');
  let key = '';
  function paint() {
    const m = fork.music;
    const next = JSON.stringify([m?.token, m?.login?.code, m?.nowLiked, !!m?.now]);
    if (next === key) return;
    key = next;
    if (!m) { el.replaceChildren(); return; } // an upstream agent: no Yandex at all
    if (m.login) { el.replaceChildren(h('div', 'x-code', m.login.code), h('small', 'x-code-hint', `Введи код на ${m.login.url.replace(/^https?:\/\//, '')}: страница открылась на Mac`)); return; }
    if (!m.token) { el.replaceChildren(enter); return; }
    like.classList.toggle('on', !!m.nowLiked);
    like.lastChild.textContent = m.nowLiked ? 'В любимых' : 'Нравится';
    like.disabled = dislike.disabled = !m.now; // the playing song is not in Yandex's catalog
    el.replaceChildren(like, dislike);
  }
  return { el, update: paint };
}
