// Yandex Music next to the player: My Wave and the newest liked tracks (the playing one marked). Rating the playing
// track sits with the player (pages/music.js).
// Actions run on the Mac through the agent (agent/PhoneBox.Agent/Fork/YandexMusic.cs).
import { api, h, haptic, toast } from '../../main.js';
import { cell, icon, label } from '../lib/ui.js';
import { fork, loadMusic, openOnMac, pollMusic } from '../lib/fork.js';


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

function signInView(login) {
  if (login) return [h('div', 'x-code', login.code), h('div', 'x-empty', `Открыл ${login.url.replace(/^https?:\/\//, '')} на Mac: введи там этот код`)];
  const row = h('button', 'x-row track', h('span', null, 'Войти в Яндекс'), h('small', null, 'по коду, один раз'));
  row.addEventListener('click', () => { haptic(); signIn(); });
  return [row];
}

export function yandexCell() {
  const list = h('div', 'x-rows liked');
  const head = label('Яндекс Музыка');
  const wave = h('button', 'x-wave', icon('activity'), h('span', null, h('b', null, 'Моя волна'), h('small', null, 'откроется на Mac')));
  wave.addEventListener('click', () => { haptic(); openOnMac('/fork/music/wave'); });
  let key = '';
  return {
    el: cell('end last', head, wave, label('Любимые'), list),
    update() {
      pollMusic();
      const m = fork.music;
      const next = JSON.stringify(m ?? null);
      if (next === key) return;
      key = next;
      head.status.textContent = m?.error ? 'нет связи' : '';
      if (!m) { list.replaceChildren(h('div', 'x-empty', 'Нужен агент форка')); return; }
      if (!m.token) { list.replaceChildren(...signInView(m.login)); return; }
      list.replaceChildren(...m.liked.map((t) => {
        const row = h('button', 'x-row track' + (t.id === m.now?.id ? ' now' : ''), h('span', null, t.title), h('small', null, t.artist));
        row.addEventListener('click', () => { haptic(); openOnMac(`/fork/music/track?id=${encodeURIComponent(t.id)}&album=${encodeURIComponent(t.album)}`); });
        return row;
      }));
    },
  };
}
