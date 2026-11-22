// The fork's catalog entries (agent widgets.json / templates.json, category "Форк") are written in Russian, the
// language of this fork, and stay as written in every interface language. Loaded after i18n.js by the panel and
// the settings page. Keep in step with the x-* entries of those two files.
(() => {
  const I18n = window.PhoneBoxI18n;
  if (!I18n) return;
  const KEPT = [
    'Форк', 'Система', 'Claude', 'Музыка', 'Деки', 'Dev',
    'Нагрузка процессора и видеокарты, память, сеть, диск, тяжёлые процессы и лимиты Claude; спокойно до 80 / 90 %.',
    'Пятичасовое и недельное окна Claude: когда сброс, какой темп, какие сессии.',
    'Текущий трек с крупными кнопками управления.',
    'Клавиши шорткатов из настроек агента с живым состоянием.',
    'Контейнеры, локальные серверы и дайджест статей.',
  ];
  const same = Object.fromEntries(KEPT.map((s) => [s, s]));
  for (const { code } of I18n.LANGUAGES) if (code !== 'en') I18n.CATALOG[code] = { ...I18n.CATALOG[code], ...same };
})();
