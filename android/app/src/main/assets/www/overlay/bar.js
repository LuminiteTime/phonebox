// The top bar: host, uptime and one tab per page. Swipes, volume keys and rules still move the upstream pager;
// the bar follows it and jumps it on tap. On the right of the host: VPN, and the microphone and camera while in use.
import { D, curPage, goPage, h, pager, pages } from '../main.js';
import { icon } from './lib/ui.js';
import { fork, pollDev } from './lib/fork.js';

const REFRESH_MS = 1000;

const uptime = (sec) => {
  if (!sec) return '';
  const d = Math.floor(sec / 86400);
  const hrs = Math.floor((sec % 86400) / 3600);
  return d ? `up ${d} д ${hrs} ч` : `up ${hrs} ч ${Math.floor((sec % 3600) / 60)} м`;
};

const waitingForYou = () => (D.work?.sessions || []).some((s) => s.status === 'waiting');
const isClaudePage = (p) => p.widgets.some((w) => w.type === 'x-claude' || w.type === 'sessions');
const isForkPage = (p) => p.widgets.some((w) => w.type.startsWith('x-'));

/** VPN, microphone and camera chips; the microphone and camera only while an app uses them. */
function liveChips() {
  const vpn = h('span', 'x-chip', icon('shield-check'), h('span'));
  const mic = h('span', 'x-chip crit', icon('mic'), 'МИК');
  const cam = h('span', 'x-chip crit', icon('video'), 'КАМЕРА');
  const el = h('span', 'x-live', vpn, mic, cam);
  return {
    el,
    update() {
      pollDev();
      const v = fork.dev?.vpn;
      vpn.hidden = !v;
      vpn.classList.toggle('ok', !!v?.on);
      vpn.lastChild.textContent = v?.on ? `VPN ${v.name || ''}`.trim() : 'без VPN';
      mic.hidden = !D.state?.privacy?.mic;
      cam.hidden = !D.state?.privacy?.camera;
    },
  };
}

export function mountBar() {
  const host = h('span', 'host');
  const up = h('span');
  const nav = h('nav');
  const live = liveChips();
  const bar = h('header', null, host, up, live.el, nav);
  bar.id = 'x-bar';
  document.body.prepend(bar);
  let titles = '';

  const renderTabs = () => {
    const next = pages.map((p) => p.title).join('\n');
    if (next === titles) return;
    titles = next;
    nav.replaceChildren(...pages.map((p, i) => {
      const tab = h('button', null, p.title);
      tab.addEventListener('click', () => goPage(i, Math.abs(i - curPage) > 1));
      return tab;
    }));
  };
  const markCurrent = () => [...nav.children].forEach((tab, i) => tab.classList.toggle('on', i === curPage));
  const refresh = () => {
    document.documentElement.classList.toggle('x-on', !!pages[0] && isForkPage(pages[0]));
    renderTabs();
    markCurrent();
    host.textContent = D.state?.host || '';
    up.textContent = uptime(D.state?.pc?.uptimeSec);
    live.update();
    const flag = waitingForYou();
    pages.forEach((p, i) => nav.children[i]?.classList.toggle('flag', flag && isClaudePage(p)));
  };

  pager.addEventListener('scroll', markCurrent, { passive: true });
  setInterval(refresh, REFRESH_MS);
  refresh();
}
