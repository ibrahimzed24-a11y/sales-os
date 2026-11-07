# Sales OS — Domain Glossary

Single source of truth for domain terminology used across code, schema, UI, and docs.

## Entities

**Account** — A company (customer or prospect). One account has many contacts and many deals. Identified by `id` (cuid). Fields: name, domain, industry, size (employees), annualRevenue, tier, createdAt, updatedAt, deletedAt (soft delete).

**Contact** — A person at an account. Identified by `id`. Fields: accountId, firstName, lastName, email, phone, role, leadStatus, leadScore (0–100), source, tags[], owner, lastContactedAt, createdAt, updatedAt, deletedAt.

**Deal** — A sales opportunity. Identified by `id`. Fields: title, accountId, primaryContactId, stage (DealStage), value, currency, probability (0–100), expectedCloseDate, lossReason, notes, owner, createdAt, updatedAt, deletedAt.

**Activity** — A task, call, email, meeting, or note. Identified by `id`. Fields: type (ActivityType), subject, description, status (pending/completed/overdue), priority, dueDate, userId, dealId, contactId, outcome, createdAt, updatedAt, deletedAt.

**Product** — A sellable item in the catalog. Identified by `id`. Fields: sku (unique), name, kind (recurring/one-time), billingCycle (monthly/annual/one-time), basePrice, createdAt, updatedAt.

**Quote** — A formal price proposal tied to one deal. Identified by `id`. Fields: dealId, status (QuoteStatus), items[] (QuoteItem), taxRate, totalAmount, validUntil, createdAt, updatedAt.

**QuoteItem** — One line in a quote. Fields: productId, name, quantity, unitPrice, discount (0–100).

**PlaybookItem** — A sales script, objection battlecard, email template, or framework. Identified by `id`. Fields: category (PlaybookCategory), title, tags[], content, updatedAt.

**User** — An app user with auth. Identified by `id`. Fields: name, email (unique), password (hashed), role (ADMIN/MANAGER/REP), createdAt, updatedAt.

**Session** — Auth session. Identified by `id`. Fields: sessionToken (unique), userId, expires.

**ImportJob** — Record of a CSV import. Identified by `id`. Fields: userId, entity, fileName, total, imported, skipped, report (JSON), createdAt, updatedAt.

**AuditLog** — Record of who changed what. Identified by `id`. Fields: userId, action, entity, entityId, metadata (JSON), createdAt.

## Enums

| Enum | Values |
|------|--------|
| Tier | Enterprise, Mid-Market, SMB |
| LeadStatus | New, Contacted, Working, Qualified, Unqualified |
| LeadSource | Inbound, Outbound, Referral, Partner |
| DealStage | lead_in, discovery, demo, proposal, negotiation, closed_won, closed_lost |
| ActivityType | call, email, meeting, task, note |
| ActivityStatus | pending, completed, overdue |
| Priority | low, medium, high, urgent |
| QuoteStatus | Draft, Sent, Accepted, Declined |
| PlaybookCategory | Script, Objection, Template, Framework |
| Role | ADMIN, MANAGER, REP |

**Note:** Prisma schema previously used `MidMarket` (no hyphen) while all TypeScript code used `Mid-Market`. Canonical value is `Mid-Market` everywhere — schema, validation, UI, seed data. This is a breaking schema change requiring a migration.

## Key Business Rules

- A deal's `probability` defaults to its stage's configured probability; can be overridden per-deal.
- `isOpen(deal)` = stage is not `closed_won` and not `closed_lost`.
- `isStale(deal)` = open and not updated in 7 days.
- `winRate` = won / (won + lost); 0 if none closed.
- `weighted pipeline` = sum(open deal value × probability / 100).
- Completing an activity sets the linked contact's `lastContactedAt`.
- Quotes compute `totalAmount` = round(subtotal − discounts + tax).
- CSV import skips rows without email or phone, invalid emails, and duplicates (by email within file and against DB).
- Soft delete: `deletedAt` is set instead of hard delete for CRM entities (accounts, contacts, deals, activities).

## Data Layer

- **Primary**: Browser localStorage via persisted Zustand store (`sales-os-store`, version 2). Works offline with no database.
- **Optional**: PostgreSQL via Prisma (`DATABASE_URL`). API routes `/api/db/[table]` write to Prisma; the store mirrors writes silently.
- **Supabase layer** (`src/lib/server.ts`): dead code, not imported anywhere. To be removed.
- **Cloud sync**: Broken — `/api/state` PUT/GET does not persist. To be removed or implemented.

## Auth

- JWT session cookie `sales-os-session`, 30-day expiry, httpOnly, sameSite lax, secure in production.
- `JWT_SECRET` required; no fallback secret allowed.
- Passwords hashed with bcrypt (12 rounds).
- Roles: ADMIN, MANAGER, REP. No role-based authorization enforced on API routes yet (all authenticated users can access all data).

## Email

- Campaigns send via Resend (`RESEND_API_KEY`, `SENDER_EMAIL`).
- Fallback: Hostinger Webmail compose link for manual sending.
- `POST /api/email/send` currently has no auth — open relay. Must require session.
