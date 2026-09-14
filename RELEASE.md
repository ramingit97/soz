# Söz — Release Guide (Android first)

Everything below is in the order it has to happen. Each step names who does it:
**you** (an account, a key, a click in a console) or **code** (already done —
just run the command). iOS is at the end; nothing before it depends on Apple.

Working directory for all commands: the repo root, with `corepack pnpm`.

---

## 0. Before anything

```bash
corepack pnpm install
corepack pnpm typecheck        # 4 packages, all clean
corepack pnpm test             # 3 packages; api integration needs DATABASE_URL
```

Decide and write down (they end up in env and policy text):

- [ ] The **app email** — the address the stores, Resend and RevenueCat will
      know. Goes into `eas.json` (submit), `STORE_METADATA.md` (support) and
      `RESEND_FROM`.
- [x] **Transcript retention** — 90 days after the last turn (decided
      2026-08-25). Enforced by `services/retention.ts`, stated in the policy.
      Override with `TRANSCRIPT_RETENTION_DAYS`.
- [x] **Abuse alerts** — parent AND operator, always (decided 2026-08-25).
      `SAFETY_OPERATOR_EMAIL` is required in production.

---

## 1. Database — Neon

**You:** create a project, copy the connection string.

**Code:** tables are created on every boot of the container, and can be run by hand:

```bash
DATABASE_URL="postgres://…" corepack pnpm --filter @soz/api migrate
```

---

## 2. Email — Resend

**You:**
1. Sign up, add the sending domain, complete DNS verification (SPF/DKIM). An
   unverified domain is *accepted* by the API and then silently dropped.
2. Create an API key.

**Code — verify it actually arrives** (sends one real email):

```bash
cd apps/api
RESEND_API_KEY="re_…" RESEND_FROM="Söz <hello@YOUR-DOMAIN>" \
  corepack pnpm exec tsx src/scripts/check-email.ts you@example.com crisis
```

Check the inbox, not just the exit code. This is the path password reset and
the **crisis alert** ride on.

---

## 3. API — Fly.io

**You:** install `flyctl`, `fly auth login`.

```bash
cd apps/api
fly launch --no-deploy            # accept the existing fly.toml; app name soz-api

fly secrets set \
  DATABASE_URL="postgres://…" \
  JWT_SECRET="$(openssl rand -base64 48)" \
  OPENAI_API_KEY="sk-…" \
  DEEPGRAM_API_KEY="…" \
  ELEVENLABS_API_KEY="…" \
  ELEVENLABS_VOICE_ID_EN="…" ELEVENLABS_VOICE_ID_RU="…" \
  RESEND_API_KEY="re_…" RESEND_FROM="Söz <hello@YOUR-DOMAIN>" \
  RESEND_REPLY_TO="ramin.web.97@gmail.com" \
  REVENUECAT_WEBHOOK_SECRET="$(openssl rand -hex 24)" \
  SAFETY_OPERATOR_EMAIL="ramin.web.97@gmail.com" \
  AI_DAILY_BUDGET_USD="20"

fly deploy
```

`JWT_SECRET`, `RESEND_API_KEY`, `REVENUECAT_WEBHOOK_SECRET` and `SAFETY_OPERATOR_EMAIL` are **required** —
`src/index.ts` refuses to start without them. Keep the RevenueCat secret; step 4
needs it.

Verify:

```bash
curl https://soz-api.fly.dev/health/ready
# {"status":"ready","checks":{"db":{"ok":true,…},"env":{"ok":true}}}
```

Model choice lives in env, no rebuild: `OPENAI_CHAT_MODEL` (default
`gpt-5.6-terra`), `OPENAI_FAST_MODEL` (default `gpt-4o-mini`),
`OPENAI_GENERATOR_MODEL` (default `gpt-4o`).

Do **not** raise `min_machines_running` above 1 — the rate limiter and the
daily quota shown to parents are in-process.

---

## 4. Subscriptions — RevenueCat + Play Console

**You, in Play Console** (needs the developer account from step 6):
1. Monetize → Subscriptions → create `soz_premium_monthly` and
   `soz_premium_annual` — **$13.00/month and $99.99/year** (decided 2026-09-08;
   the reasoning is in `STORE_METADATA.md`). Set the price PER COUNTRY, not one
   worldwide: for Azerbaijan price it in manat (~22 AZN).

   Nothing in the app hardcodes a price — `paywall.tsx` renders
   `product.priceString` from RevenueCat — so changing a price here needs no
   rebuild. Changing it AFTER people subscribe is a different matter: existing
   subscribers keep their price and Google requires notifying them, so get it
   right before the first paying user.

**You, in RevenueCat:**
1. New project → add Android app, package `az.soz.app`.
2. Entitlement **`premium`** (the exact string — `subscriptions.ts` looks it up).
3. Import the two products, attach both to `premium`, build a default Offering.
4. Integrations → Webhooks → URL `https://soz-api.fly.dev/billing/webhook`,
   Authorization header = the `REVENUECAT_WEBHOOK_SECRET` you set in step 3.
5. Copy the **Android public API key** (`goog_…`).

**Code:** put the key in `apps/mobile/eas.json` under `build.production.env`
and `build.preview.env` as `EXPO_PUBLIC_RC_ANDROID_KEY`. Without it
`initPurchases()` no-ops and the paywall never appears — which is why you have
not seen it in development.

The webhook is the **only** thing that writes `users.premium_until`. Test it:
RevenueCat → Webhooks → "Send test event" → `GET /billing/status` with that
user's token must return `isPremium: true`.

---

## 5. Legal pages

**You:** host `legal-site/` (three static HTML files) anywhere public —
your domain, GitHub Pages, Netlify. The store forms need these to open:

- `https://YOUR-DOMAIN/privacy`  ← mandatory for Google Play, mandatory for kids
- `https://YOUR-DOMAIN/terms`
- a support URL or email

Then update `STORE_METADATA.md` and the in-app links (`app/legal/`) if the
domain differs from `YOUR-DOMAIN`.

---

## 6. Google Play Console

**You:**
1. Developer account (one-time $25). Identity verification can take days —
   start early.
2. Create app: package `az.soz.app`, category Education.
3. **Target audience & content** → include children → this triggers the
   Families policy questionnaire. Answer honestly: the app records the child's
   voice and sends it to third-party AI providers (OpenAI, Deepgram,
   ElevenLabs) for processing. Have DPAs with each ready to reference.
4. **Data safety** form — `STORE_METADATA.md` §Privacy lists what to declare.
5. Setup → API access → create a **service account** with "Release manager"
   on this app → download JSON → save as `apps/mobile/google-service-account.json`
   (git-ignored).

---

## 7. Build — EAS

**You:** Expo account, then log in.

`eas-cli` is a pinned devDependency of `apps/mobile` — do NOT use `npx eas-cli`.
npx resolves it into a shared cache that has broken here before
(`ERR_MODULE_NOT_FOUND` on `is-docker`), and it silently floats the version
between machines.

```bash
corepack pnpm --filter @soz/mobile exec eas login
```

```bash
cd apps/mobile
corepack pnpm --filter @soz/mobile exec eas init                      # writes EAS_PROJECT_ID → apps/mobile/.env

# First real native build. This is the first time the new plugins
# (image-picker, notifications) get compiled — expect to fix something here.
corepack pnpm --filter @soz/mobile exec eas build --platform android --profile preview
```

Install the resulting `.apk` on a real phone (not Expo Go — purchases,
notifications and the mic mode are native).

**Test on the device, in this order:**

- [ ] Fresh install → guest trial works (no sign-up) → lesson 1 → talk to Хани
- [ ] Mic permission prompt text is yours; camera prompt appears in Photo-learn
- [ ] Parent screen shows "Разговоров сегодня: осталось N из 30"
- [ ] Register → the guest's progress survives → verification email arrives
- [ ] Forgot password → code email arrives → old session is logged out
- [ ] Airplane mode → finish a lesson → back online → progress synced
- [ ] Day 8 → paywall → sandbox purchase (Play Console → License testing, add
      your Google account) → `GET /billing/status` says premium
- [ ] Say something alarming → Хани gives the safe reply → parent gets the
      email → alert visible in parent report
- [ ] Notification arrives with the white Bobo icon, not a purple square

---

## 7a. Обновления без пересборки — EAS Update

Настроено 2026-09-11. Раздаёт **только JS**: вёрстку, стили, тексты, логику.
Нативную часть (новый модуль, разрешение, плагин в `app.config.ts`) обновить
так нельзя — там нужна новая сборка.

Проверено 2026-09-13: первое обновление ушло в `preview`, runtime
`1a02f26809db28d65c05866f86f7c217a7b57f52`, принимает сборка `f3eb38b0`
(коммит `5a1a0f8`). Если загрузка падает с «Asset processing timed out» —
это временное на стороне EAS, повторный запуск той же команды проходит.

**Не трогать `scripts` в `apps/mobile/package.json`.** Отпечаток нативной части
(`runtimeVersion`) считается в том числе по разделу `scripts` — источник
`packageJson:scripts`. Добавленная туда строка меняет runtime, и установленные
сборки молча перестают принимать обновления. Проверено 2026-09-14: одна строка
`check-ui` сдвинула отпечаток с `1a02f268…` на `8a6194c1…`. Вспомогательные
скрипты запускать напрямую (`node scripts/…`). Новые JS-зависимости без нативного
кода (иконки, шрифты) отпечаток не меняют. Перед публикацией сверять:

```bash
cd apps/mobile && npx expo-updates fingerprint:generate --platform android   # hash == runtime сборки
```

Опубликовать правки на уже установленные приложения:

```bash
# в ту же ветку, что у сборки: preview / production / development
corepack pnpm --filter @soz/mobile exec eas update --branch preview -m "что поменялось"
```

**Адрес API берётся из `apps/mobile/.env.production`, а не из `eas.json`.**
Блок `env` в профилях `eas.json` действует только на `eas build`. `eas update`
собирает бандл локально через `expo export` с `NODE_ENV=production`, и Expo CLI
читает переменные из `.env.production` (файл в git, значение публичное). Без
него `api.ts` запёк бы в бандл `localhost:3000`, и все установленные приложения
остались бы без сервера после обновления. Проверить перед публикацией:

```bash
cd apps/mobile && ../../node_modules/.bin/expo export --platform android
strings -n 10 dist/_expo/static/js/android/*.hbc | grep -c soz-api.fly.dev   # >= 1
strings -n 10 dist/_expo/static/js/android/*.hbc | grep -c localhost:3000    # 0
```

Обновления получают только сборки, собранные **после 2026-09-11** — с
`expo-updates` внутри. APK от 2026-09-08 (`522b13d7…`) обновляться не будет,
его нужно заменить новой сборкой профиля `preview`.

Приложение подтягивает бандл при следующем запуске. `fallbackToCacheTimeout: 0`
означает, что на старте оно НЕ ждёт сети: открывается на том бандле, что уже
внутри, а новый скачивается в фоне и применяется со следующего запуска. Поэтому
после публикации пользователь видит изменения на второй перезапуск, не на первый.

Канал задаётся в `eas.json` для каждого профиля (`development`, `preview`,
`production`) и вшивается в сборку.

**`runtimeVersion` — политика `fingerprint`.** Это хеш нативной части проекта.
Обновление уходит только на те сборки, чья нативная часть совместима. Защита от
конкретной аварии: добавил нативный модуль, опубликовал JS с его вызовом — при
политике `appVersion` такой бандл прилетел бы на старые сборки и уронил
приложение у всех сразу. При `fingerprint` он им просто не предложится.

Практическое следствие: **меняешь нативные зависимости → нужна новая сборка**,
старые перестают получать обновления. Список того, что меняет fingerprint:
зависимости с нативным кодом, плагины, разрешения, `app.config.ts` в нативной
части.

Посмотреть опубликованное: `eas update:list --branch preview`.
Откатиться: `eas update:republish` на предыдущий апдейт.

---

## 8. Submit

```bash
cd apps/mobile
corepack pnpm --filter @soz/mobile exec eas build  --platform android --profile production   # .aab
corepack pnpm --filter @soz/mobile exec eas submit --platform android --profile production   # → internal track
```

Promote internal → closed testing → production in Play Console. Google's first
review of a Families app is the slow one (days to a week); later updates are
faster.

---

## 9. Watch after launch

- Fly: `fly logs` — look for `[spend] AI budget exceeded` and `[safety]` lines.
- `ai_spend_daily` table — one row per day, `by_kind` shows where the money goes.
- `safety_alerts` table — every crisis, with whether the email went out.
- Sentry, if `SENTRY_DSN` is set on both API and app.

---

## iOS (later)

Apple Developer Program ($99/yr) → App Store Connect app with bundle
`az.soz.app` → fill `eas.json` `submit.production.ios.ascAppId` and
`appleTeamId` → RevenueCat iOS app + `EXPO_PUBLIC_RC_IOS_KEY` → App Store
subscription products → Kids Category questionnaire →
`eas build --platform ios --profile production` → `eas submit`.
