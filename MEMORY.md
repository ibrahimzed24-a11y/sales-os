# VALIOZ Health — Agent Memory & Persistent Directives

## Design & Email Layout Directives
1. **Pure White Background Only**: Never use dark, grey, or tinted backgrounds for email wrappers. Outer wrapper and inner container must be `#ffffff`.
2. **Zero Flat Image Slices**: Never send emails as chopped image graphics (`email_top.jpg`, etc.). All body content must be live, editable, responsive HTML/CSS components (cards, metrics, typography, progress bars, SVG trendlines).
3. **Dual-Brand Header Standard**:
   - Left: VALIOZ Health logo (`valioz-logo-horizontal.png` at 32px height).
   - Divider: Vertical line `|` in light grey (`#CBD5E1`).
   - Center/Right: Clinic logo (at 32px height, linked to clinic website).
   - Far Right: Light aqua rounded pill badge `📊 Growth Audit` (`#E6F8F7`, text `#008E91`).
   - On mobile screens, hide badge or scale gracefully to avoid wrapping.
4. **Reliable Asset Hosting**:
   - Host all logos and imagery on Vercel CDN (`https://osv.nilesupplies.com/assets/...`).
   - Never use `raw.githubusercontent.com` URLs in email markup, as Hostinger Webmail, Gmail proxy, and Outlook block raw code repositories.

## Strategic Rotating Scheduler Directives
1. **Canadian Sunrise Cadence**:
   - Dispatch target is strictly 08:00 AM local clinic time.
   - Sequence follows sunrise East to West: Atlantic (08:00 AT = 12:00 UTC) -> Eastern (08:00 ET = 13:00 UTC) -> Central (08:00 CT = 14:00 UTC) -> Mountain (08:00 MT = 15:00 UTC) -> Pacific (08:00 PT = 16:00 UTC).
2. **Multi-Vector Angle Twisting**:
   - Never send identical subject lines or pitches across sequential clinics.
   - Rotate between 5 angles: `DEMAND_SURGE`, `MAP_RANK_DEFENSE`, `INTAKE_OPTIMIZATION`, `PRACTICE_BENCHMARK`, and `AI_OVERVIEW_GEO`.
3. **Humanized Micro-Jitter**:
   - Spacing between consecutive dispatches must be 6 to 14 minutes of randomized jitter.
4. **Provincial Distribution & Daily Throttling**:
   - Max 10 clinics per active outreach day (Tue, Wed, Thu).
   - Max 3 clinics per province to ensure balanced provincial representation.

## Hostinger Webmail Automation Mechanics
1. **Recipient Chip Commitment**:
   - Setting `#to.value` alone does not tokenize the recipient in Hostinger's SPA.
   - Dispatch `KeyboardEvent('keydown', {key: 'Enter', keyCode: 13})` followed by CDP `press_key("Tab")`.
   - Verify that recipient chip DOM element exists before clicking Send.
2. **Composer Button**:
   - Select `button[data-qa="sidebar-new-message"]`.
   - Clear existing text before typing into `#subject` and `#to`.
