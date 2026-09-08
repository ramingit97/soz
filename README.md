# Söz

Bilingual AI language tutor for children — English + Russian, built for
Azerbaijan. A child talks to Хани (Bobo), an AI bear, by voice; a parent gets a
report, a streak, and a crisis alert if the child says something worrying.

## Stack

- **Mobile**: React Native + Expo SDK 54 (Expo Router), zustand, RevenueCat
- **Backend**: Node 22 + Hono + Drizzle, deployed as an esbuild bundle on Fly.io
- **DB**: PostgreSQL (Neon)
- **AI**:
  - OpenAI — `gpt-5.6-terra` for what the child hears, `gpt-4o-mini` for the
    classifiers (safety screen, memory, interests, photo, songs, analysis),
    `gpt-4o` for week generation. All three are env-overridable — see
    `apps/api/src/ai/models.ts`.
  - Deepgram Nova-3 — speech-to-text (strict single-language)
  - ElevenLabs — Bobo's voice (OpenAI `tts-1` as fallback)
- **Email**: Resend (reset codes, verification, crisis alerts)
- **Payments**: RevenueCat → webhook → `users.premium_until` (server is the
  source of truth; the client only draws the paywall)
- **Errors**: Sentry (optional)

There is no Anthropic, Gemini or Redis in this codebase. The rate limiter is
in-process, which is why `fly.toml` pins `min_machines_running = 1`.

## Structure

```
.
├── apps/
│   ├── api/               # Hono backend  (pnpm --filter @soz/api …)
│   └── mobile/            # Expo app      (pnpm --filter @soz/mobile …)
└── packages/
    ├── shared-types/      # Types + the streak rule shared by app and API
    └── content/           # Bundled lesson content (days 1–30 fallback)
```

## Prerequisites

- Node 22 (`.nvmrc`), pnpm 10 via corepack
- For Android: Android Studio + emulator, or a physical device
- For iOS: a Mac, or EAS Build

## Getting started

```bash
corepack pnpm install

cp apps/api/.env.example    apps/api/.env      # fill in keys
cp apps/mobile/.env.example apps/mobile/.env

# Create tables (idempotent — safe to re-run)
corepack pnpm --filter @soz/api migrate

# Backend, hot reload
corepack pnpm --filter @soz/api dev

# Mobile
corepack pnpm --filter @soz/mobile start
```

## Scripts

| Command | What |
|---|---|
| `pnpm --filter @soz/api dev` | API with hot reload (tsx) |
| `pnpm --filter @soz/api build` | Production bundle → `apps/api/dist` |
| `pnpm --filter @soz/api start` | Run the bundle |
| `pnpm --filter @soz/api migrate` | Create/upgrade tables |
| `pnpm --filter @soz/api test` | Unit + integration tests (integration skips without `DATABASE_URL`) |
| `pnpm --filter @soz/api exec tsx src/scripts/check-email.ts <addr>` | Send one real email through Resend |
| `pnpm --filter @soz/mobile start` | Expo dev server |
| `pnpm typecheck` | All packages |
| `pnpm test` | All packages |

## Tests

Built-in `node:test` + `tsx`, no framework. Three tiers:

- `packages/shared-types` — the streak rule, pure
- `apps/mobile` — the offline progress queue, with AsyncStorage and the network stubbed
- `apps/api` — safety screen and cost/spend units; progress, crisis escalation
  and session revocation run against the real dev database because their bugs
  live in the DB interaction

## Release

See `RELEASE.md`.
