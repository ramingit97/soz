# План редизайна Söz (одобрен владельцем 2026-09-14)

## Контекст

После первого device QA (Galaxy A21s, 320×712 dp) владелец сказал: «UI не тот, не понял, что делать». Анализ кода и скриншотов показал, что проблема не в палитре, а в структуре и дисциплине:

- онбординг: 13 экранов вопросов до первой ценности (индикатор врёт «из 7»);
- главный экран: кнопка «Начать урок» спрятана за шестью секциями, а на вкладке «Путь» (по умолчанию для младших) её нет вообще;
- маскот: персиковый круг без силуэта;
- 158 разных эмодзи как иконки, ни одной библиотеки иконок;
- 97% текста стилизовано сырыми StyleSheet, варианты `Text` не используются; 170 `textAlign: 'center'`;
- один визуальный язык на 5 и на 15 лет;
- баг «Ппп»: `petName` лежит в AsyncStorage и не сбрасывается при новом профиле, поэтому имя из прошлого теста всплывает в новом онбординге.

**Решения владельца (зафиксированы 2026-09-13):** два возрастных режима в одном приложении; маскот собираю сам в SVG; онбординг до 4 экранов; иконки Lucide.

**Решения, которые принимаю в плане (можно отменить при согласовании):**

1. **Гостевой аккаунт создаётся автоматически** в конце онбординга, регистрация просится со 2-го дня. Сейчас перед первым уроком стоит стена «согласие → регистрация», а кнопка «попробовать без аккаунта» оставляет пользователя без токена, то есть без AI. `POST /auth/guest`, `ensureGuestSession()` и апгрейд гостя в `register.tsx` уже написаны, но недостижимы из UI. `STATUS.md` описывает именно эту модель триала.
2. **Согласие на аудио** переезжает на экран «Для кого» (одна галочка со ссылкой на политику), а проверка микрофона в `talk.tsx:415` меняется с `!authToken && !audioConsent` на `!audioConsent`. Иначе гость с токеном обошёл бы согласие.
3. **Карта «Путь»** переезжает на вкладку «Прогресс». Внутренний переключатель «Сегодня / Путь» и есть то, что прячет главное действие.
4. **Подростковый режим** использует Fraunces для заголовков (пакет уже установлен, не подключён). Откат: одна строка в токенах на `Nunito_800ExtraBold`.

**Уточнения владельца 2026-09-14 (поверх плана, при расхождении действуют они):**

1. **Согласие — одна галочка на всё**, а не только на голос: «я родитель; согласен на обработку данных и отправку голоса в AI» + ссылка на политику. Три галочки `auth/consent` (`age`, `data`, `audio`) сворачиваются в одну на экране «Для кого»; гостевой аккаунт с именем и возрастом ребёнка создаётся только после неё. Пункт `COPPA-LEGAL-CHECKLIST.md` «согласие перед созданием ребёнка» остаётся правдой.
2. **Цвет Хани выбирается в `pet-room`**, в той же карточке «Хани хочет познакомиться», что и имя. До этого — мёд (55).
3. **Бриф дизайнеру не отправляется**, работаем по токенам этого плана.
4. **Шрифты заголовков: kid — Nunito 900 Black, teen — Onest 700. Fredoka и Fraunces не используются.** Проверено по таблицам глифов: в Fredoka нет кириллицы и `ə ğ ş`, в Fraunces нет кириллицы — русские заголовки рисовались системным шрифтом, азербайджанские с подменой букв посреди слова. Любой новый шрифт проверять на `А–я ё ə Ə ğ ı İ ş ç ö ü` до подключения.
5. **Lucide импортируется по одной иконке** (глубокий путь), а не из корня пакета: Metro не вырезает неиспользуемое, корневой импорт тянет ~1600 иконок.
6. **B0 сужен** до того, что меняет вид всего приложения: режимы, `useTheme`, `Icon`, токены, `Text`, `HBButton`, `HBCard`, `HBChip`, `HBIconBox`, `HBBackButton`, `BottomTabs`, `PaperBackground`, `Screen`, шрифты, `check-ui`. `Input` и `StepIndicator` делаются в B2, `ScreenHeader` в B4, `LessonProgress` в B5 — вместе с первыми экранами, которые их используют.
7. **До публичного релиза** пересмотреть лимит `/auth/guest` (5 в час на IP по `x-forwarded-for`): гостевой вход становится основным путём, а мобильные операторы выводят тысячи абонентов через один IP. Для закрытого теста не мешает.

**Не делаем:** нативных изменений (всё уходит через EAS Update), тёмной темы, iOS, иллюстратора, правок бэкенда, замены эмодзи в контенте уроков и репликах Хани.

---

## A. Два режима: `kid` (5–10) и `teen` (11–16, взрослый)

- `src/theme/mode.ts` (новый): `uiModeFor(profileType, childAge, childAgeRange)` → `'kid' | 'teen'`. Считаем от `childAge` (репрезентативный возраст 6/9/12/15/25), потому что `syncChild()` не пишет `childAgeRange` и после смены профиля он устаревает. `MODE_TOKENS` — таблица ниже. `makeModeStyles(build)` — две `StyleSheet.create` на уровне модуля, выбор при рендере.
- `src/hooks/useUIMode.tsx` (новый): контекст + `UIModeProvider` в `app/_layout.tsx`, проп `force` для родительской зоны (`parent*`, `paywall`, `consent`, `register` всегда `teen`).
- `src/hooks/useTheme.ts` (новый): `useUIMode()` + `useAccent()` + `useCompactScreen()`; герой-маскот ужимается ×0.75 на коротком экране, чтобы экраны не ветвились по высоте сами.

| Токен | kid | teen |
|---|---|---|
| Заголовки | Fredoka 700, `3xl` / `2xl` | Fraunces 700, `2xl` / `xl` |
| Кнопка: шрифт, радиус | Fredoka, 20 | Nunito 800, 14 |
| Карточка: радиус, тень | 20, `shadow.card` | 16, `shadow.sm` |
| Маскот hero / avatar / inline | 160 / 36 / 56 | 96 / 28 / 40 |
| Плотность (padX / cardPad / gap) | 20 / 16 / 12 | 16 / 12 / 8 |
| Фон | cream + тёплая виньетка | cream без виньетки |
| Иконки strokeWidth | 2.25 | 1.75 |
| Палитра, акцент от hue, вкладки, IA | одинаково | одинаково |

Экраны ветвятся по `mode` только в четырёх местах: hero на `welcome`, hero на `home`, празднование в `lesson/complete`, пустое состояние `talk`. Всё остальное через токены. Счётчик `mode ===` в `check-ui.mjs`.

---

## B. Дизайн-система (батч B0)

| Что | Изменение |
|---|---|
| `theme/colors.ts` | `surface: '#FFFFFF'`, `surfaceBorder: '#EDE4CF'`; `card` остаётся кремовым для чипов на белом |
| `theme/spacing.ts` | `shadow.card` (лёгкая: 0/4, 0.08) |
| `theme/typography.ts` | `fontFamily.serif`, `serifSemi` (Fraunces) |
| `Text.tsx` | display-варианты зависят от режима; тона `brand`, `danger`, `success`, `onAccent`; выравнивание по умолчанию слева (как и сейчас) |
| `HBButton.tsx` | поглощает `Button.tsx` (4 импортёра: `welcome`, `review`, `tour`, `learning-languages`), `icon?: IconName`, `loading`, настоящий `disabled`; радиус и шрифт из режима. `Button.tsx` удаляется |
| `HBCard.tsx` | фон `surface`, рамка 1 px `surfaceBorder`, `rim` по умолчанию выкл., тень `t.shadow.card`. **Риск:** 81 вызов становится белым; `HBChip` и `HBBackButton` получают рамку в том же коммите, чтобы не пропасть на белом |
| `Input.tsx` (новый) | подпись сверху, 52 dp, белый, рамка 1.5 px, фокус 2 px акцентом, текст слева. Визуально не кнопка. Потребители: имя ребёнка, auth/*, имя питомца |
| `Icon.tsx` (новый) | закрытая карта именованных импортов из `lucide-react-native` (Metro не tree-shake'ит), `IconName`, `size`, `color`, `strokeWidth` из режима, `tint` → обёртка `HBIconBox` |
| `HBIconBox.tsx` | `icon?: IconName` рядом с legacy `glyph` |
| `HBBackButton.tsx` | `‹` → `<Icon name="chevron-left">` (26 мест) |
| `StepIndicator.tsx` (новый) | вынос из `app/setup/name.tsx:126–154`; kid точки, teen сегменты |
| `ScreenHeader.tsx` | оживить мёртвый `HBScreenHeader`: назад, заголовок слева, слот справа, `safeTop` через `useSafeAreaInsets` (сейчас 0 использований, 26 файлов с `paddingTop: 50…90`) |
| `LessonProgress.tsx` (новый) | «шаг n из N» вместо шести самодельных вариантов в уроках |
| `Screen.tsx` | `scroll` по умолчанию `true`; `scroll={false}` явно в `tour.tsx` и `setup/name.tsx` до их удаления/переписывания в B2. `PaperBackground` получает проп `scroll` |
| `BottomTabs.tsx` | Lucide `house / message-circle / chart-column / user`, активное состояние по режиму |

Карта эмодзи → Lucide (≈45 глифов): ⭐ star, 🔥 flame, ❄️ snowflake, 👑 crown, 💬 message-circle, 🧠 brain, 🏠 house, 📋 clipboard-list, 🗣️ messages-square, 🎧 headphones, 📖 book-open, 📚 library, 🗺️ map, 🎯 target, 🌙 moon, 🎉 party-popper, ✨ sparkles, 🚀 rocket, 💾 save, 🛠️ wrench, 🤖 bot, ✓ check, ▶ play, 🔒 lock, ✅ circle-check, 🏆 trophy, 🔁 repeat, 🎁 gift, 📅 calendar, 💪 dumbbell, 💖 heart, 🔄 refresh-cw, 📸 camera, 🎶 music, ⚡ zap, ⚖️ scale, 🎭 drama, ›‹ chevron, ✕ x, 💡 lightbulb, 💭 message-circle-dashed, 📊 chart-column, 🧸/🎯 baby/user, 🎒📘🎓 backpack/book/graduation-cap. Эмодзи остаются в `src/data/lessons.ts`, `story.tsx`, `boboHouse.ts`, ответах квизов и репликах Хани.

---

## C. Маскот (батч B1, три раунда)

`src/components/HBPet.tsx` переписывается, API совместим:

- viewBox квадратный `0 0 120 120`; голова-суперэллипс, два круглых уха с внутренним светлым кругом (медведь читается на 24 px), светлая морда, тёмный нос, щёки. `variant: 'head' | 'full'` — от 64 px тело с лапами, ниже 48 px без градиентов и щёк.
- `mood`: старые `happy | sleepy | curious | sad` работают, добавляются `neutral | listening | thinking`; `talking` остаётся наложением. `ReactingPet.react()` получает `'thinking'`.
- `hue` необязателен → берётся из стора (сейчас 25 из 58 вызовов теряют выбранный цвет). Палитра переезжает в `src/theme/petPalette.ts`, `accent.ts` импортирует те же ключи.
- Уникальные id градиентов через `useId()`. Моргание на `useAnimatedProps`, без React-state (сейчас ререндер каждые 3–6 с на каждого питомца). `still` по умолчанию при size < 48.
- `Bobo.tsx` становится тонким алиасом, 16 вызовов заменяются по ходу батчей, файл удаляется в B7.

**Протокол с владельцем:** новый маршрут `app/dev/mascot.tsx` (не за `__DEV__` — в бандле EAS Update он `false`): сетка 6 состояний × размеры 24/48/96/200 × 7 цветов, переключатели `talking / still / variant / mode`. Скрытый вход: 5 тапов по подписи «Söz · 1.0.0» внизу `profile.tsx`, там же «сбросить онбординг» вместо `__DEV__`-кнопок. Раунд 1: силуэт на 24 и 200 («это медведь?»). Раунд 2: шесть лиц на 96. Раунд 3: цвета и движение.

---

## D. Онбординг: 4 экрана (батч B2)

Цепочка: `/welcome` (переключатель RU|AZ в углу, `/language` выпадает) → `/setup/profile-type` (для кого + галочка согласия на аудио) → `/setup/name` (имя + возраст одним экраном, 2×2 карточки 5–7 / 8–10 / 11–13 / 14–16) → `/learning-languages` → `/setup/building?create=1` (не вопрос, а «Хани готовит первый урок»: гостевой аккаунт + `POST /children` + ожидание дня 1) → `/home`.

`POST /children` получает `name, age, ageBand, level: 'beginner', learningLanguages, scheduleDays` (дефолт пн–пт), `petName` отсутствует. Схема API не меняется; `ageBand` обязательно передаётся, иначе генератор берёт регистр 8–12.

**Стор:** `startNewProfileSetup(type)` в `src/store/settings.ts` сбрасывает `childId, childName, childAge, childLevel, childAgeBand, childAgeRange, petName → null, petHue → 55, childInterests, learningFocus, goal, goalsAll, schedule*, proactiveOptIn, currentDay, totalStars, streak, lastCompletedDate, stars*` и **не трогает** `authToken, onboardingComplete, learningLanguages`. Вызывается из `profile-type`, `profile-select.tsx:302` (добавить ребёнка), `parent.tsx:267`. Это и есть починка «Ппп».

| Действие | Файлы |
|---|---|
| Правка | `welcome`, `setup/profile-type`, `setup/name` (переписать), `learning-languages`, `setup/building`, `index.tsx`, `store/settings.ts`, `auth/register` (после успеха → `/home`), `auth/consent` (убрать «попробовать без аккаунта»), `profile-select`, `parent.tsx`, `talk.tsx` (гейт согласия) + новый `AudioConsentSheet.tsx`; новые `src/data/ageRanges.ts`, `src/data/petColors.ts` |
| Удалить в B2 | `tour.tsx`, `onboarding-carousel.tsx` (уже сирота), `setup/plan-select.tsx` (ничего не пишет), `setup/age.tsx` (слит с именем) |
| Оставить без ссылок, вернуть позже с `?from=` | `setup/level` + `placement` (профиль → «Уровень»), `setup/schedule` (настройки родителя), `setup/notify` (после первого урока), `setup/goals` / `goal` (родитель, AdultHome), `setup/interests` (отчёт родителя; `checkpoint.tsx` уже спрашивает), `language.tsx` (профиль), `auth/consent` (перед регистрацией) |
| Удалить в B7 | `setup/pet.tsx` (наименование питомца переезжает в `pet-room`), `parent-add-child.tsx`, `lesson/listen.tsx` (недостижим) |

Куда уходят отложенные вопросы: питомец → карточка «Хани хочет познакомиться» в `pet-room` при `petName === null` (+ `updateChild`); интересы → `checkpoint` и строка в отчёте; уровень → `beginner` + строка в профиле; уведомления → `lesson/complete` после дня 1, если разрешение не спрашивали; расписание и цели → строки в родительских настройках.

---

## E. Главный экран (батч B3)

1. Сначала без визуальных изменений: эффекты и данные из `home.tsx:281–500` выносятся в `src/hooks/useHomeData.ts`, чистая `deriveHomeState()` в `src/utils/homeState.ts` (тест) возвращает одно из `lesson | done | quiz | preparing | error | generating | paywall`. Гость перестаёт быть hero-состоянием, становится баннером.
2. Раскладка, одинаковая в обоих режимах:
   - `HomeHeader`: аватар-питомец (тап → комната), «Привет, Имя», чипы серии и звёзд, переключатель языка только при двух языках;
   - карточка «Хани хочет спросить» только когда есть тред;
   - **`HomeHero`** — одна `HBCard depth="deep"`, содержимое по состоянию. `lesson`: «День N», тема, чипы слов, `HBButton icon="play"` «Начать урок»; kid показывает питомца 96, teen без питомца. `done`: «Урок выполнен» + hero становится «Поговорить с Хани». Шапка и hero помещаются выше сгиба на 320×712;
   - цель дня — одна строка прогресса под hero, не карточка;
   - ряд из трёх `QuickTile`: Говорить, История, Повторить;
   - сетка «Ещё» 2 колонки: План дня, Темы, Слова, Серия, Комната Хани, Достижения, Память, Песни; ночью первой — «Сказка» (цвета `english/englishLight` вместо фиолетового `#6B54E0`).
3. Карта «Путь» → `src/components/PathMap.tsx`, рендерится сверху `progress.tsx`.
4. `AdultHome` → `src/screens/AdultHome.tsx` (не маршрут), в `home.tsx` остаётся однострочная развилка.
5. Убрать фиолетовые хардкоды: `home.tsx:1006–1018`, `day-plan.tsx:52,145`, `data/worlds.ts:54`, `profile.tsx:22`.

---

## F. Батчи и порядок

Зависимости: B0 → всё. B1 независим от B2, можно чередовать. B3–B5 используют состояния маскота, но API совместим, поэтому не ждут финального рисунка. B7 последний.

| Батч | Что | Скриншоты владельца (320 dp + широкий) | Риск |
|---|---|---|---|
| **B0 Фундамент** | `corepack pnpm --filter @soz/mobile add lucide-react-native` + проверка fingerprint; `mode.ts`, `useUIMode`, `useTheme`, `Icon`, `Input`, `StepIndicator`, `ScreenHeader`, `LessonProgress`, `scripts/check-ui.mjs`; правки `Text`, `HBButton`, `HBCard`, `HBChip`, `HBIconBox`, `HBBackButton`, `BottomTabs`, `PaperBackground`, `Screen`, `_layout` (Fraunces + провайдер); удаление `Button.tsx` | home, talk, profile-type, paywall, parent-summary: контраст карточек, чипы на белом, иконки вкладок | Fraunces обязан войти в `fontsReady`; белые карточки съедают кремовые чипы |
| **B1 Маскот** | `HBPet` переписать, `Bobo` алиас, `ReactingPet`, `app/dev/mascot.tsx`, скрытый вход в `profile.tsx` | dev/mascot, шапки home и talk, welcome, building | `useAnimatedProps` на SVG проверить на устройстве |
| **B2 Онбординг** | раздел D | welcome RU и AZ, для кого, имя+возраст (клавиатура открыта и закрыта), языки, building, home; добавление второго ребёнка с пустым именем питомца | лимит гостей 5/час/IP при повторных тестах; проверить тело `POST /children` в логах Fly |
| **B3 Главный** | раздел E + `progress`, `pet-room` (карточка знакомства), `day-plan`, `worlds.ts` | home kid (lesson, done, preparing), home teen, home adult, progress, pet-room | переписывание 1725 строк: сначала вынос эффектов без изменений |
| **B4 Разговор** | `talk.tsx` (`ScreenHeader` с safe-area, пузыри: ребёнок на `accent.soft` с тёмным текстом, Хани белый; квота и ошибки инлайн-баннером вместо `Alert.alert`; состояния `listening/thinking`), `MicButton` (акцент от hue), `ObjectiveChips`, `topics`, `memory`, `listening` | talk пустой, talk в диалоге, talk `fromLesson=1`, topics, memory | логика записи и воспроизведения не трогается |
| **B5a Открыватели уроков** | `quest`, `tpr`, `pretend`, `world` → `PaperBackground` + `LessonProgress` + `HBButton` + `HBPet`; убрать `LinearGradient` и `Bobo` | по одному (дни 1–4 чередуются) | fullscreen без прокрутки: размеры через `useCompactScreen().short` |
| **B5b Ядро уроков** | `word-game`, `grammar`, `milestone`, `read` (шапка), `complete` (запрос уведомлений после дня 1, развилка празднования), удалить `lesson/listen.tsx` | word-game, grammar, complete kid и teen, milestone | начисление наград в `complete` не трогать |
| **B6 Родитель и пейволл** | `parent`, `parent-summary`, `parent-settings` (строки расписания и целей), `parent-transcripts`, `paywall` (Bobo → Хани в строках 57–60, 78–79, 94–95), `auth/consent`; все под `force="teen"` | parent, summary, settings, paywall, consent | длина азербайджанских строк в плотных списках |
| **B7 Хвост** (3 × 5 экранов) | `profile`, `profile-select`, `achievements`, `album`, `streak`, `story`, `songs`, `phrases`, `photo-learn`, `checkpoint`, `missed`, `review`, `bobo-house`, `+not-found`, `auth/*`, `legal/privacy`, оставшиеся `setup/*` с `?from=`, `language`, `ErrorBoundary`, `services/achievements.ts` (`icon` вместо `emoji`); удалить `Bobo.tsx`, `parent-add-child.tsx`, `setup/pet.tsx`; эмодзи → Icon, сырые `fontSize` → токены, центрирование → слева кроме hero, `paddingTop` → `ScreenHeader safeTop` | по подбатчу | механически, но широко; прогресс меряет `check-ui.mjs` |

Масштаб: B0, B2, B4, B6 — по одной сессии каждый; B1 — три коротких раунда; B3 и B5 — по две сессии; B7 — три. Каждый батч самостоятельно уходит в `preview` через EAS Update, закрытый тест на редизайн не ждёт.

---

## G. Ограничители

- **320 dp:** `Screen` и `PaperBackground scroll` прокручиваются по умолчанию; размеры героев только из `t.mascot.*`, который `useTheme` ужимает при `short`; `paddingTop` литералов выше 24 нет, только `ScreenHeader safeTop`.
- **`shadow.deep` один на экран:** `check-ui.mjs` считает `depth="deep"` по файлам; после B3 допустимы только `HomeHero`, `paywall`, `lesson/complete`.
- **`scripts/check-ui.mjs`** (Node без зависимостей): по файлам и суммарно — сырые `fontSize`, `textAlign: 'center'`, `<Text>` из одного эмодзи вне контентного allowlist, `depth="deep"`, `<Bobo`, `Alert.alert`, `paddingTop ≥ 40`, развилки `mode ===`. `--check` сравнивает с `scripts/ui-baseline.json` и падает, если любая метрика выросла. Базовая линия на старте: 137 / 170 / 46 / 16 / 26.
- **Тесты (существующий `node --test`):** `theme/mode.test.mts` (все сочетания возраст × профиль), `utils/homeState.test.mts` (7 состояний + баннер гостя), тест `startNewProfileSetup` (petName null, `authToken` и `onboardingComplete` нетронуты).

---

## Верификация каждого батча

```bash
corepack pnpm typecheck
corepack pnpm test
cd apps/mobile && ../../node_modules/.bin/expo export --platform android
strings -n 10 dist/_expo/static/js/android/*.hbc | grep -c soz-api.fly.dev   # >= 1
strings -n 10 dist/_expo/static/js/android/*.hbc | grep -c localhost:3000    # 0
npx expo-updates fingerprint:generate --platform android                     # 1a02f26809db28d65c05866f86f7c217a7b57f52
node scripts/check-ui.mjs --check
corepack pnpm --filter @soz/mobile exec eas update --branch preview -m "B<n>: …"
```

Владелец: дважды перезапустить приложение (обновление применяется со второго старта), прислать скриншоты из списка батча с A21s и с одного широкого телефона. Правки по скриншотам идут в тот же батч до следующего.

**Первый шаг после одобрения:** скопировать этот план в `context/PLAN-REDESIGN-2026-09-13.md`, затем B0.
