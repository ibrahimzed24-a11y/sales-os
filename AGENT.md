# AGENT.md — Lead Logo & Dual-Brand Email Pipeline

Runbook for the Valioz Health dental-clinic sequence. The canonical output is
`dist/personalized/<clinic-slug>/01-welcome.html` … `05-urgency.html`, plus the
five Hostinger masters in `dist/hostinger/templates/`.

## 1. Prerequisites

```bash
npm install
node --version        # 22.22+ (jsdom 31 requires it)
```

`sharp` must be installed with librsvg support (the monogram fallback renders
text through SVG).

## 2. Full pipeline

```bash
npm run email:enrich   # discover + convert + self-host 138 clinic logos
node compile-templates.js
npm run email:build    # 138 clinics × 5 personalized emails
npm run email:test     # pre-send QA (live HTTPS checks + HTML assertions)
```

Order matters: `npm run email:build` consumes `data/dental-clinics-enriched.csv`,
and `npm run email:test` compares each hosted PNG against the local file
byte-for-byte. The root `build` and `test` scripts belong to the Next.js app.

### What `npm run enrich` guarantees

- Waterfall: website header / JSON-LD → curated override → DSO badge → monogram.
- Every logo is a self-hosted PNG, max 180×60, target <40 KB.
- Near-white marks are placed on a navy chip so they stay visible on the email canvas.
- `resolved_website_url`, `clinic_logo_raw_url`, `clinic_logo_hosted_url`,
  `logo_source_tier`, and `logo_verified_status` are written for every row.
- A full run prunes stale `assets/clinic-logos/*.png` files.

Never hotlink a clinic's raw logo in an email. The email only uses the
`raw.githubusercontent.com/.../assets/clinic-logos/<slug>.png` copy.

### What `npm run email:test` rejects

- Non-HTTPS, non-PNG, non-200, >180×60, or >50 KB logo.
- Hosted bytes that differ from the committed local asset.
- Fewer/more than two `<img>` tags, missing Valioz or clinic logo, missing
  `Prepared for <clinic>`, unresolved `{{TAG}}` values.
- Flexbox/grid, unbalanced table markup, missing HIPAA notice or unsubscribe link.
- Missing body copy for any of the five steps.

## 3. Hostinger sync

### Stage all five masters + signature

```bash
node scripts/sync-hostinger.js --sync-templates
```

Writes:

```
dist/hostinger/templates/01 - Welcome.html
dist/hostinger/templates/02 - PAS Awareness.html
dist/hostinger/templates/03 - AIDA Conversion.html
dist/hostinger/templates/04 - Case Study.html
dist/hostinger/templates/05 - Urgency.html
dist/hostinger/signature.html
dist/hostinger/signature.txt
dist/hostinger/manifest.json
```

The five masters are built for **Barrie Dental Arts** (the pilot record) and
contain that clinic's logo. Other clinics must use their own
`dist/personalized/<slug>/` file; do not reuse a Barrie master for a different
clinic.

Paste each file through the composer's **Templates → New template** menu
(Hostinger calls these "email templates", not "signatures"), using the exact
title from the manifest. Templates are a **paid Hostinger feature** — on the
free plan the button opens an upgrade wall. Paste `signature.html` into
**Settings → Signature**. Keep the sender as `sales@health.valioz.com`.

Optional Reach API sync (creates only missing titles; the API cannot update an
existing template):

```bash
HOSTINGER_REACH_TOKEN=... HOSTINGER_REACH_PROFILE=... \
  node scripts/sync-hostinger.js --sync-templates
```

The signature has no public API; it remains a local artifact for the UI.

### Compose one lead

```bash
node scripts/sync-hostinger.js \
  --compose-lead "Barrie Dental Arts" \
  --to ibrahim.zed24@gmail.com \
  --name Ibrahim
```

Outputs `dist/hostinger/outbox/<slug>-<step>.eml`, `.html`, and `.txt`.
Import the `.eml` into the Hostinger composer (or drag it in), confirm both
logos render, then send. The script never sends by itself.

`--step` defaults to `01-welcome`; use `02-pas-awareness`, `03-aida-conversion`,
`04-case-study`, or `05-urgency` for later emails.

## 4. Verify before claiming success

1. `npm run email:test` ends with **ALL CHECKS PASSED**.
2. Open the personalized HTML and confirm exactly two images:
   - left: `health.valioz.com/wp-content/uploads/2026/11/valioz-logo-horizontal-en-navy.png`
   - right: the clinic's `raw.githubusercontent.com/.../assets/clinic-logos/<slug>.png`
3. Send a test and open the Sent copy. In DevTools, both header images must have
   `naturalWidth > 0`. A 404 or blocked image is a failure even if the alt text shows.
4. Confirm the clinic logo is 48px high with `width:auto`, and the label reads
   `Prepared for <clinic name>`.

## 5. Guardrails

- Exactly two images per email: sender logo + clinic logo. Never add a third.
- Every email footer links `WhatsApp +20 10 93272247` to
  `https://wa.me/201093272247`. The number and URL live in `lib/valioz-brand.js`;
  `npm run email:test` fails if either is missing and live-checks the link.
- Every CTA links to a live page: audit buttons → `https://health.valioz.com/`,
  website review → `/contact/`, case study → `/insights/`, SEO/GEO → `/solutions/`.
  `npm run email:test` also checks each destination returns 200.
- Do not reintroduce `https://health.valioz.com/assets/VALIOZ_Health_Primary.png`
  (404) or `valioz-logo-navy.webp` (obsolete).
- Do not send until the new PNGs are committed and pushed; raw GitHub URLs are
  what the email loads.
- `data/dental-clinics.csv` is input; edit `data/dental-clinics-enriched.csv`
  only through `npm run email:enrich` or a curated override in `config/logo-overrides.json`.
- `src/lib/email-workflow.ts` is the legacy Sales OS integration. The canonical
  pipeline is the Node scripts above.
