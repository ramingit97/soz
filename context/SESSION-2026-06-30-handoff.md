# Söz/Bobo — Session Handoff (2026-06-30)

> Read this first to continue the work from this session. Covers TWO bodies of work:
> **(A) backend bug-fixes + leveled AI curriculum** (done, verified) and
> **(B) an in-progress app-wide UI design polish pass** (partially done, `tsc`-green).
>
> Project: monorepo at `/home/ramin/Desktop/langapp` — `apps/mobile` (Expo Router),
> `apps/api` (Hono + Drizzle + Neon Postgres), `packages/{content,shared-types}`.
> Run: `cd ~/Desktop/langapp && ./run.sh lan` (NOT bare `./run.sh` = tunnel).
> Typecheck: `cd apps/mobile && npx tsc --noEmit` / `cd apps/api && npx tsc --noEmit` (both green now).

---

## PART A — Backend fixes + progressive AI curriculum (DONE, verified)

Full detail is in auto-memory `project_phase27.md`. Summary:

1. **`/talk` & `/talk/opener` 400s** — client sent `null` for absent optional fields; server schemas used `z.optional()` (rejects null). Fixed → `.nullish()` for `childName/ageBand/scenario/companionName/threadId` in `apps/api/src/routes/talk.ts`; `day` now `z.preprocess(...finite..., default 1)`; `scenario` max 200→1000. A debug hook on the `/talk` validator logs `[talk] validation failed: …` (still present — can remove once confident).
2. **Talk-tab back button** went to `/language` (leaked `__DEV__` branch). Removed → always `/home`. `app/talk.tsx`.
3. **"Bobo" everywhere despite a chosen pet name** — name IS saved/hydrated; default was hardcoded in lesson content + UI. Fixed two-layer: central rename in `getLesson` (`src/data/lessons.ts`, `setCompanionNameProvider` wired in `app/_layout.tsx`) + util `src/utils/companion.ts` (`useCompanionName()` / `withCompanionName()`) applied across ~17 screens.
4. **Leveled/teen/adult learners got the 7-year-old beginner plan** — only `beginner` templates exist; assembler fell back to beginner; `ageBand` never passed. **Fixed:** new `apps/api/src/services/generatedCurriculum.ts` — `needsGeneratedCurriculum(level, ageBand)` → AI-generates curriculum from day 1 (reuses days-31+ engine), progressive: week 1 first, weeks 2-5 background, in-flight dedup. `generator.ts` got `ageBand` register. Serving in `routes/lesson.ts` branches to generated for these children (mobile unchanged). Parent feedback (`POST /children/:id/preferences`) → `regenerateGeneratedCurriculumFrom`. Verified live (teen/pre_int → "Summer Sports", proper vocab).

**Still open (Part A):** background gen is fire-and-forget (no cron); `talkSystemPrompt` in generated lessons may literally say "Bobo" (harmless); first-fetch gen ~35s behind loading state; NOT device-tested.

---

## PART B — App-wide UI design polish pass (IN PROGRESS)

### Goal & direction (agreed with founder)
"Пройтись по всем страницам, сделать красивее." This is **NOT a rebrand** — the
Honeybear/claymorphism identity (Phase 21/22) stays. It's a **consistency + restraint
polish** pass: raise every screen to the level the best components (`HBButton`,
`HBCard`, `Text`) already set, then targeted beauty on flagship screens.
Founder instruction: **do everything sequentially (not parallel agents); they will
review screens on-device afterward and report what's wrong.**

### Design system (the anchor — already mature, don't reinvent)
- `src/theme/colors.ts` — warm cream palette: `bg #F6F0E2`, `card #FFFBF1`, `ink #3C3121`, `inkSoft #6B5C46`, `primary #E8945A` (peach), `primaryDeep #C97339`, `primarySoft #FCE3CE`, `accent #7AC9B5` (sage), `butter #F5D466`, `berry #E55C73`, `border #EAE0CB`, `textMuted #B5A993`.
- `src/theme/typography.ts` — `fontFamily.display 'Fredoka_700Bold'`, `displaySemi`, `body 'Nunito_400Regular'`, `bodyMedium/bodyBold/bodyBlack`; `fontSize xs12..6xl60`.
- `src/theme/spacing.ts` — `spacing` scale; `radius sm8/md12/lg16/xl20/2xl26/3xl36/full`; `shadow sm/md/lg/deep/glow` (3 honest depths); `shadowTint ink/primary/sage/berry/butter`.

### Audit headline findings (why screens look uneven)
The system is excellent; **application is inconsistent** (~40% of screens bypass tokens):
1. Back buttons hand-rolled 6+ ways (the #1 unpolished tell) — **FIXED this session**.
2. Tint palettes re-invented per screen (`SCENE_TINTS`, `OPTION_TINTS`, `CARD_PALETTE`, hardcoded `#D4F2EA`/`#FFF6D0`/`#FDDDE4`) — no single source. **NOT yet done.**
3. Gradients & clay-rim borders copy-pasted inline in 15+ places. **Partly addressed (tokens exist, not yet adopted).**
4. Magic-number font sizes (`13`/`12`) weaken hierarchy. **NOT yet done.**
5. Off-palette purple `#6B54E0`/`#7C3AED` used in profile/read/photo-learn/checkpoint (not in Honeybear palette). **NOT yet done.**

### DONE this session (Part B)
**New foundation files (committed, tsc-green):**
- `src/theme/decor.ts` — `gradients` (primary/accent/butter/berry/cream/night), `tints` (primary/sage/butter/berry/english), `clay` (rimLight/rimShadow). Exported via `src/theme/index.ts`. Hex matches what was on screen → adopting is no-visual-change.
- `src/components/HBBackButton.tsx` — canonical back. 40×40 clay disc, `‹`, `shadow.sm`, top rim, press-squish, haptics, `hitSlop`. Props: `onPress?` (default router.back), `inline?` (drop into a row vs floating absolute top-left), `glyph?`, `top?`.
- `src/components/HBScreenHeader.tsx` — back + title + right slot (created; **barely adopted yet** — use for future header unification).
- `src/components/HBIconBox.tsx` — tinted rounded icon container (created; **not adopted yet** — use to replace inline icon-tint chips).

**Back button unified across 29 screens** (replaced inline Pressable+styles.backBtn/iconBtn):
- Content: listening, phrases, album, photo-learn, songs, memory, topics, read, story, streak, pet-room, day-plan, bobo-house, achievements
- Lesson: grammar
- Parent: parent, parent-settings, parent-add-child, parent-transcripts
- Auth/legal: auth/consent, auth/forgot, auth/verify-email, legal/privacy
- Onboarding: setup/age, setup/pet
- Placement: `inline` when the back sat in a flex/topBar row (no `position:absolute` in its style); floating (default) when its style had `position:absolute`.

**Intentionally LEFT as `✕` close buttons** (correct affordance on dark/immersive modals — do NOT convert to back disc): `lesson/world`, `lesson/quest`, `lesson/tpr`, `lesson/pretend`, `lesson/listen`, `lesson/quiz`, `review`, `paywall`.

**Dead code left behind (harmless):** the now-unused `backBtn`/`backText`/`iconBtn`/`iconBtnText` StyleSheet entries remain in the 29 migrated files. Safe to sweep later.

### TODO (Part B — continue here, in this order)
1. **Tint/gradient centralization** — ✅ DONE (2026-06-30, second pass). Exact-match hexes/arrays migrated to `tints`/`gradients` from `@/theme`, tsc-green, no-visual-change:
   - Local tint arrays: `quiz` OPTION_TINTS, `photo-learn` CARD_PALETTE, `read` SCENE_TINTS → tokens.
   - Hardcoded tint hexes → `tints.{primary,sage,butter,berry,english}` across: achievements, album, checkpoint, day-plan, lesson/complete, parent-summary, pet-room, progress, songs, story, setup/age, setup/interests, profile-select. (Script-driven; JSX `bg="#.."` → `bg={tints.x}`.)
   - Inline gradients → `gradients.{primary,cream,night}`: parent, learning-languages, parent-add-child, auth/forgot(×2), auth/verify-email, setup/plan, legal/privacy, bobo-house.
   - **Deliberately LEFT (not exact-token):** off-palette purple `#EAE6FF/#6B54E0/#7C3AED` (→ TODO #3 decision); near-matches `#FFF8D6` (≈butter), saturated `color:` accents (`#4A8AFF` etc.); `home.tsx` (flagship #7) and `paywall.tsx` (immersive) tints; immersive dark lesson gradients (tpr/listen/world/quest/pretend) and 3-stop primary gradients (grammar/listen) — all intentionally custom.
2. **Type hierarchy** — ⏳ PARTIAL (2026-06-30). `fontSize: 12 → fontSize.xs` done across 24 files (34 occ, zero-pixel-change; added `fontSize` import to setup/plan + setup/schedule). **STILL OPEN — needs founder decision:** 13 (20×), 11 (41×), 10 (35×) have NO matching token (scale is xs12/sm14). Mapping them shifts on-screen type — either (a) extend scale with named micro-tokens (`2xs:11`, etc.) for zero-pixel naming, or (b) consolidate toward xs/sm (cleaner hierarchy, visible shifts). Also: use `Text` variants where raw `<Text>` is styled inline.
3. **Off-palette purple** — decide: map `#6B54E0`/`#7C3AED` to a Honeybear token (e.g. add a `violet` to palette) OR re-tint to sage/berry. Used in profile avatars, read/story scene tints, photo-learn, checkpoint, day-plan read-task.
4. **Adopt `HBIconBox`** for the inline icon-tint chips (day-plan, progress, parent-summary, etc.).
5. **Adopt `HBScreenHeader`** where screens have back+title+right rows (album, photo-learn, songs topBars; parent screens).
6. **Onboarding consistency** (first impression, audit priority): missing back on `setup/name` & `setup/goals`; title-size variance (name 22 vs age `3xl`); ensure StepIndicator present on every step incl. goals/notify; standardize radio size (26).
7. **FLAGSHIP beauty (needs founder's eyes):** deeper, opinionated polish on `app/home.tsx` (the zigzag path — the daily hero), `app/talk.tsx` (chat with Хани), and the onboarding hero. Spend the "one real risk" here. ~home.tsx is 1300+ lines — review-heavy.
8. **Sweep dead `backBtn/backText/iconBtn` styles** — ✅ DONE (2026-06-30). Brace-matched remover deleted 49 unused StyleSheet keys across 26 files (only when `styles.KEY` was unreferenced — `quiz.tsx`'s live `iconBtn`/`iconBtnText` correctly kept). tsc-green.

### Progress log — 2026-06-30 second pass (this session)
Founder chose "safe hygiene #1→#2". Completed, all tsc-green, no-visual-change (except where noted):
- #1 tint + gradient centralization — DONE (see #1 above).
- #2 type — `fontSize:12→fontSize.xs` done (34 occ); 13/11/10 LEFT per founder ("оставить как есть, идём дальше"), no token exists.
- #8 dead-style sweep — DONE.
NOT touched (need founder/device): #3 purple decision, #4 HBIconBox adoption, #5 HBScreenHeader adoption, #6 onboarding restructure (note: `setup/name` is step 1 sometimes entered via `index.tsx` Redirect with no back-stack → adding back there could strand users; founder call), #7 flagship home/talk. Founder to review this batch on device next.

### Open question pending from founder
"Proceed #1→#2 (safe hygiene) next, or jump straight to flagship `home`/`talk`?"
Founder reviews the back-button change on device first, then directs.

### How to verify after any change
```
cd /home/ramin/Desktop/langapp/apps/mobile && npx tsc --noEmit   # must stay exit 0
```
Then `./run.sh lan` and reload Metro; spot-check a content screen, an onboarding step,
a parent screen, and bobo-house (dark bg — cream back disc must read well).

### Constraints / gotchas
- Can't screenshot RN from here — founder is the visual reviewer. Keep edits mechanical + tsc-gated.
- `tsconfig` does NOT enforce `noUnusedLocals`, so leftover unused styles/imports don't fail tsc (but clean them eventually).
- Editing matches whitespace exactly; chevron glyph is `‹` (U+2039), close is `✕`.
- Do the rollout **sequentially**, not via parallel agents (founder's explicit preference).

---

## PART C — Founder device-review fixes (2026-06-30, pass 3) — DONE, both apps tsc-green

Founder ran the app and reported 6 issues. All addressed (no DB migration needed — no schema change). API runs `tsx watch` (auto-reload). Mobile: reload Metro (new file `src/components/KeyboardAvoider.tsx`).

1. **Companion name said "Хани/Бобо" despite chosen pet name** — systemic. Fixed `setup/age.tsx` (uses `useCompanionName()` — pet chosen step 3, this is step 4) + swept user-facing hardcodes: `home.tsx` "wants to ask" banner (now `${bot}` + 💬 not 🐻 + `withCompanionName(dueThread.text)`), `listening`, `missed`, `songs`, `checkpoint`, `parent-settings` ("Голос Хани"→`${bot}`), `story.tsx` (post-processes the ~30 hardcoded "Хани" archetype lines + completion line via `bot`). `setup/name.tsx` is **step 1 (pet not named yet)** → reworded to "Друг/Dostu" instead of a pet name.
2. **Goal was single-select** → now multi-select (limit 2, first = PRIMARY). Store: added `goalsAll: string[]` + `setGoals` (keeps `goal` = primary for existing consumers, zero churn). `setup/goals.tsx` multi-toggle + "главное/əsas" tag on primary; adult `setup/goal.tsx` uses `setGoals([goal])`. **Server still stores single `goal` (=primary)** — multi-goal influencing content is wired via the generator's `goal` param (see #4 below) using the primary; full multi-goal server-side is a later step.
3. **Keyboard hid the input on text screens** — root cause: `Screen scroll=false` = no scroll + vertically-centered hero + big mascot, KAV `padding` squished it under the keyboard. Built **`src/components/KeyboardAvoider`** (KAV + ScrollView + `keyboardShouldPersistTaps` + `keyboardVerticalOffset` + optional `center`/`footer`). Retrofitted the broken **non-scroll** screens: `setup/name` (the screenshotted one; `styles.center` flex→flexGrow, CTA moved to `footer`), `auth/verify-email`, `auth/forgot`. Other input screens (`pet`, `interests`, `login`, `register`, `goal`, `album`, `checkpoint`, `parent-add-child`, `topics`) already have a ScrollView so are acceptable — migrate to `KeyboardAvoider` later for consistency.
4. **AI must always build the curriculum by level/interests/goal (B1 gave a beginner lesson)** — root cause: `needsGeneratedCurriculum` only triggered for non-beginner/teen/adult, AND mobile `getLesson` (`src/data/lessons.ts:1230`) falls back to bundled **beginner** static when the generated curriculum isn't cached yet (~35s first-gen window) → founder saw beginner content for a B1. **Done:** `needsGeneratedCurriculum()` now returns **true for everyone** (always AI-built; bundled static is offline-only safety net). Threaded **`goal`** into the generator: `GeneratorInput.goal` + new `goalGuidance()` (school/move/communication/travel/career/… → biases themes & scenarios) + `child.goal` passed in `generatedCurriculum.ts`. Onboarding already sends interests+goal+ageBand at `createChild` (`setup/plan.tsx`), so week-1 gen uses them. **STILL OPEN (task 8 / next push):** never show bundled-beginner during the first-gen window (show a "preparing your lessons" state); this lives with the path redesign.
5. **AI must actively correct in conversation (both /talk free-chat and /topics)** — was explicitly FORBIDDEN ("Never correct grammar directly"). **Done (everywhere):** rewrote TONE in `apps/api/src/ai/system-prompts.ts` → age-aware tactful correction (grammar + "a native would say…" naturalness + better phrasing), `CORRECTION_GENTLENESS_{EN,RU}` per ageBand (featherlight for young → candid coach for adult), ONE main fix/turn. Added **`nativeLanguage`** end-to-end so corrections can be explained in the learner's L1: `system-prompts.ts` (PromptArgs + parenthetical L1 explanation), `routes/talk.ts` (zod `nullish` + pass to `buildSystemPrompt`), mobile `api.ts` (`TalkRequestPayload`), `talk.tsx` (maps `parentUILanguage` az/ru → `nativeLanguage`). Topics inherit it (they route through `/talk`). Opener (first greeting) left uncorrected by design.

### Founder decisions captured this session
- Weekly distribution (task 8): **guaranteed minimum (≥1 listening day + ≥1 conversation day per week) + AI distributes the rest** by goal/level.
- Correction: **everywhere** (free-chat + topics), with native-language explanation.
- Type sizes 13/11/10: **leave as-is** (no token).

### Task 8 — schedule-driven day-type path — ✅ DONE (2026-06-30, same session)
No DB migration needed (`focus` lives inside the lesson JSON, not a column).
- **Type chain:** added `LessonFocus = 'story_listen'|'conversation'|'vocab_grammar'|'review'` + optional `focus` to `LessonContent` & `GeneratedLesson` (`apps/api/src/db/schema.ts`), `LessonSchema` zod (`generator.ts`, `.default('vocab_grammar')`), and mobile `LessonData` (`src/data/lessons.ts`). Served `content` passes straight through as `LessonData`.
- **Generator:** prompt assigns a `focus` per day with a DISTRIBUTION RULE — **≥1 story_listen + ≥1 conversation per 7-day week**, spread out, rest `vocab_grammar`/`review`, biased by goal. Schedule-aware: `GeneratorInput.activeDaysPerWeek` from `child.scheduleDays.length`.
- **Path (mobile):** `day-plan.tsx` — added a **listening** task (`🎧 → /listening`); the day's `focus` picks the HERO (`HERO_FOR_FOCUS`: story_listen→listen, conversation→talk, else read), hero sorts first + "Сейчас" + focus-of-day banner. `home.tsx` `handleStart` routes the path node into the hero (story_listen→`/listening`, conversation→`/talk`, else `/lesson/${mode}`). Listening & conversation are now day-types woven into the path.
- **B1 window:** additive home effect fetches/caches the current day's curriculum on mount for days 1-30, shrinking the bundled-fallback window.
- **OPTIONAL polish left:** a visible "готовлю уроки…" gate on the start CTA while curriculum still generating. Standalone `/listening` & `/topics` tabs kept as extra practice.

Both apps `tsc` green. Reload Metro; create a NEW child to see focus-distributed days. Inspect `generated_weeks.lessons[].focus` in Neon after first fetch.

### Polish pass — A/B/C — ✅ DONE (2026-06-30, same session)
- **A — "preparing" state:** `home.tsx` now tracks `curriculumReady` for days 1-30 (fetches the current day on mount; `getCachedCurriculumLesson`/`fetchCurriculumLesson`). When the personalized lesson isn't cached yet, the today-hero shows a "🛠️ Готовлю уроки…" card + spinner instead of leading into the bundled fallback. (Path-tab node still leads into whatever's cached — acceptable; window is small.)
- **B — multi-goal server-side:** added `children.goals JSONB` column (**migration added to `migrate.ts` + run on Neon**). `createChildSchema` accepts `goals`; mobile sends `goals: goalsAll` (`setup/plan.tsx`); `ChildProfile.goals` + `syncChild` hydrate `goalsAll` (prefers `child.goals`, falls back to `[goal]`). Generator `goalGuidance(goals[])` now blends multiple goals (primary first); `generatedCurriculum` passes `child.goals`. `goal` (primary) kept for back-compat.
- **C — keyboard consistency:** surveyed all input screens — pet/interests/goal/login/register/album/checkpoint/topics ALREADY use ScrollView + `keyboardShouldPersistTaps`. Only `parent-add-child.tsx` lacked it → added `keyboardShouldPersistTaps="handled"` + `showsVerticalScrollIndicator={false}`. No risky restructuring of working screens. (Earlier `KeyboardAvoider` covers the 3 broken non-scroll screens from PART C #3.)

**DB migration note:** this session added `children.goals` — already run via `cd apps/api && npx tsx src/db/migrate.ts` (idempotent). API `tsx watch` auto-reloaded.

---

## PART D — P1-полировка по рыночному анализу (2026-07-03) — DONE, оба tsc-green

По итогам `context/DESIGN-MARKET-ANALYSIS-2026-07-03.md` (рынок: Duolingo/Buddy.ai/Speak и др.) реализованы 5 фич. План: `~/.claude/plans/binary-chasing-peach.md`.

1. **F2 Звуки**: `scripts/generate-sfx.mjs` (генератор WAV, перезапускаемый) → `assets/sfx/*.wav` (83KB, закоммичены), `src/services/sfx.ts` (пул плееров, НЕ трогает audio mode), `soundEnabled` в store (default true, тумблера в UI пока НЕТ), `playsInSilentMode:true` глобально в `_layout.tsx` (без allowsRecording!). Точки: quiz, quest, complete (fanfare), pet-room (boop), talk (success 0.6).
2. **F1 Волна микрофона**: `isMeteringEnabled` у recorder в talk.tsx, JS-interval 100ms → sharedValue (без ре-рендеров), `src/components/MicWaveform.tsx` (7 баров), overlay над MicButton только при записи. Android-fallback: 8 промахов metering → canned-волна.
3. **F3 Реакции**: `src/components/ReactingPet.tsx` (forwardRef, `react('correct'|'wrong')`, mood-override 1.4s + pop/тряска), `StarParticle` извлечён в `src/components/`. Quiz: мини-пет 56px абсолютно справа top:96 + звёзды; Quest: fail→sad+тряска (Bobo.tsx получил mood 'sad'); Talk: header-пет реагирует на каждый ход.
4. **F4 Счётчик**: `src/components/AnimatedCount.tsx` (rAF, cubic ease-out, pulse, tick-звук ≤12), заменил setInterval в complete.tsx.
5. **F5 Чеклист целей**: topics.tsx — `goals {ru,az,en}[]` по 3 на каждый из 8 топиков → router-параметр → talk.tsx чипы (`src/components/ObjectiveChips.tsx`) + баннер «Все цели выполнены» (продолжить/готово, без обрыва). Сервер: `objectives` в схеме `/talk` (.nullish()!), CONVERSATION GOALS блок в system-prompts (EN+RU), маркер `[[done:N]]` срезается ДО appendTurn/TTS/ответа (утечка в историю невозможна), `objectivesDone: number[]` в ответе. Regex-логика проверена unit-тестом.

**НЕ device-tested** — founder: `./run.sh lan`, перезапустить Metro, проверить: звуки (+mute switch iOS), волну (громко/шёпотом), реакции пета в quiz, счёт звёзд в complete, топик с целями (чип должен отмечаться после ответа Хани; маркер не должен звучать в TTS). Free-chat/custom topics — без чипов (goals не передаются). Опции на потом: тумблер звука в parent-settings, goals для custom-топиков.

---

## PART E — Полностью AI-план после онбординга (2026-07-03) — DONE, mobile tsc-green (API не менялся)

Запрос founder: «план только на AI, уроки соответствуют онбордингу, после онбординга генерация недели 1 с красивым прогрессом, остальное в фоне». Сервер уже был правильный (генерация стартует при createChild, on-demand регенерация недель — generatedCurriculum.ts:246); чинился UX-слой:

1. **Экран «Собираю твой план»** — НОВЫЙ `app/setup/building.tsx`: HBPet + косметические стадии (профиль/темы) + реальный прогресс-бар = `fetchFullCurriculum count / 30` (первый await = сервер достраивает неделю 1; поллинг 4s). `count>=7` → фанфары + StarParticle + «Поехали! 🚀». Ошибка (3×0) → «Повторить»/«Продолжить». Второй язык греется после недели 1. Входы: `setup/plan.tsx` (был fire-and-forget prefetch → убран) и `setup/plan-select.tsx` goFree → `/setup/building`.
2. **Путь = AI-план**: `getLessonThemes` (lessons.ts:1244) теперь curriculum-first (+флаг `ai`); в home path-tab мир с AI-планом показывает «Глава N / Fəsil N» + themeEmoji первого AI-дня недели (статичные Дом/Природа/Школа/Город — только офлайн-фолбэк); ZigzagNode: новый проп `themeEmoji` — order-locked узлы показывают приглушённый AI-эмодзи вместо 🔒 (превью пути); заголовок таба → «Твой путь · 30 дней».
3. **Единый гейт**: `home.tsx handleStart` (покрывает hero + узел пути) и `day-plan.tsx` (задачи read/lesson/story) — если день ≤30, есть childId и НЕТ кеша дня → Alert «⏳ ещё собирает урок» + kick fetchCurriculumLesson, bundled-шаблон НЕ открывается. Гость/AI-дни не гейтятся.
4. **Честная ошибка**: home-эффект больше НЕ ставит ready на ошибке; до 3 ретраев по 5s (404 = ещё генерится), затем `curriculumError` → hero-карточка «Не получилось 😕» с «Повторить» / ghost «Продолжить офлайн» (осознанный бандл).

Отложено: E-cleanup (мёртвый personalize.ts/child_curricula-путь для новых детей — не мешает). НЕ device-tested: founder — создать НОВОГО ребёнка → увидеть building-прогресс → «Поехали» → путь с «Глава 1» и AI-эмодзи; тап по узлу до готовности → алерт; авиарежим → error-карточки.

---

## PART F — Фидбэк с устройства #2 (2026-07-03) — DONE, оба tsc-green (миграция НЕ нужна)

1. **День 1 быстро, остальное в фоне**: `generatedCurriculum.ts` — новые `generateCurriculumDayOne` (1 урок одним быстрым LLM-вызовом → строка недели 1 со status='partial') и `completeWeekOne` (дни 2–7 с темой дня 1 в recentThemes → UPDATE merge, status='approved'); `generateCurriculumWeek(1)` при partial-строке делегирует в completeWeekOne (иначе фоновая полная генерация тихо пропала бы из-за onConflictDoNothing); `ensureGeneratedCurriculum`/`getGeneratedCurriculumAll` ждут только день 1; `getGeneratedCurriculumDay` при partial-неделе достраивает. Генератор параметризован под диапазон (schema min(1).max(7) + точная проверка count; промпт с dayCount, для дня 1 — «very first lesson» подсказка). Читающих фильтров по status нет — partial безопасен.
2. **building.tsx**: READY=1 (день 1), копирайт «Собираю первый урок…»/«Первый урок готов!», creep 12s.
3. **Минус «план готов»**: `setup/plan.tsx` УДАЛЁН; `schedule.tsx` → authToken ? `/setup/building?create=1` : `/auth/consent`; building в create-режиме сам делает createChild (payload из стора, guard от двойного) → syncChild → completeOnboarding → reminders → поллинг; ошибка создания → error-фаза с «Повторить». Гостевая ссылка «Попробовать день 1 без аккаунта →» перенесена на consent.tsx.
4. **Listening**: авто-генерация истории при первом входе за день (AsyncStorage `listening-autogen:<childId>`, тихие ошибки на авто-пути; кнопка осталась для доп. историй). **Двойной голос починен**: `pause()` ПЕРЕД `remove()` (remove сам не глушит играющий канал) + повторный stop после await (гонка) + busyRef sync-guard от двойного тапа. Pause-before-remove добавлен также в talk (unmount + playAudio), songs, lesson/world, lesson/pretend.
5. **Память Хани с онбординга**: `children.ts` POST — `seedChildMemory`: на каждый язык INSERT `child_memory` c фактами из интересов ('interests', «Любит X»/“Loves X”) + целей ('preferences', карта GOAL_FACT ru/en), onConflictDoNothing, non-blocking. Экран «Что помнит Хани» больше не пустой с первого дня; /talk и опенер подхватывают автоматически.

Проверка founder: НОВЫЙ ребёнок → после расписания сразу прогресс (~10–20 сек до «Поехали»); listening — история сама; память — интересы+цель видны сразу; двойного голоса нет. В Neon: неделя 1 сначала 'partial' (1 урок), затем 'approved' (7).

---

## PART G — Рыночный P2 + смягчение + внешние доки (2026-07-03) — DONE, оба tsc-green (миграция НЕ нужна)

Прошёлся по всем открытым пунктам из `project_current_state.md` подряд (auto-режим,
sequential, каждый шаг tsc-gated). 8 задач:

1. **Тумблер звука** (`parent-settings.tsx`): строка «Звуковые эффекты» теперь реальный
   `Toggle`, привязанный к store-ключу `soundEnabled` (+`setSoundEnabled`); удалён
   фейковый локальный `musicOn`/«Громкость 70%». Управляет `playSfx` глобально.
2. **Персистентность pet-room** (НОВЫЙ `services/petCare.ts` + `pet-room.tsx`): статы
   (hunger/love/energy) в AsyncStorage по childId `pet-care:<id>` c timestamp; при загрузке
   мягкий away-decay (3 pts/час) с полом FLOOR=25 (возврат не встречает «мёртвым» петом —
   осознанно, как и смягчение стрика). loadedRef гейтит запись до первого чтения; сейв на
   каждое изменение + tick. Guest → ключ 'guest'.
3. **Разблокировка значков** (`achievements.tsx`): единый источник — у каждого значка
   реальный предикат `check(stats)` + текст условия `reqRu/reqAz` + `progress()`. Убраны
   фейки: hero теперь честный («ПОСЛЕДНИЙ ЗНАЧОК» earned / «СКОРО ОТКРОЕШЬ» с условием;
   без «+50»), фильтр «Скоро:4» удалён (осталось Все/Открыто/Заблок.), прогресс-карта — к
   реально ближайшему незакрытому значку. НОВОЕ: тап по значку/hero → `BadgeModal` (RN Modal,
   ZoomIn) с эмодзи/названием/статусом/условием + star-burst у earned; sfx+haptics на тап.
4. **Смягчение стрика** (`notifications.ts`, `home.tsx`, `streak.tsx`): guilt-пуш
   `scheduleStreakRiskReminder` переписан с loss-aversion («серия в опасности, успей до
   полуночи») на тёплый freeze-aware («🍯 Хани соскучился … пропустишь — не страшно, Хани
   сбережёт серию 💛»); +param `companionName`, home передаёт `bot`. Дневное напоминание
   больше не хардкодит «Бобо» — новый хелпер `companion(isAz)` читает `petName` из стора
   (fallback Хани/Hani). Подсказка про freeze в streak.tsx — «Хани сам сбережёт серию»
   (freeze авто-применяется в home.tsx, уже было). Freeze default=1 уже был.
5. **Живость HBPet** (`HBPet.tsx`): редкие idle-жесты (наклон/потягивание/качание/вздрагивание)
   каждые 6–12 c поверх дыхания — каналы `gRot/gTx/gScaleY` в animStyle; суппресс при
   talking/sleepy/still/reduced-motion. Новые опц. пропы: `idleGestures` (default true),
   `onTap` (делает пет tappable + happy-wiggle). Существующие вызовы не тронуты (пропы опц.);
   ReactingPet композится нормально.
6. **История чата** (НОВЫЙ `services/talkHistory.ts` + `talk.tsx`): последний разговор по
   `talk-history:<child>:<lang>` (cap 12 ходов, только реальные дети); при возврате —
   приглушённая секция сверху «Хани помнит … Сегодня» (opacity 0.6, muted-пузыри). Грузится
   на [childId,language]; сейв live-истории на изменение (loadedRef гейт). Усиливает
   главный дифференциатор (память Хани — видима ребёнку).
7. **Cleanup personalize/child_curricula** — СОЗНАТЕЛЬНО НЕ вырезал перед device-QA.
   Подтвердил: `needsGeneratedCurriculum()` = литеральный `true` → весь personalize.ts/
   child_curricula путь — недостижимый `else` (для новых детей таблица не пишется, read в
   talk.ts возвращает пусто с фолбэком). Это ещё и заявленный offline-фолбэк + живой read +
   DB-миграция → риск испортить QA-сигнал. Снял путаницу doc-комментами (`needsGeneratedCurriculum`,
   шапка `personalize.ts`) + точный чеклист физического удаления на пост-QA:
   `context/CLEANUP-personalize-legacy.md`.
8. **Внешние доки** (context/): `STORE_METADATA.md` (тексты стора RU/AZ/EN + чеклист сабмита),
   `AZ-SAFETY-CRISIS-LINE.md` (ВЕРИФИЦИРОВАН веб-поиском: **116 111** Azerbaijan Child Helpline,
   24/7, оператор Azercell, источники приложены — но `AZ_CRISIS_LINE` НЕ включил сам: код
   помечен TODO(founder) «не читать неверный номер ребёнку», нужен звонок-проверка + подпись),
   `COPPA-LEGAL-CHECKLIST.md`.

### PART H — Завершение разговорного урока (2026-07-04, из device-теста) — DONE, mobile tsc-green
Founder на устройстве: разговорный урок (день 1, focus=conversation) НЕ заканчивался — 10+ мин
открытого чата. Причина: `conversation`-день уходил в `/talk?lang&day` **без** `fromLesson`/целей →
ни лимита, ни таймера, ни зачёта дня (complete не открывался → нет звёзд/стрика/продвижения; день
был непроходим). Фикс (клиент-only, без сервера):
- Новый параметр `convo=1` (+`fromLesson=1`) на разговорный вход: `home.tsx` handleStart (гл. вход с
  пути) и `day-plan.tsx` — ТОЛЬКО conversation-hero (общий talk-тайл «доп. практика» остаётся открытым).
- `talk.tsx`: мягкий предел по числу реплik ребёнка, возраст-зависимо (`convoTarget`: young 4 / mid 5 /
  teen 7 / adult 8). Индикатор-точки прогресса под шапкой (`convoTurns/target`). По достижении — фанфары+
  звёзды и баннер «🎉 Отличная беседа с Хани! · Ещё немного / Завершить ✓». «Завершить» (и header-✓ от
  fromLesson) → `/lesson/complete` (звёзды, стрик, день +1). Soft: можно продолжить после цели.
Механику выбрал сам (founder отошёл от вопроса): «по числу реплик, возраст-зависимо» — простая,
всегда завершается, только клиент. Альтернативы (чеклист-цели как в topics / таймер) — если founder
захочет иначе, легко переключить. НЕ device-tested. Проверить: разговорный день доходит до баннера и
завершается, день засчитывается (день +1, звёзды, стрик).

### PART I — Дизайн-ревью + полировка (2026-07-04) — В ПРОЦЕССЕ, mobile tsc-green
Founder: «пройдись по дизайну, где можно улучшить». Провёл аудит (2 read-only Explore-агента:
онбординг + ~16 контент-экранов) + сам смотрел токены/paywall/home. Нашёл главную тему: система
Honeybear отличная, но ~дюжина экранов протекает **чужеродными цветами** (холодная лаванда/фиолет,
Tailwind amber, лавандовый градиент) → читается «templated». План P0–P6 (задачи #9–16). Сделано:
- **P0 — компаньон в онбординге:** `welcome`/`name` со старого `<Bobo>` на `<HBPet>`; `schedule`
  (был «Бобо»!) и `notify` теперь через `useCompanionName()`. (goal/profile-type/interests — до
  выбора питомца/взрослый профиль, там дефолт «Хани» корректен, не трогал.) Убрал мёртвый `Ribbon`.
- **P1a — токены:** в `decor.ts` добавлены `sceneTints`/`sceneRings` (brand-набор чередующихся тинтов
  вместо фиолета) + `semantic` (gold/warn/danger soft+deep). Реэкспорт в `theme/index.ts`.
- **P1b — миграция (10 файлов):** убрал холодную лаванду `#EAE6FF/#6B54E0` → sky/english в
  read/photo-learn/album/progress/story; фиолетовые темы space/games → sky/berry в checkpoint+interests;
  Tailwind amber warningBox в profile-select → butter-токены; лавандовый градиент шапки parent → тёплый
  peach→cream; StatCard-акценты parent (#FF6B35/#E8A000) → primary/butterDeep. Тёплый хвост (золото/красный
  в parent-summary/songs alert-bg) ОСТАВЛЕН — менее режет, свипнуть позже семантик-токенами.
- **P5a — paywall:** блёстки `✦` теперь мерцают (`TwinkleStar`, reduced-motion ок) вместо статики;
  добавлена карточка **сравнения «Бесплатно vs Premium»** (4 строки — дни/разговоры/память/отчёты; честность
  = маркетинг); тестимониалы `#FFF6D0`→`tints.butter`; имя компаньона через `useCompanionName`.

- **P2 (core) — каркас онбординга:** ручные glow-кнопки (жгли зарезервированный `shadow.glow`) на
  name/goals/level/schedule → `HBButton` (паттерн `variant={ok?'primary':'soft'}`); единый CTA-копирайт
  «Продолжить»/«Davam et» (убрал стрелки; эмодзи только на финальном schedule); двойной прогресс на
  age/pet убран (оставлены точки StepIndicator, текст «Шаг X/7» удалён). **P2b ОТЛОЖЕН** (риск/лейаут,
  нужны глаза): конвергенция фона (`Screen` vs `PaperBackground`), единый размер заголовка (36/30/24),
  back-кнопки на всех шагах (осторожно — часть входов без back-стека, можно застрять).
- **P4 — токены шрифта:** в `typography.ts` добавлены `3xs:10 / 2xs:11 / caption:13 / button:17` (те же
  пиксели, что использовались сырыми). Массовую замену НЕ делал — founder ранее просил «оставить 13/11/10».
- **P6 — выбор цвета приложения (MVP):** элегантно — **цвет приложения = цвет питомца** (отдельного пикера
  нет, тот что в `setup/pet` теперь и цвет приложения; добавлена подсказка). Новые `src/theme/accent.ts`
  (`accentFor(hue)` → {top,bottom,text,soft} для 7 оттенков питомца) + `src/hooks/useAccent.ts` (читает
  petHue). Проведено в **`HBButton` variant `primary`** (одна точка рычага → все главные кнопки приложения
  носят цвет питомца). Дефолтный honey (hue 55) resolve-ится в текущий персик пиксель-в-пиксель → у не
  менявших цвет НОЛЬ изменений. Прогресс-бары/кольца/hero пока НЕ провёл (peach) — расширить после ревью.

- **P6-расширение:** акцент (=цвет питомца) проведён не только в кнопки, но и в самые заметные fill-поверхности:
  дневная цель на home (`goalFill`), кольцо hero стрика (`ringColor`), прогресс-бар к значку. Тема стала цельной.
  Ещё не провёл: узлы пути home, второстепенные прогрессы — расширить при желании (тот же `useAccent().bottom`).
- **P3 — HBIconBox:** приняли в `album` (sectionIconBox) и `progress` (reviewIcon ×2, заодно убил сырые
  `#FFF8D6`/`#B8930A`). `parent-summary` (cardIconBox ×7) — чистый дедуп с нулевым визуалом, ОСТАВЛЕН хвостом.

**Осталось (хвост, низкий приоритет):** ~~P3-tail (parent-summary cardIconBox ×7)~~ ✅ СДЕЛАНО
2026-07-08 (7× `HBIconBox glyph tint size=36 rounding=radius.md glyphSize=18` — пиксель-в-пиксель,
стиль `cardIconBox` удалён, tsc-green). Осталось ВИЗУАЛЬНОЕ/вкусовое (нужны глаза founder'а, придержано):
P5c — разнообразие hero-состояний home. P2b — фон/размер заголовка/back-кнопки в онбординге
(риск лейаута). Тёплый хвост хекс-ЦВЕТОВ (parent-summary lessonStars `#E8A000`; mistakeChip
`#FFF3E0`/`#C76A1A`; songs alert-bg) → `semantic`-токены — НЕ применял, у всех видимый Δ оттенка.
Расширение P6 (акцент=цвет питомца) на узлы пути home.

**Founder device-QA этого батча (P0/P1/P5a):** глянуть перекрашенные экраны — read/story/album/progress
(бывшая лаванда → голубой sky), photo-learn/checkpoint/interests (space/games больше не фиолет),
profile-select (жёлтый warning вместо amber), parent (шапка peach→cream, StatCards peach/gold/sky),
paywall (мерцание + таблица сравнения); онбординг: один и тот же питомец Хани везде, имя не «Бобо».

### PART J — Смешанная речь в разговоре: понимание ru/az + перевод на лету (2026-07-04) — DONE, api tsc-green, e2e-verified live
Founder: самое ценное — чтобы во время беседы Хани понимал вставки на русском/азербайджанском
(«I am a web developer, but рынок сейчас сдох») и давал английский вариант. Реализовано, server-only
(клиент уже слал `nativeLanguage` = parentUILanguage):
- **`ai/stt.ts`**: `transcribe(..., {codeSwitch: 'ru'|'az'|null})`. ВАЖНЫЙ вывод теста: Deepgram
  nova-3 `language:'multi'` НЕ ловит короткие русские вставки в англ. фразе (залипает на en) —
  проверено на реальном аудио. Решение: **ru-гибрид** — Deepgram(en) + OpenAI `gpt-4o-mini-transcribe`
  параллельно (Promise.all, латентность не растёт — mini ~0.6-1s); кириллица в OpenAI-транскрипте →
  берём его (words=[], confidence=1), чистый en → берём Deepgram (по-словные confidence для
  pronunciation-hints сохранены). **az → только OpenAI** (Deepgram az не поддерживает вообще).
  Prompt-подсказка STT: "learner speaking English, sometimes mixing in Russian… keep each language
  in its own script".
- **`routes/talk.ts`**: codeSwitch включается когда `nativeLanguage !== language`; гейт «скажи чётче»
  пропускается при кириллице в en-транскрипте (это осознанный code-switch, не плохое произношение).
  Только главный `/talk`; word-check остался строго одноязычным.
- **`ai/system-prompts.ts`**: `languageRulesEN/RU` — при известном L1 вместо «Speak ONLY English»:
  вставки на родном = хорошее усилие; понять всю мысль → дать англ. вариант → продолжать на англ.;
  прямой ответ на «как будет X?» (слово + мини-пример). Без L1 — старое строгое правило.
- **E2E verified** (TTS-синтез смешанных фраз → POST /talk на живой сервер): «…but рынок сейчас
  сдох» → транскрипт дословный, ответ «in English: "the market is dead right now" — what caused
  that?»; «Как будет воробей?» → «"sparrow" + пример»; чистый английский → Deepgram-путь без
  регрессий; az «amma hava çox istidir» → понял и перевёл. Скрипт: scratchpad e2e-codeswitch.mjs.
- Стоимость: +$0.003/мин STT только на ru-native en-уроках (параллельный mini). Осталось проверить
  на устройстве с живым микрофоном (шум/детская речь).

### PART K — Founder-фидбэк 2026-07-04, батч 2 (грамматика/клавиатура/wrap/плейсмент) — DONE, оба tsc-green
1. **Грамматика curriculum-first** (`app/lesson/grammar.tsx`): снят гейт `dayNum > 30` — AI-грамматика
   (по уровню) теперь для ВСЕХ дней; статический A1-набор («My name is Bobo») остался только
   офлайн/pre-cache фолбэком. В `generator.ts` CRITICAL RULES дополнены: сложность грамматики обязана
   соответствовать CEFR (B1+: смешанные времена/модальные/условные/пассив; order_words 6+ слов).
2. **Клавиатура** (`components/KeyboardAvoider.tsx`): переписан с RN KeyboardAvoidingView (меряет
   позицию относительно РОДИТЕЛЯ → внутри SafeAreaView недосчитывает top-inset ~59px, кнопка уезжала
   под клавиатуру) на точную математику: `measureInWindow` собственного низа + `keyboardWillChangeFrame`
   → паддинг = точное перекрытие, анимация Reanimated с duration из события. Потребители: setup/name,
   auth/forgot, auth/verify-email. Android без изменений (adjustResize). Prop `offset` удалён (никто не юзал).
3. **Разговорный урок = время + AI-закругление** (заменил turn-count из PART H):
   - Клиент `talk.tsx`: `targetTalkSeconds(level, ageBand, goalsAll)` — young 3 мин … adult 7, +2 за
     intermediate, +2 за цель move/communication/travel, cap 12 (B2+заграница ≈ 10-11 мин); шлёт
     `sessionElapsedSec/sessionTargetSec` в /talk; баннер завершения по `response.wrapSuggested`
     (+страховка 1.5×target, если модель не поставила маркер); прогресс — полоска времени+таймер m:ss
     вместо точек (тик 1с).
   - Сервер: схема /talk + `system-prompts.ts` (блоки SESSION TIMING, «время вышло» вычисляет СЕРВЕР,
     не модель); **ключевой урок**: gpt-4o-mini игнорировал wrap-инструкцию в середине промпта
     (конфликт с «always end with a question», recency bias) → `llm.ts` получил `postInstruction` —
     system-сообщение ПОСЛЕ реплики ученика; wrap-команда идёт туда → работает стабильно. Маркер-цикл
     в talk.ts теперь чистит стек `[[done:N]] [[wrap]]`, отдаёт `wrapSuggested`.
   - **E2E-verified** (scratchpad e2e-wrap.mjs): время вышло → тёплое завершение с конкретной похвалой
     без вопроса + wrapSuggested:true; время есть → обычный разговор; раннее «bye» → wrap сразу.
     Маркер не течёт в текст/TTS.
   - Попутно: `resolveLessonContext` обёрнут в try/catch — guest-childId (не UUID) ронял ВЕСЬ /talk
     500-кой (пре-существующий баг, найден e2e-тестом).
4. **Плейсмент адаптивный** (`setup/placement.tsx`): пул по ярусам A1/A2/B1/B2 (EN 5×4, RU 4×4),
   лестница — старт A2, верно→вверх/неверно→вниз, 6 вопросов, рандомный выбор из яруса (тест каждый
   раз разный); уровень = ярус после последнего ответа → B2 зарабатывается ответами на реальные
   B2-вопросы (unreal conditionals, passive, reported speech, future perfect). UI/скип не менялись.

### PART L — Founder-фидбэк 2026-07-04, батч 3 (мульти-дети/клавиатура-2/level-first/уровневые механики) — DONE, оба tsc-green
1. **Дневная цель протекала между детьми** (`store/settings.ts`): `starsEarnedToday/starsResetDate` —
   девайс-локальные и не сбрасывались в `syncChild`. Теперь стэш/восстановление per-child:
   новый persisted-ключ `starsTodayByChild: Record<childId,{date,stars}>`; при переключении профиля
   счётчик уходящего ребёнка стэшится, входящего — восстанавливается (0, если дата не сегодня);
   re-sync того же ребёнка держит живой счётчик; `currentLessonErrors` тоже чистится при смене.
2. **Клавиатура №2 — экран ИМЕНИ ПИТОМЦА** (`setup/pet.tsx`, founder уточнил: «не имя ребёнка, а имя
   робота»): там ScrollView вообще БЕЗ обработки клавиатуры + инпут в середине под петом 180px →
   инпут за клавиатурой. Фикс: `KeyboardAvoider` (CTA в footer) + новый хук
   `src/hooks/useKeyboardVisible.ts` — пока клавиатура открыта, пет сжимается (132→72, подиум 180→96),
   инпут остаётся видимым без скролла. Попутно тем же батчем `parent-add-child.tsx` переведён с
   raw-KAV на `KeyboardAvoider` + снят пропущенный дизайн-пассом мусор (`<Bobo>`→`<HBPet>`, лаванда →
   бренд-градиент).
3. **Level-first, тест опционален** (founder: «выбрал уровень сам — теста не надо»): `age.tsx` больше
   НЕ роутит 14-16 в placement — все идут в `level.tsx`; там для 14-16 ссылка «🤔 Не уверен — быстрая
   проверка (1 мин)» → placement; «выберу сам» в placement теперь `router.back()` (level всегда родитель).
4. **Уровневые механики урока** (founder: «зачем B2 составлять предложения — через общение и тексты»):
   новый `src/utils/lessonFlow.ts` — `isMatureLearner(level, ageBand)` (teen/adult ИЛИ B1+),
   `lessonEntryRoute`/`afterReadingRoute`. Kid-flow прежний (quest/tpr/pretend/world → word-game →
   grammar → talk). **Mature-flow: read (текст) → grammar (уровневая, PART K) → talk** — без «скажи
   волшебное слово», без эмодзи-word-game. Проведено в 5 точках: home.tsx handleStart (убран локальный
   LESSON_MODES), day-plan.tsx (тайл «Урок дня» через onPress-override), read.tsx (после чтения),
   story.tsx (после приключения), complete.tsx (тизер «завтра» для mature = «Текст и разговор», не
   «Двигайся с Хани»). Плюс generator.ts: MATURE LEARNER RULE в DISTRIBUTION — teen/adult/B1+ получают
   ≥2 conversation-дня и больше story_listen, минимум чистых vocab_grammar.

### PART M — Grammar: нерешаемые order_words + застревание (2026-07-04, скрин founder) — DONE, оба tsc-green
Скрин: «Form a sentence: summer/soccer/playing/enjoy/they» — correct-ответ модели содержал «in»,
которого НЕТ среди плиток → собрать невозможно, ребёнок застревал навсегда (после ошибки упражнение
просто сбрасывалось). Плюс вопрос был из СТАРОГО плана (сгенерён до уровневых правил PART K). Фиксы:
1. **Solvability guard на клиенте** (`grammar.tsx`): если multiset(options) ≠ multiset(correct) —
   плитки перестраиваются из correct (чинит и уже сгенерённые кривые планы в БД без регенерации).

2. **3 неудачи → reveal → дальше** (`grammar.tsx`): failsRef; после 3-й ошибки жёлтый бейдж
   «💡 Правильный ответ: …» (для order_words правильный порядок показывается в sentence box),
   через ~2с авто-advance. Ошибка уже логируется recordLessonError — день засчитывается, слабое
   место уходит в review. Новое состояние ExerciseState 'reveal'.
3. **Сервер** (`generator.ts`): та же санитизация после валидации (options := shuffled correct при
   несовпадении) + правило в промпт: «order_words options MUST contain EXACTLY the same words as
   correct». Не роняем неделю — чиним упражнение.

### PART N — Talk: русский opener в EN-уроке + STT-каша на чисто-русской речи (2026-07-04, скрины) — DONE, api tsc-green
1. **Opener по-русски при языке урока EN**: в промпте `/talk/opener` НЕ было правила языка, а память
   Хани засеяна по-русски (интересы/цель из onboarding) → модель уходила за памятью в русский.
   Фикс: первое правило в обоих вариантах промпта — «LANGUAGE — CRITICAL: greeting in English ONLY;
   memory notes may be in Russian/Azerbaijani — use their MEANING».
2. **«Atomosia tvechnaruscom» (каша)**: founder говорил ЦЕЛИКОМ по-русски; сначала чинил гибрид
   (confidence<0.55 → OpenAI), но на девайсе всё равно не решилось → **founder решил: в разговоре
   ВСЕГДА OpenAI** («пусть всегда пытается понять openai»). `stt.ts`: codeSwitch-путь = только
   `gpt-4o-mini-transcribe` (fallback на Deepgram лишь при пустом ответе); Deepgram остался для
   строгих одноязычных вызовов (word-check, quest). Гибрид удалён. Бонус: STT стал быстрее
   (~560-780ms вместо 1200-2500ms). Лог `[stt] openai(codeSwitch)=...`. Побочный эффект:
   pronunciation-hints («скажи чётче» + подсветка слов) в talk теперь не срабатывают никогда
   (нет per-word confidence) — осталось в quest/word-check. E2e: чисто-русская и чисто-английская
   фразы → дословно. NB: у founder перед кашей были 2 пустых транскрипта подряд — на девайсе
   проверить микрофон/длительность записи (короткие тапы дают пустое аудио).
   **НАСТОЯЩИЙ корень (найден после «всё ещё не работает»)**: на девайсе codeSwitch вообще не
   включался — `nativeLanguage` выводится из `parentUILanguage`, который в сторе может быть null
   (переустановка/Expo Go clear; syncChild его не заполняет), фолбэка не было → undefined →
   Deepgram-en → пусто/каша. Двойной фикс: клиент talk.tsx шлёт `'ru'` фолбэком; сервер talk.ts
   сам дефолтит `native = body.nativeLanguage ?? 'ru'` (клиент больше не может это сломать) +
   лог `[talk] codeSwitch=`. E2e-verified: запрос БЕЗ nativeLanguage → русская фраза дословно.
3. **Латентность**: бейдж 3099ms = только сервер (STT≈1-2.5s + LLM≈1-2s + TTS≈0.7-1s) — это норма
   текущей архитектуры; ощущаемая задержка добавляется загрузкой base64-аудио туда-обратно и стартом
   плейбека. Ускорение = стриминг (STT streaming + TTS chunk) — отдельный проект, в бэклоге.

**НЕ device-tested.** Founder-проверка: тумблер звука в родит.настройках гасит sfx; pet-room
статы сохраняются между входами (и мягко тают за ночь, не в ноль); тап по значку → модал с
условием, звёзды у открытых; стрик-пуш вечером тёплый (не «в опасности»); HBPet иногда
наклоняется/потягивается; talk при повторном входе показывает «Хани помнит» с прошлым
разговором. Решение по AZ_CRISIS_LINE (116 111) — за основателем.
