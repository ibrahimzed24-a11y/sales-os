# ADR-005: Remove broken cloud sync; keep localStorage as source of truth

## Status
Accepted

## Context
`store.ts` ran a 30-second sync timer calling `/api/state` PUT/GET. The endpoint PUT just returned `{saved:true}` without persisting; GET always returned `data: null`. Sync traffic hit an authed Prisma query for no benefit, and users lost data switching devices.

## Decision
Remove `syncToCloud`/`syncFromCloud`, the 30-second timer, the visibility-change sync, and the `/api/state` route. localStorage remains the source of truth. If cloud sync is needed later, implement `/api/state` to actually store and return per-user snapshots.

## Consequences
- Deletes ~45 lines of broken sync code in `store.ts` and ~56 lines in `/api/state/route.ts`.
- No cross-device sync until properly implemented.

## Revisit
Implement real `/api/state` persistence with per-user snapshots and conflict resolution when multi-device is required.
