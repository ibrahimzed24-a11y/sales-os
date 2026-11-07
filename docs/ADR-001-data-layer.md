# ADR-001: Local-first Zustand store with optional PostgreSQL backend

## Status
Accepted

## Context
Sales OS needs to work out of the box with no database setup, while supporting cloud sync for multi-device use. The original design used a persisted Zustand store (localStorage) as the source of truth, with Prisma/PostgreSQL as an optional backend via `/api/db/[table]` routes. A Supabase client layer (`src/lib/server.ts`) was also added but never wired up.

## Decision
Keep the persisted Zustand store as the primary data layer. Use Prisma/PostgreSQL as an optional backend behind `/api/db/*` API routes. The store silently mirrors writes to the API when online; reads come from local state first. Remove the unused Supabase layer (`src/lib/server.ts`) — it is dead code.

## Consequences
- App works offline with zero configuration.
- Cloud sync requires implementing `/api/state` properly (currently broken: PUT acknowledges but stores nothing; GET returns `data: null`).
- Mirror writes are fire-and-forget; conflicts are not resolved (last write wins on reload via `syncFromCloud`).
- Supabase removal deletes ~188 lines of unused code (rate limiter, `toDb`/`fromDb`, `filterQS`, `list`/`upsert`/`patch`/`remove` helpers).

## Revisit
If multi-user concurrent editing is required, replace fire-and-forget mirroring with proper conflict resolution or move to server-authoritative state.
