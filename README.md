# Sales OS

Standalone Revenue Operating System and CRM built with Next.js (App Router), TypeScript (strict), Tailwind CSS, Zustand and Recharts.

## Modules
- **Command Center** - KPI cards, forecast / funnel / velocity charts, Today's Focus, Ctrl/Cmd+K command bar
- **Pipeline** - drag-and-drop Kanban + list view, weighted forecast, stale-deal badges
- **Contacts & Accounts** - filters, CSV import/export, bulk status, 360 drawer with timeline
- **Activities** - tasks, call/meeting logger, overdue tracking
- **Quotes & Catalog** - products (MRR/ARR/one-time), quote builder, printable preview
- **Playbooks** - scripts, MEDDIC/BANT, templates with `{{first_name}}` / `{{company}}`, objection battlecards
- **Settings** - stages, currency/locale, dark/light, seed / export / reset / clear

## Run
```bash
npm install
npm run dev
```

## Architecture
- Data layer: persisted Zustand store (`src/lib/store.ts`) seeded with realistic B2B data (`src/lib/seed.ts`), so the app works out of the box with no database.
- `prisma/schema.prisma` holds the PostgreSQL schema for scaling; `DATABASE_URL` is optional (see `.env.example`).
- API routes: `/api/health`, `/api/seed`, `/api/crm/[entity]`.

## Deploy
Import the repository in Vercel (Framework: Next.js). No environment variables are required.
