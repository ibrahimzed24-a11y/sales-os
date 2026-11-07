# ADR-008: Merge duplicate CSV parsers and uid helpers

## Status
Accepted

## Context
Two near-identical CSV parsers existed: `parseCSV` in `src/lib/utils.ts` and `parseDelimited` in `src/components/data.tsx`. Two `uid` implementations existed: `uid` in `utils.ts` and a local one in `import/route.ts`.

## Decision
Keep one CSV parser (`parseCSV` in `utils.ts`) and one `uid` (in `utils.ts`). Import them wherever needed. Delete the duplicates.

## Consequences
- Deletes ~35 lines of duplicated parser code and ~3 lines of duplicated uid.
- Single place to fix CSV parsing bugs.

## Revisit
None.
