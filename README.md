# Valioz Health — Dual-Brand Email Automation for Sales OS

> **Current pipeline:** see [`AGENT.md`](./AGENT.md). It covers logo enrichment,
> personalized builds, validation, Hostinger template staging, and compose.
> The `src/` TypeScript files and the example clinic registry below are the
> legacy Sales OS integration.

Drop-in package for Katteb to implement inside the Sales OS at **https://osv.nilesupplies.com/**.
Automates the 30-day personalized email sequence with **dual branding**:

| Layer | Brand | What it controls |
|-------|-------|------------------|
| **Wrapper** | Valioz Health (`{{V_*}}`) | Header logo, outer shell, container, CTA button, footer, unsubscribe, HIPAA notice |
| **Content body** | Target clinic (`{{C_*}}`) | Clinic logo, clinic name, headline color, body text color, accent colors, proof box accent |

Every recipient's email looks like it comes from **Valioz Health** (sender) but speaks directly to **their clinic** (content branded with the clinic's own colors + logo).

## File structure

```
sales-os-email-workflow/
  config/
    30-day-plan.js      # 13 sends (Mon/Wed/Fri), subjects, CTAs, frameworks
    clinic-brands.js    # Target clinic brand registry (logo + colors per clinic)
  email-sequence/
    templates/
      base.html                 # Valioz wrapper shell (header/footer/CTA/footer)
      content-01-welcome.html   # Clinic-branded content block
      content-02-pas-awareness.html
      content-03-aida-conversion.html
      content-04-case-study.html
      content-05-urgency.html
  lib/
    template-engine.js      # Replaces {{V_*}}, {{C_*}}, {{CONTENT_*}} tags
    contact-manager.js      # Loads + filters contacts from Sales OS
    delivery-queue.js       # Queues sends, rate-limits, plugs into sender
    tracking.js             # Open pixel + click-wrapped links
    campaign-runner.js      # Orchestrator: loads base + content block per contact
  README.md
```

## How Katteb implements it

### 1. Drop into Sales OS codebase

Copy `sales-os-email-workflow/` into the Sales OS project (the code behind `osv.nilesupplies.com/`).

### 2. Populate the clinic brand registry

Edit `config/clinic-brands.js`. Add one entry per target clinic, keyed by the clinic ID that matches your Sales OS contact/account record:

```js
clinic_dental_downtown: {
  name: 'Downtown Family Dental',
  primary: '#1B5E20',      // headline color
  secondary: '#4CAF50',
  text: '#212121',         // body text color
  accent: '#FFB300',       // eyebrow / proof-box accent
  logoUrl: 'https://osv.nilesupplies.com/assets/clinics/downtown-dental-logo.png',
  siteUrl: 'https://downtowndental.example.com',
},
```

The `resolveClinicBrand(contact)` function matches `contact.clinicId` (or `accountId` / `clinic`) to a registry entry. If no match, it falls back to a neutral default.

### 3. Wire ContactManager to Sales OS

Edit `lib/contact-manager.js` → `loadContacts()`. Replace the placeholder with a real call to your Sales OS `/contacts` API:

```js
async loadContacts({ filter = {} } = {}) {
  const res = await this.salesOsApi.getContacts({ status: 'active' });
  return res.data.map(c => ({
    id: c.id,
    email: c.email,
    first_name: c.firstName,
    last_name: c.lastName,
    company: c.company,
    city: c.city,
    specialty: c.specialty,
    clinicId: c.clinicId || c.accountId,   // used to look up clinic brand
    status: c.status,
  }));
}
```

### 4. Wire DeliveryQueue to your sender

Edit `lib/delivery-queue.js` → `sendViaProvider()`. Options:

- **Sales OS `/send`** — POST to `https://osv.nilesupplies.com/send`
- **Hostinger SMTP** — nodemailer with Hostinger SMTP credentials
- **Another ESP** — plug in its API

```js
async sendViaProvider(job) {
  await fetch('https://osv.nilesupplies.com/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: job.to, subject: job.subject, html: job.html }),
  });
}
```

### 5. Wire Tracking to Sales OS

Edit `lib/tracking.js` → `recordOpen()` / `recordClick()`. POST events to your Sales OS:

```
POST https://osv.nilesupplies.com/api/email/events
{ event: 'open'|'click', emailId, contactId, campaignId, url?, timestamp }
```

### 6. Create the unsubscribe page

In `lib/campaign-runner.js`, `_unsubscribeUrl` already points to:
`https://osv.nilesupplies.com/unsubscribe?email=...&token=...`

Create that page in Sales OS: it marks the contact `status = 'unsubscribed'` so `filterEligible()` skips them on future sends.

### 7. Run the sequence

```js
const CampaignRunner = require('./lib/campaign-runner');

const runner = new CampaignRunner({
  salesOsApi: yourSalesOsApi,
  valiozBrand: {
    logoUrl: 'https://health.valioz.com/wp-content/uploads/2026/11/valioz-logo-horizontal-en-navy.png',
    address: 'Valioz Health · Yonge St, Toronto, ON M5B 2K9, Canada',
  },
  trackingDomain: 'https://osv.nilesupplies.com',
});

// Dry run first (inspects queue, sends nothing):
// await runner.runSequence({ dryRun: true });

// Real send:
await runner.runSequence();
```

### 8. Schedule it (cron)

The plan sends Mon/Wed/Fri. Schedule `runner.runSequence()` on those days. Everyone receives the same 13-step sequence; each email's content body is branded to that recipient's clinic.

> For per-contact progression (Day 1 for new sign-ups, Day 3 after Day 1, etc.), store `lastSentDay` per contact in Sales OS and filter `PLAN` steps by `step.day > contact.lastSentDay`.

## Merge tags available

**Valioz (sender / wrapper):**
| Tag | Source |
|-----|--------|
| `{{V_LOGO_URL}}`, `{{V_SITE_URL}}`, `{{V_ADDRESS}}` | valiozBrand config |
| `{{V_NAVY}}`, `{{V_CORAL}}`, `{{V_TEAL}}`, `{{V_MINT}}`, `{{V_CANVAS}}`, `{{V_INK}}`, `{{V_MUTED}}`, `{{V_WHITE}}` | Valioz design tokens |
| `{{UNSUBSCRIBE_URL}}` | Generated per contact |

**Clinic (recipient / content body):**
| Tag | Source |
|-----|--------|
| `{{C_NAME}}`, `{{C_PRIMARY}}`, `{{C_SECONDARY}}`, `{{C_TEXT}}`, `{{C_ACCENT}}` | Clinic brand registry |
| `{{C_LOGO_URL}}`, `{{C_SITE_URL}}` | Clinic brand registry |

**Content blocks:**
| Tag | Source |
|-----|--------|
| `{{EYEBROW_TAG}}`, `{{HEADLINE}}`, `{{BODY_COPY}}`, `{{PROOF}}`, `{{STAT_COPY}}`, `{{PS_COPY}}`, `{{CTA_LINK}}`, `{{CTA_TEXT}}` | 30-day plan + per-step copy |

## Compliance (CAN-SPAM + HIPAA)

Every email includes:
- `{{UNSUBSCRIBE_URL}}` — working unsubscribe link
- Valioz physical address in footer (set via `valiozBrand.address`)
- HIPAA notice: no PHI collected via email

**Do not** send to contacts who haven't opted in. `filterEligible()` skips `unsubscribed` and `bounced` statuses.

## Testing

1. Add yourself and a clinic brand to the registry.
2. Run `{ dryRun: true }` — inspect `deliveryQueue.queue`; confirm your clinic's logo + colors appear in the content body while the header/footer/button stay Valioz.
3. Send a real test to yourself; open in Gmail/Outlook/Apple Mail.
4. Click the CTA and unsubscribe link to confirm tracking works.

## Note on legacy templates

The files `01-welcome.html` through `05-welcome.html` in `templates/` are the old single-brand versions. The dual-brand runner uses `base.html` + `content-*.html` blocks instead. Keep the old files only as reference.
