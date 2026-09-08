# Cleanup checklist — legacy personalize / child_curricula path

**Status: DEFERRED until after device QA (2026-07-03).** Intentionally not removed
pre-QA — it's live-adjacent (a read in talk.ts, a DB table, curriculum-serving
branches) and doubles as the offline/static fallback. Ripping it out right before
a QA pass would muddy the QA signal. This file is the ~20-min job for later.

## Why it's inert (not dead — retained fallback)
`services/generatedCurriculum.ts:needsGeneratedCurriculum()` returns a literal
`true`, so EVERY child is served by the AI-generated curriculum. Every code path
guarded by `!needsGeneratedCurriculum(...)` (the `else` branches) is therefore
never executed for a real child. For new children `child_curricula` is never
written (createChild calls only `ensureGeneratedCurriculum`), so any read of it
returns empty and callers already fall back gracefully.

## If/when removing (do all together, then migrate + tsc both apps)
API (`apps/api/src`):
- `services/personalize.ts` — delete the module (`personalizeDay`, `personalizeWeek`,
  `invalidateLessonsFrom`).
- `routes/lesson.ts` — remove the `import { personalizeDay, personalizeWeek }` and the
  non-generated serving branches (~lines 348-351 `personalizeDay`, and the all-days
  endpoint's `childCurricula` select + `personalizeWeek` at ~409/412). Keep only the
  `needsGeneratedCurriculum` → `getGeneratedCurriculumDay` path.
- `routes/children.ts` — in `POST /:id/preferences`, drop the `else` branch
  (`invalidateLessonsFrom` + `personalizeWeek`); keep `regenerateGeneratedCurriculumFrom`.
  Remove the `personalize.js` import.
- `routes/talk.ts` — remove the `childCurricula` join/read used for conversation
  context (~lines 73-79); it returns empty for all new children. Confirm the route's
  no-row fallback still stands.
- `services/curriculum.ts` — remove the `childCurricula` insert (~line 116) and, if it
  becomes unused, the whole static-seed helper.
- `db/schema.ts` — drop the `childCurricula` table definition.
- `db/migrate.ts` — add `DROP TABLE IF EXISTS child_curricula;` (after confirming no
  legacy child still depends on it) and remove the CREATE/ALTER for it.
- `ai/skin.ts` — only referenced by personalize.ts; delete if nothing else imports it.

Mobile (`apps/mobile`): audit `src/data/lessons.ts`, `app/home.tsx`, `app/listening.tsx`
for the word "personalize" — most are unrelated wording, but confirm no client call
targets a removed endpoint.

## Gotcha
Removing this also removes the ability to fall back to static serving by flipping
`needsGeneratedCurriculum` off. If you want to keep that escape hatch, DON'T remove —
the doc comments now mark it clearly as retained fallback, which was the real source
of "is this dead?" confusion.
