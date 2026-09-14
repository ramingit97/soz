# Söz — сессия 2026-09-14: разбор плана редизайна, батч B0

> Читать вместе с `PLAN-REDESIGN-2026-09-13.md` (план и уточнения владельца в его
> начале) и `STATUS.md`. Эта сессия проверила план другой сессии по коду, получила
> от владельца решения по спорным местам и сделала батч B0 (фундамент дизайн-системы).

---

## Состояние на конец сессии

**B0 закоммичен владельцем в `762465c` («ui ux problmes») и запушен в
`origin/main`, но через EAS Update НЕ опубликован** — на телефонах старый UI.
Все проверки из плана пройдены (ниже). Этот handoff и правки `STATUS.md` /
`README.md` / плана пришли после коммита — их ещё нужно закоммитить.

Позже в той же сессии сделаны (в рабочей копии, **не закоммичены**): исправление
тура, веб-оболочка `+html.tsx`, имя Bobo/Бобо, онбординг B2 и серверная часть
(персонаж по возрасту, `moreListening`) — раздел «B2» ниже.

API выложен на Fly (версия 3, 2026-09-14) — **из рабочей копии, код сервера не
в git**. Затем сделан B3 (главный экран).

Открытый вопрос владельцу: коммит всего (сервер уже в проде — его код должен
попасть в git) и `eas update --branch preview` — тестировщики получат B0 + B2 +
B3 со второго запуска приложения.

Первое действие следующей сессии: `git status` (в `babel.config.js` не должно
быть правки `unstable_transformImportMeta` — см. ловушку 7), затем спросить про
публикацию, если владелец не ответил.

---

## Решения владельца (2026-09-14)

Записаны в начало `PLAN-REDESIGN-2026-09-13.md` как «Уточнения владельца», при
расхождении с текстом плана действуют они. Коротко:

| Вопрос | Решение |
|---|---|
| Согласие перед пробным уроком | **одна галочка на всё** (родитель + данные + голос) на экране «Для кого», гостевой аккаунт создаётся только после неё |
| Где выбирать цвет Хани | **в `pet-room`**, в карточке «Хани хочет познакомиться» вместе с именем; до этого мёд (55) |
| Бриф дизайнеру `DESIGN-BRIEF-2026-09-13.md` | **не отправлять**, работать по токенам плана |
| Шрифт заголовков kid (5–10) | **Nunito 900 Black** |
| Шрифт заголовков teen (11+ и взрослые) | **Onest 700** (кнопки teen — Onest 600) |

Шрифты выбраны по картинке-сравнению: Fredoka и Fraunces показали квадраты вместо
кириллицы. Остальные кандидаты с полным покрытием RU+AZ: Comfortaa, Balsamiq Sans
(kid), Literata, Lora (teen). Rubik и Manrope отпали — нет `ə` / `Ə`.

Сужение B0 (моё предложение, в плане пункт 6 уточнений): `Input` и `StepIndicator`
делаются в B2, `ScreenHeader` в B4, `LessonProgress` в B5.

---

## Что проверено в плане по коду

Подтвердилось: гостевой вход недостижим (`building.tsx:101` вызывает
`ensureGuestSession`, но туда попадают только с токеном — `schedule.tsx:69`;
«Попробовать без аккаунта» в `consent.tsx:229` уводит на `/home` без токена),
гейт микрофона `talk.tsx:415`, 4 импортёра `Button`, 81 `<HBCard`, `HBScreenHeader`
без использований, 25 из 58 `HBPet` без `hue`, `home.tsx` 1725 строк, 137 сырых
`fontSize`, 170 `textAlign: 'center'`, лимит `/auth/guest` 5 в час на IP
(`auth.ts:86`, ключ по `x-forwarded-for`), схема `POST /children` принимает всё
нужное.

Расхождения с планом (мелкие): `depth="deep"` 13, а не 16; «Не отличаются от фона»
подтверждено контрастом — `card` на `bg` 1.1, `card` на белом 1.03.

---

## Что сделано в B0

| Файл | Изменение |
|---|---|
| `src/theme/mode.ts` (новый) | `uiModeFor(profileType, childAge, childAgeRange)` — чистый модуль без RN, для `node --test`. Порядок: adult → teen; есть возраст → `≤ 10` kid; есть диапазон → по нему; ничего нет → kid |
| `src/theme/mode.test.mts` (новый) | 6 тестов, все сочетания |
| `src/theme/modeTokens.ts` (новый) | `MODE_TOKENS` (шрифты, размеры заголовков, радиус кнопки/карточки, тень карточки, маскот, плотность, виньетка, толщина иконок) и `makeModeStyles(build)` |
| `src/hooks/useUIMode.tsx` (новый) | `useUIMode()` читает стор одним селектором; `UIModeProvider force="teen"` — оборачивать экран родительской зоны. **Корневого провайдера нет** (не нужен) |
| `src/hooks/useTheme.ts` (новый) | `{ mode, t, accent, compact }`, маскот ×0.75 на коротком экране |
| `src/components/Icon.tsx` (новый) | закрытая карта из 57 иконок Lucide, импорт по одной через `lucide-react-native/icons/<имя>` |
| `src/theme/colors.ts` | `surface #FFFFFF`, `surfaceBorder #EDE4CF` |
| `src/theme/spacing.ts` | `shadow.card` (0/4, 0.08, r12, elevation 2) |
| `src/theme/typography.ts` | `display` → `Nunito_900Black`, `displaySemi` → `Nunito_800ExtraBold`, новые `teenDisplay`/`teenDisplaySemi` (Onest). Меняет вид всех 156 мест с `fontFamily.display*` |
| `src/theme/accent.ts` | у `Accent` новое поле `ink` — акцент для иконок и подписей на белом, ≥ 5:1 |
| `Text.tsx` | `hero/title/headline` по режиму (kid 4xl/3xl/2xl, teen 3xl/2xl/xl — меньше прежних); тона `brand`, `danger`, `success`, `onAccent`; `bobo` помечен устаревшим |
| `HBButton.tsx` | `icon`, `iconRight`, `loading`, видимый `disabled` (0.45), `style`; радиус и шрифт из режима; `ghost` теперь `inkSoft`; `soft` белый с рамкой |
| `Button.tsx` | удалён; `welcome`, `tour`, `learning-languages` на `HBButton full`, в `review` был лишний импорт |
| `HBCard.tsx` | белая, рамка 1 px только без `bg`/`ringColor`, `rim` по умолчанию выкл., радиус/тень/padding из режима |
| `HBChip.tsx` | рамка 1 px |
| `HBIconBox.tsx` | `icon` + `iconColor`, цвет иконки — тёмный оттенок подложки |
| `HBBackButton.tsx` | Lucide `chevron-left`, белый с рамкой; проп `glyph` заменён на `icon` (glyph нигде не передавался) |
| `BottomTabs.tsx` | Lucide `house / message-circle / chart-column / user`, активная — `accent.ink`; пилюля `accent.soft` только у kid |
| `PaperBackground.tsx` | виньетка только у kid |
| `Screen.tsx` | `scroll` по умолчанию `true`; явный `scroll={false}` в `tour.tsx`, `setup/name.tsx` |
| `app/_layout.tsx` | шрифты через `expo-font` по одному файлу (7 штук); при ошибке загрузки рисует системным, а не пустой экран |
| `app/paywall.tsx` | невыбранная карточка тарифа без `bg={colors.card}` → белая с рамкой |
| `scripts/check-ui.mjs` + `ui-baseline.json` (новые) | счётчик UI-долга, `--check` / `--update` / `--files` |
| `package.json` | + `lucide-react-native`, `@expo-google-fonts/onest`; − `fredoka`, `fraunces` |
| `RELEASE.md` | ловушка отпечатка и `scripts` (ниже) |

Базовая линия `check-ui` на B0: `rawFontSize 137`, `textAlignCenter 170`,
`emojiOnlyText 90`, `deepShadow 13`, `bobo 19`, `alert 10`, `paddingTopLarge 27`,
`modeBranch 1` (`BottomTabs`).

---

## Проверки B0

| Проверка | Результат |
|---|---|
| `corepack pnpm typecheck` | 4 пакета чистые |
| `corepack pnpm test` | 86/86: shared-types 17, mobile 15 (+6), api 54 |
| `expo export --platform android` | собирается; `.hbc` 8 287 718 байт против 8 246 138 до B0 (+41 КБ — иконки не тянут всю библиотеку) |
| ассеты в бандле | 52 → 38, из них шрифтов 21 → 7; `dist` 11 → 9 МБ |
| `soz-api.fly.dev` / `localhost:3000` в бандле | 1 / 0 |
| отпечаток `fingerprint:generate --platform android` | `1a02f26809db28d65c05866f86f7c217a7b57f52` — совпадает со сборкой `f3eb38b0` |
| `node scripts/check-ui.mjs --check` | ОК |
| скриншоты в headless Chrome 320×712 | welcome, profile-type, home kid/teen/AZ, talk, paywall, progress, learning-languages kid/teen, topics, memory — рендерятся, режимы переключаются |

**На устройстве не проверено ничего.** Скриншоты для владельца по плану B0:
home, talk, profile-type, paywall, parent-summary — контраст карточек, чипы на
белом, иконки вкладок.

---

## Найденные ловушки

1. **Шрифты без нужных букв.** Fredoka (был шрифт заголовков): нет кириллицы, нет
   `ə ğ ş`. Fraunces: нет кириллицы. Android молча подставлял системный шрифт.
   Проверка любого нового шрифта описана в комментарии `typography.ts`
   (`fc-query --format='%{charset}\n' Font.ttf`, искать `400-45f`, `259`, `18f`).
2. **`scripts` в `apps/mobile/package.json` входят в отпечаток** (источник
   `packageJson:scripts`). Добавленная строка `check-ui` сдвинула runtime на
   `8a6194c1…` — установленные сборки перестали бы принимать обновления. Строку
   убрал, записал в `RELEASE.md` и в заголовок `check-ui.mjs`. JS-зависимости без
   нативного кода отпечаток не меняют.
3. **Корень пакетов `@expo-google-fonts/*` тянет все начертания** (`index.js`
   делает `require` на каждое, с курсивами). Подключать файлом:
   `require('@expo-google-fonts/nunito/Nunito_900Black.ttf')`,
   у Onest — `@expo-google-fonts/onest/700Bold/Onest_700Bold.ttf`.
4. **Lucide из корня пакета тянет ~1600 иконок** — Metro не вырезает. Только
   `lucide-react-native/icons/<имя>` (разрешено полем `exports` пакета).
5. **Тест `.mts` не видит именованные экспорты `.ts` при статическом импорте** —
   tsx собирает `.ts` в CommonJS. Импортировать динамически, как в
   `progressQueue.test.mts`: `const { x } = await import('./mode.js')`.
6. **На этой машине нет `strings`** (binutils). Проверка бандла из плана:
   `grep -ao soz-api.fly.dev dist/_expo/static/js/android/*.hbc | wc -l`.
7. **Веб-версия приложения не запускается** без правки: `zustand/middleware`
   использует `import.meta`, Metro-web падает с «Cannot use 'import.meta' outside
   a module». Для скриншотов временно ставил в `babel.config.js`
   `presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]]` и
   потом вернул. Android не затронут. Постоянно не включал — вне редизайна.
8. `pkill -f "<шаблон>"` из Bash-инструмента убивает и сам шелл (шаблон есть в
   его командной строке) — останавливать через `ps | grep "[e]xpo" | xargs kill`.
9. `pnpm add` печатает «-110» — это хоистинг перестраивает `node_modules`, сборка
   после него проверена, ничего не сломалось.

---

## Исправлено после B0 (не закоммичено)

- **Тур: «Далее» / «Növbəti» не листал, точки стояли** (`app/tour.tsx`, нашёл
  владелец в веб-превью). Индекс слайда обновлялся только в `onMomentumScrollEnd`,
  которого нет на вебе и который не гарантирован при `scrollToIndex` — индекс
  навсегда 0, до кнопки «Davam et» не дойти. Теперь «Далее» ставит индекс сам,
  свайп считается в `onScroll` (с паузой 600 мс на анимацию кнопки). Проверено
  в веб-версии кликами: три слайда, точки двигаются, переход на `profile-type`.
  На Android не проверено, но старый код, скорее всего, ломался и там.
- **Веб: после тапа по полю страница съезжала, справа и снизу белое, синяя рамка
  фокуса внутри оранжевой** (скриншот владельца с iPhone, экран имени). Новый
  `app/+html.tsx` (только веб, отпечаток не меняет): `#root { overflow: hidden }`,
  кремовый фон `html, body`, `outline: none` у полей, `maximum-scale=1`. Причина
  съезда — декоративные круги `Screen` (360 dp, `right: -120`) выходили за экран,
  и браузер растягивал страницу до 496 px вместо 375: так было на `language`,
  `welcome`, `learning-languages`, `setup/name`. После правки все 18 проверенных
  экранов (13 с полями ввода + главные) — ровно 375 px, фон кремовый. Синюю рамку
  Safari в Chrome не воспроизвести — проверять на iPhone.

## B2 — онбординг (сделано в рабочей копии, не закоммичено)

Цепочка: `welcome` (язык с телефона + переключатель AZ | RU) → `setup/profile-type`
(для кого + одна галочка согласия) → `setup/name` (имя + 4 карточки возраста; для
себя — только имя) → `learning-languages` → `setup/focus` (Говорить / Слушать /
Всё понемногу) → `setup/building?create=1` (гостевой аккаунт + ребёнок) → `home`.
Новые компоненты: `OnboardingStep`, `StepIndicator`, `ChoiceCard`. В сторе
`startNewProfileSetup` (починка «Ппп», тест `store/settings.test.mts`). Удалены
`tour`, `onboarding-carousel`, `setup/plan-select`, `setup/age`. Регистрация — только
с баннера на главном (со 2-го дня) и сразу `/auth/register`, без экрана согласия и
PIN; после регистрации — `/home`. «Добавить ребёнка» → `setup/profile-type`.
Микрофон проверяет только `audioConsent`. На главном гость = `!authToken || isGuestAccount`.

Имя: «Хани» → «Бобо»/«Bobo» во всём приложении (азбука имени подогнана под строку,
AZ-окончания: Bobo-nun, Bobo-ya, Bobonu); `utils/companion.ts` считает «Хани» тоже
именем по умолчанию. Не везде имя проходит через подстановку — экраны уроков,
пейвола, серии, песен оставлены на свои батчи. `app.config.ts` (текст запроса
микрофона) НЕ трогали — нативный, меняет отпечаток, до следующей сборки.

Сервер (`apps/api`, не выложен): `ai/persona.ts` — медвежонок ≤10 лет, робот 11+ и
взрослые, имя по умолчанию Bobo/Бобо; промпт и кризисный ответ по персонажу; возраст
для этого читается из `children.age`. `lessonPrefs.moreListening` в схеме, zod,
генераторе и skin. «Хани» → «Бобо» в письме родителю. Тесты `ai/persona.test.ts`.

Проверки: типы 4 пакета, тесты 17 + 20 + 59, Android-экспорт, адрес API в бандле,
отпечаток `1a02f268…` не изменился, `check-ui` снизился по 6 метрикам (базовая
линия обновлена). Онбординг пройден в веб-превью до шага «Упор».

Во встроенных уроках персонаж говорит «Я добрый робот» — для малышей по решению
владельца нужен медвежонок; это правка контента (B5).

## B3 — главный экран (сделано в рабочей копии, не закоммичено)

По пункту 12 уточнений: шапка (`components/home/HomeHeader` — питомец → комната,
приветствие, серия, звёзды, переключатель языка при двух языках), карточка
«персонаж хочет спросить» при треде, одна карточка `components/home/HomeHero`
«Урок дня» с шагами урока. Состояние — `utils/homeState.ts` (`deriveHomeState`,
`todayPlanSteps`, тесты): первым «сделано сегодня» (завершение урока сразу
двигает `currentDay`, поэтому выполненный день показывает урок `currentDay − 1`),
потом регистрация гостя (со 2-го дня, не в минуту окончания первого), загрузка,
генерация, Premium, тест, урок. Данные — `hooks/useHomeData.ts` (перенос без
изменения логики). `home.tsx` 1725 → ~400 строк; экран взрослого (`AdultHome`)
не трогали. Удалены плитки темы/истории/серии/слов/сказки, переключатель
«Сегодня/Путь» и карта пути, страница `day-plan`. «Прогресс»: карточка «Курс, день
N из 30» и «Что помнит Бобо». `PaperBackground` главного — с верхним инсетом.

Найденные и исправленные баги:
- **День-история никогда не завершался:** главный открывал `/listening` без дня, а
  экран истории не умел засчитывать урок. Теперь `lessonStartRoute` передаёт
  `day` и `fromLesson=1`, экран после ответов показывает «Завершить урок» →
  `lesson/complete`. Повторный вход в урок берёт сегодняшнюю историю, а не
  генерирует новую (лимит 5 в день на ребёнка).
- **История молча не появлялась:** авто-генерация при входе падала без сообщения.
  Теперь сообщение всегда; 502 генерации повторяется один раз; лимит определяется
  по статусу 429, а не по подстроке.
- На вебе история не открывалась (нет файловой системы) — аудио data-URI.
- **Урок засчитывался без разговора** (нашёл владелец): в режиме урока в углу
  экрана разговора стояла «✓», которая сразу открывала `lesson/complete` — звёзды,
  серия и следующий день без единого слова. Теперь там «×» (выход без награды), а
  «Завершить урок» появляется только по `utils/lessonTalk.ts`: минимум 3 реплики с
  распознанной речью (пустое распознавание «...» не считается), для разговора «на
  время» — ещё и после завершения беседы персонажем. В уроке виден счётчик «Фраз
  сказано: N из 3». Тесты `lessonTalk.test.mts`. Других путей к `lesson/complete`
  нет: только разговор и история (там — после ответов на вопросы). Положительный
  путь (3 реплики → завершение) проверен только тестами — в веб-превью нет микрофона.

Проверено в веб-превью на реальном гостевом профиле (упор «Слушать»): главный
«Урок дня · День 1 · История на слух» (сервер сделал первый день историей), урок
пройден до «Урок выполнен» (+18 звёзд), главный показывает выполненный день,
«Прогресс» с курсом и памятью. Типы, тесты 17 + 31 + 59, Android-экспорт,
отпечаток `1a02f268…`, `check-ui` снижен (fontSize 105, эмодзи-иконки 61,
deep 8), базовая линия обновлена.

Не сделано / на потом: экран взрослого (`AdultHome`) прежний; экран завершения
урока по-английски для `lang=en` («LESSON COMPLETE!») — B5; маскот — B1.

## Веб-превью для владельца

Статический веб-экспорт (`expo export --platform web`, с временной правкой
Babel из ловушки 7) раздавался из scratchpad Node-сервером на порту 8099 и через
Cloudflare Quick Tunnel (`cloudflared tunnel --url http://127.0.0.1:8099`, без
аккаунта). У сервера был `/reset` — очищает localStorage и открывает приложение
с первого экрана. Всё это живёт только пока жива сессия; ссылка каждый раз новая.
Ограничения веба: микрофон только по https, заставка на каждой перезагрузке.

## Замечено на скриншотах, но не в B0

- Главный у подростка: «Привет, Тимур!» всё ещё Nunito — `home.tsx` задаёт шрифт
  сырыми стилями, не через `Text`. Уйдёт в B3.
- `talk`: круглая кнопка микрофона наполовину под панелью вкладок (веб-рендер,
  на телефоне не проверено); своя кнопка «‹» вместо `HBBackButton`. B4.
- `learning-languages`: квадратные подложки теней за скруглёнными карточками
  (вероятно, только веб — тень на обёртке без радиуса).
- `memory`: фиолетовый градиент вне палитры. B4.
- `paywall`: строки «Bobo помнит…». B6.
- `setup/name`: неактивная кнопка и `variant="soft"`, и opacity 0.45 — двойное
  приглушение. Экран переписывается в B2.

---

## Дальше

1. Владелец: коммит и `eas update --branch preview -m "B0: фундамент дизайн-системы"`
   (команды проверки — в конце плана; `strings` заменить на `grep -ao`).
2. Скриншоты B0 с A21s и широкого телефона, правки в тот же батч.
3. Затем B1 (маскот, три раунда с владельцем) или B2 (онбординг в 4 экрана —
   там же одна галочка согласия, гостевой аккаунт, починка «Ппп»). B1 и B2
   независимы.

---

## Приложение: скриншоты веб-версии через CDP

Без зависимостей (Node 22, встроенный `WebSocket`), нужен `google-chrome`.

```bash
# 1. временно включить import.meta в babel.config.js (ловушка 7), затем:
cd apps/mobile && CI=1 BROWSER=none ../../node_modules/.bin/expo start --web --port 8099 --clear
# 2. в другом терминале:
node shots.mjs out/ scenarios.json
# 3. вернуть babel.config.js
```

`scenarios.json` — массив `{ name, route, state, wait? }`, где `state` кладётся в
`localStorage['soz-settings-v1']` как `{ state, version: 0 }`. Пример:

```json
[{ "name": "home-teen", "route": "/home", "wait": 5000,
   "state": { "parentUILanguage": "ru", "onboardingComplete": true, "learningLanguages": ["en"],
              "childName": "Тимур", "childAge": 13, "childAgeRange": "11-13", "profileType": "kid",
              "currentDay": 1, "petHue": 230 } }]
```

Первый сценарий в прогоне часто пустой (сплэш на первой загрузке) — ставить
разогревочный. `shots.mjs`:

```js
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [outDir, scenariosPath, origin = 'http://localhost:8099'] = process.argv.slice(2);
const scenarios = JSON.parse(readFileSync(scenariosPath, 'utf8'));
mkdirSync(outDir, { recursive: true });

const port = 9333;
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${port}`,
  '--no-first-run', `--user-data-dir=${outDir}/.chrome`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
  } catch { await sleep(200); }
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === 'Runtime.exceptionThrown') console.log('  EXC', msg.params.exceptionDetails.exception?.description?.slice(0, 200));
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value;

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 712, deviceScaleFactor: 2, mobile: true });

const waitForApp = async (ms) => {
  for (const start = Date.now(); Date.now() - start < ms; await sleep(500)) {
    if ((await evaluate('document.body ? document.body.innerText.trim().length : 0')) > 20) return true;
  }
  return false;
};

await send('Page.navigate', { url: `${origin}/welcome` });
console.log('bundle ready:', await waitForApp(240_000)); // первая загрузка компилирует бандл

for (const s of scenarios) {
  const seed = s.state ? `localStorage.setItem('soz-settings-v1', ${JSON.stringify(JSON.stringify({ state: s.state, version: 0 }))});` : '';
  await evaluate(`localStorage.clear(); ${seed}`);
  await send('Page.navigate', { url: `${origin}${s.route}` });
  await sleep(1500);
  await waitForApp(30_000);
  await sleep(s.wait ?? 3500);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, `${s.name}.png`), Buffer.from(shot.result.data, 'base64'));
  console.log(s.name, '→', await evaluate('location.pathname'));
}
ws.close();
chrome.kill();
```
