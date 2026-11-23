// Yandex Music next to the player: rate what is playing, start My Wave, and the newest liked tracks.
// Actions run on the Mac through the agent (agent/PhoneBox.Agent/Fork/YandexMusic.cs).
import { api, h, haptic, toast } from '../../main.js';
import { cell, icon, label } from '../lib/ui.js';
import { fork, openOnMac, pollMusic } from '../lib/fork.js';

const TOKEN_HINT = 'Токен: ~/.config/phonebox-fork/yandex-music.token';

function action(name, text, onTap) {
  const el = h('button', 'x-act', icon(name), h('span', null, text));
  el.addEventListener('click', () => { haptic(); onTap(); });
  return el;
}

async function rate(kind) {
  try { await api(`/fork/music/${kind}`, 'POST', 12_000); toast(kind === 'like' ? 'В любимых' : 'Больше не покажу', 'ok'); }
  catch (_) { toast(fork.music?.token ? 'Яндекс не принял' : TOKEN_HINT, 'err'); }
}

export function yandexCell() {
  const list = h('div', 'x-rows liked');
  const head = label('Яндекс Музыка');
  const actions = h('div', 'x-acts',
    action('heart', 'Нравится', () => rate('like')),
    action('ban', 'Не то', () => rate('dislike')),
    action('activity', 'Моя волна', () => openOnMac('/fork/music/wave')));
  let key = '';
  return {
    el: cell('end last', head, actions, label('Любимые'), list),
    update() {
      pollMusic();
      const m = fork.music;
      const next = JSON.stringify(m ?? null);
      if (next === key) return;
      key = next;
      head.status.textContent = m?.error ? 'нет связи' : '';
      if (!m?.token) { list.replaceChildren(h('div', 'x-empty', m ? TOKEN_HINT : 'Нужен агент форка')); return; }
      list.replaceChildren(...m.liked.map((t) => {
        const row = h('button', 'x-row track', h('span', null, t.title), h('small', null, t.artist));
        row.addEventListener('click', () => { haptic(); openOnMac(`/fork/music/track?id=${encodeURIComponent(t.id)}`); });
        return row;
      }));
    },
  };
}
