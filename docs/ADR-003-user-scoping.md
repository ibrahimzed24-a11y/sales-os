# ADR-003: User-scoped data access on /api/db

## Status
Accepted

## Context
`/api/db/[table]` routes required a session but did not filter by `session.userId`. Any authenticated user could read, create, update, or delete any user's records. The `filterParam` query was merged directly into Prisma `where` with no ownership bound.

## Decision
Every `where` clause on `/api/db/[table]` GET/POST/PATCH/DELETE includes `userId: session.userId`. Create stamps `userId`. Update and delete verify ownership before mutating. Cross-user access returns 403.

## Consequences
- Authenticated users only see and modify their own records.
- Slightly more verbose query code; no abstraction added (inline `userId` in each where).

## Revisit
If shared accounts/teams are needed, add an `access_grants` table and check it in the auth middleware.
