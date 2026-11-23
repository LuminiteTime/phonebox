// Dev page cells: local servers and the reading digest; a tap opens the item in the Mac's browser.
import { ago, h, haptic, store } from '../../main.js';
import { cell, label } from '../lib/ui.js';
import { fork, openOnMac, pollDev, pollDigest } from '../lib/fork.js';

const READ_KEY = 'x-digest-read', READ_MAX = 300;

function row(cls, kids, onTap) {
  const el = h('button', `x-row ${cls}`.trim(), ...kids);
  el.addEventListener('click', () => { haptic(); onTap(); });
  return el;
}

export function serversCell() {
  const list = h('div', 'x-rows');
  const head = label('Серверы');
  let key = '';
  return {
    el: cell('last', head, list),
    update() {
      pollDev();
      const servers = fork.dev?.servers;
      const next = JSON.stringify(servers ?? null);
      if (next === key) return;
      key = next;
      head.status.textContent = servers ? `${servers.length}` : '';
      if (!servers?.length) { list.replaceChildren(h('div', 'x-empty', servers ? 'Ничего не запущено' : 'Нужен агент форка')); return; }
      list.replaceChildren(...servers.map((s) => row('srv', [h('b', null, `:${s.port}`), h('span', null, s.project || '—'), h('small', null, s.program)],
        () => openOnMac(`/fork/dev/open?port=${s.port}`))));
    },
  };
}

export function digestCell() {
  const list = h('div', 'x-rows digest');
  const head = label('Дайджест');
  let key = '';
  const read = () => new Set(store.get(READ_KEY, []));
  const markRead = (id) => store.set(READ_KEY, [...read(), id].slice(-READ_MAX));
  const render = () => {
    const items = fork.digest?.items;
    const seen = read();
    const next = JSON.stringify([items?.map((i) => i.id + (seen.has(i.id) ? '.' : '')), Math.floor(Date.now() / 60_000)]);
    if (next === key) return;
    key = next;
    head.status.textContent = fork.digest ? (fork.digest.mirror ? 'medium · зеркало ок' : 'medium · без зеркала') : '';
    if (!items?.length) { list.replaceChildren(h('div', 'x-empty', fork.digest ? 'Пока пусто' : 'Нужен агент форка')); return; }
    const top = list.scrollTop;
    list.replaceChildren(...items.map((i) => row(`art ${seen.has(i.id) ? 'read' : ''}`, [
      h('i', `src ${i.source.toLowerCase()}`, i.source),
      h('span', null, i.title),
      h('small', null, [i.meta, i.published ? ago(i.published) : ''].filter(Boolean).join(' · ')),
    ], async () => { if (await openOnMac(`/fork/digest/open?id=${encodeURIComponent(i.id)}`)) { markRead(i.id); render(); } })));
    list.scrollTop = top;
  };
  return { el: cell('end last', head, list), update() { pollDigest(); render(); } };
}
