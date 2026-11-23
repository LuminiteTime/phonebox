// Fork: the settings page's General section is 26 cards in one column, and pairing the tablet hides in a dialog behind
// a button in the 23rd. This adds sections named after what they are for ("Tablet" first, with pairing up front) that
// show General filtered to their cards, and offers pairing from the header while no tablet is connected. General itself
// still shows everything (upstream's links and tests go there). Cards stay where upstream put them, with their ids and
// handlers, so settings.html stays as upstream wrote it (docs/fork/DESIGN.md, "Settings").
(() => {
  const GROUPS = [
    ['connect', 'Планшет', 'Подключение по Wi-Fi или USB, устройства и обновления.',
      ['s.phones.title', 's.wifi.title', 's.conn.title', 's.updates.title']],
    ['screen', 'Экран', 'Вид панели, ночной режим, переключение страниц и защита экрана.',
      ['#appearanceSettings', '#controlSettings', 's.night.title', 's.display.title', 's.pageSwitch.title', 's.oled.title', 's.kiosk.title', 's.battery.title']],
    ['services', 'Сервисы', 'Откуда виджеты берут данные: погода, календари, ленты, камеры и приложения.',
      ['s.weather.title', 's.calendars.title', 's.feeds.title', 's.photos.title', 's.camera.title', 's.ping.title', 's.ha.title', 's.discord.title', 's.steam.title', 's.obs.title', 's.console.title']],
    ['agents', 'ИИ-агенты', 'Сессии и запросы разрешений Claude, Codex, Cursor и Antigravity, квоты.',
      ['s.approvals.title', 's.quotas.title', 's.cursor.title', 's.antigravity.title']],
  ];
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids); return e; };
  const card = (ref) => (ref[0] === '#' ? document.querySelector(ref) : document.querySelector(`h3[data-i18n="${ref}"]`)?.closest('.card'));

  const general = $('general');
  const nav = $('nav');
  const generalLink = nav.querySelector('a[href="#general"]');
  for (const [id, title, , refs] of GROUPS) {
    for (const ref of refs) { const c = card(ref); if (c) c.dataset.xGroup = id; }
    const link = el('a', null, title);
    link.href = '#' + id;
    generalLink.before(link);
  }
  nav.prepend(nav.querySelector('a[href="#connect"]'));
  nav.querySelector('a[href="#advanced"]').before(nav.querySelector('a[href="#webhooks"]'), generalLink); // the rarely needed last

  // pairing up front: what to do, in order, and the one button that starts it
  const state = el('span', 'x-pair-state');
  const showQr = el('button', 'btn primary', 'Показать QR для подключения');
  showQr.onclick = () => $('lanPair').click();
  const pairCard = el('div', 'card x-pair',
    el('h3', null, 'Подключить планшет'),
    el('ol', 'x-steps',
      el('li', null, 'Нажми кнопку: откроются два QR-кода.'),
      el('li', null, 'Нет приложения на планшете? Отсканируй левый: он скачает APK.'),
      el('li', null, 'Отсканируй правый камерой планшета и подтверди: панель подключится по Wi-Fi.')),
    el('div', 'row', showQr, state));
  general.querySelector('[data-x-group="connect"]').before(pairCard);
  pairCard.dataset.xGroup = 'connect';

  const headerPair = el('button', 'btn primary', 'Подключить планшет');
  headerPair.onclick = () => { location.hash = '#connect'; $('lanPair').click(); };
  $('openPhone').before(headerPair);

  const pill = $('phone');
  pill.style.cursor = 'pointer';
  pill.onclick = () => { location.hash = '#connect'; };
  const sync = () => {
    const on = pill.classList.contains('on');
    headerPair.hidden = on;
    state.textContent = on ? pill.textContent.trim() : 'Планшет не подключён';
    state.classList.toggle('on', on);
  };
  new MutationObserver(sync).observe(pill, { attributes: true, childList: true, subtree: true, characterData: true });
  sync();

  // after upstream's router (registered first): a group shows General with only its cards, under its own heading
  // (upstream's heading and lead are translated in place on every language change, so they are hidden, not rewritten)
  const head = el('h2'), lead = el('p', 'lead');
  const showGroup = () => {
    const group = GROUPS.find(([id]) => '#' + id === location.hash);
    if (group) { general.classList.add('on'); [head.textContent, lead.textContent] = [group[1], group[2]]; general.prepend(head, lead); }
    else { head.remove(); lead.remove(); }
    nav.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === (location.hash || '#pages')));
    general.querySelectorAll(':scope > :is(.card, h2, p.lead)').forEach((e) =>
      e.classList.toggle('x-off', !!group && e !== head && e !== lead && e.dataset.xGroup !== group[0]));
  };
  window.addEventListener('hashchange', showGroup);
  showGroup();
})();
