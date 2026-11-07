# ADR-004: Enum alignment — Mid-Market everywhere

## Status
Accepted

## Context
Prisma `schema.prisma` defined `Tier.MidMarket` (no hyphen), while all TypeScript (`types/sales-os.ts`, `validation.ts`, `seed.ts`, `forms.tsx`, `accounts/page.tsx`, `import/route.ts`) used `Mid-Market` (with hyphen). This caused silent tier misclassification between DB and UI.

## Decision
Canonical tier value is `Mid-Market` everywhere. Prisma schema updated to `Mid-Market`; a migration is required for existing databases.

## Consequences
- Schema and code agree; no more silent mismatches.
- Existing Prisma databases with `MidMarket` rows need a data migration (`UPDATE "Tier" SET ...` or re-seed).

## Revisit
None.
