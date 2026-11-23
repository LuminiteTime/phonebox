# Форк PhoneBox: дизайн

Личный форк [ersinkoc/phonebox](https://github.com/ersinkoc/phonebox). Задача: превратить планшет (Huawei MatePad,
Wi-Fi) рядом с MacBook в спокойную приборную панель для мониторинга и быстрого управления. Upstream должен
мёржиться без боли.

## Цели

- Пять страниц вместо дефолтных шаблонов: **Система, Claude, Музыка, Деки, Dev**.
- Мониторинг «боковым зрением»: в спокойном состоянии экран почти монохромный, цвет появляется только при нагрузке.
  Пороги: 80% — внимание (янтарь), 90% — критично (ячейка заливается, показывается виновник и действие).
- Лимиты Claude: 5-часовое и недельное окно, у каждого своё время сброса, обратный отсчёт и темп расхода.
- Позже (отдельный этап): Яндекс.Музыка с лайками и волной, GPU по процессам, дайджест статей, OrbStack.

## Не цели

- Не трогаем Android-оболочку, агента и upstream-виджеты, если без этого можно обойтись.
- Не делаем Home-страницу: её роль играет «Система».
- Не поддерживаем старые WebView: если браузер не умеет `oklch()`, панель работает как upstream.

## Антицели

- Шум. Числа, которые перекатываются каждую секунду, мигание, декоративная анимация. Анимация передаёт только
  смену состояния.
- Нейрослоп: градиентный текст, стекло, однотипные карточки, «большая цифра + маленькая подпись» ради красоты.
- Форк, который невозможно обновить.

## Как устроено

### Overlay поверх upstream

Весь код форка лежит в `android/app/src/main/assets/www/overlay/`. В upstream-файлах только точечные правки:

| Файл | Правка |
|---|---|
| `www/index.html` | подключение `overlay/overlay.css` и `overlay/index.js` |
| `agent/PhoneBox.Agent/widgets.json` | описания наших виджетов в конце массива |
| `agent/PhoneBox.Agent/templates.json` | наши шаблоны страниц в конце массива |
| `agent/PhoneBox.Agent/Program.cs`, `Lan.cs` | `AddFork()`, `MapFork()`, `/api/fork` в allow-list |
| `agent/PhoneBox.Agent/settings.html` | `overlay/admin.css` после встроенных стилей |

Каждая страница форка — один виджет на всю сетку 12 × 6 (`x-system`, `x-claude`, …), зарегистрированный в
upstream-реестре `W`. Навигация, свайпы, правила, ночной режим, окно разрешений Claude остаются upstream-овскими;
overlay их перекрашивает и добавляет шапку с вкладками.

Обновление: `git fetch upstream && git merge upstream/main`. Конфликт возможен только в трёх строках выше.

### Данные

Upstream-данные агента (`/api/state`, `/procs`, `/quotas`, `/work`, `/docker`, ярлыки `/run/<id>`, микрофон и
камера из `PrivacyMonitor`) плюс свои эндпоинты форка в `agent/PhoneBox.Agent/Fork/` (отдельный компаньон не
понадобился: форк собирает и обновляет собственный агент):

| Эндпоинт | Что отдаёт |
|---|---|
| `GET /api/fork/gpu` | топ приложений по GPU (время Metal-клиентов из `ioreg`) |
| `GET /api/fork/claude` | токены Claude Code по дням из `~/.claude/projects/**/*.jsonl` |
| `GET /api/fork/dev`, `POST …/open?port=` | dev-серверы (`lsof`: порт, программа, проект) и VPN (`scutil`, маршрут) |
| `GET /api/fork/digest`, `POST …/open?id=` | дайджест Habr / HN / Medium, Medium через проверенное зеркало |
| `GET /api/fork/music`, `POST …/like`, `…/dislike`, `…/wave`, `…/track?id=` | Яндекс Музыка |
| `GET /api/fork/app?have=` | новый APK для самообновления приложения |

Яндекс Музыке нужен OAuth-токен в файле `~/.config/phonebox-fork/yandex-music.token` (права 600). Его можно получить
на `https://oauth.yandex.ru/authorize?response_type=token&client_id=23cabbbdc6cd418abb4b39c32c41195d`
(клиент мобильного приложения Музыки), значение `access_token` из адреса после входа.

Дайджест: Habr (топ дня и недели, сложность «средне» и выше, рейтинг от 15, потоки разработка / администрирование /
AI), главная HN от 150 очков, инженерные блоги на Medium (Netflix, Airbnb, Lyft, Pinterest, Expedia) и Medium-ссылки с
HN. Зеркала обхода пейволла (`freedium-mirror.cfd`, `freedium.cfd`, `readmedium.com`) проверяются раз в 6 часов на
реальной статье: берётся первое, что отдаёт полный текст; если ни одно не работает, ссылка ведёт на оригинал.

### Визуальный язык

Утверждён по прототипам (ветка обсуждения в `.superpowers/brainstorm`):

- Вариант **B «Instrument»**: без карточек, экран поделён волосяными линиями, моно-цифры (Geist Mono), подписи
  капсом, сегментные шкалы.
- Цвет = нагрузка: холодный → зелёный → янтарь → красный. Отдельный цвет только у Claude (терракотовый).
- Спокойная анимация: значения сглажены (EMA), на экране меняются только при сдвиге больше мёртвой зоны; цифры
  перекатываются только при большом скачке. Переходы 0,7–1,4 с, ease-out без пружин. `prefers-reduced-motion`.
- Опасные действия (завершить процесс, остановить контейнер) — удержанием ~0,7 с.

### Библиотеки

Без бандлера, ES-модули как в upstream. Зависимости вендорятся в `overlay/vendor/` (офлайн, APK).

- **NumberFlow** — перекатывание цифр.
- **Lucide** — иконки (только нужные, SVG).
- **Geist / Geist Mono** — шрифты (OFL).
- Анимации и FLIP — нативный Web Animations API: Motion и uPlot из прототипа не нужны, платформа покрывает задачу.
- Спарклайны — upstream-хелпер `sparkLine`.

### Код

- Файлы короткие (ориентир до ~200 строк), одна ответственность на модуль.
- Токены дизайна в одном месте: `overlay/tokens.css`. В компонентах нет «сырых» цветов и длительностей.
- Чистая логика (уровни тревоги, сглаживание, темп квот) отдельно от DOM и покрыта тестами `node --test`.
- Коммиты Conventional Commits: `feat: …`, `fix: …`, `refactor: …`, `docs: …`, `chore: …`.

## Этапы

1. Каркас overlay: токены, шрифты, вендоринг, перекраска оболочки, шапка с вкладками.
2. Страницы Система и Claude на данных агента.
3. Деки (ярлыки агента) и Dev (Docker/OrbStack, локальные серверы).
4. Музыка на данных агента (Now Playing); Яндекс-специфика — этап компаньона.
5. Сборка APK со стабильной подписью, установка на планшет.
6. Свои эндпоинты агента: Яндекс Музыка (REST), GPU по процессам (`ioreg`), дайджест с обходом paywall, dev-серверы,
   VPN, токены Claude. Самообновление агента и приложения из релизов форка.
7. Настройки на Mac в том же виде: `overlay/admin.css` перекрашивает токены страницы настроек.

## Running it

- **The look switches on** when the first page of the config is a fork page (`x-*` widget). A stock layout keeps the
  upstream panel, so upstream UI tests run unchanged.
- **Checks:** `node --test tools/fork/test/*.test.mjs` (pure logic), `python tools/demo-server.py` then
  `node tools/fork/screens.mjs <dir>` (screens of every fork page, fails on page errors), `python3 tools/check-release.py`,
  `npx playwright test` in `tools/ui-tests` (upstream suite).
- **APK:** `tools/fork/build-apk.sh` builds a release APK signed with a stable local key kept in
  `~/.config/phonebox-fork` (back it up). The first install replaces an upstream build, whose signature differs:
  uninstall that one first and pair again.
- **Agent:** the agent embeds `www/overlay/**` for the layout editor's live preview. Fork endpoints live in
  `agent/PhoneBox.Agent/Fork/` under `/api/fork/*` (one line in the USB/Wi-Fi allow-list, `Lan.AllowedOverLan`).

## Updates

1. A push to `main` touching the agent or the app runs `.github/workflows/fork-release.yml`: release
   `v<upstream version>.<run>` with the signed APK and the signed Mac agent (`osx-arm64`), plus `SHA256SUMS`.
   Signing keys are repository secrets; local copies stay in `~/.config/phonebox-fork` (back them up).
2. The agent's updater reads `Updates.Repo` (default `LuminiteTime/phonebox` in the fork), replaces itself and restarts.
3. The app asks the agent every 15 minutes (`GET /api/fork/app?have=<version>`, USB or Wi-Fi) and installs a newer APK
   with PackageInstaller (`SelfUpdate.kt`). Android 12+ installs silently once the app is its own installer of record;
   the first self-update, and older systems, ask once.
4. Merging upstream: `git fetch upstream && git merge upstream/main`, fix the README counts, push. The release follows.
