/**
 * Source data for the offer snapshot. These are the actual Google Keyword
 * Planner values retrieved on 2026-11-09, preserved verbatim with their
 * limitations — they are Canada-wide ranges, not city or province data.
 *
 * Numbers must never be estimated or interpolated. Missing figures stay
 * missing. See data/research-limits.md.
 */

const SOURCE_FILE = 'Google Keyword Planner raw data (71 keywords).csv';
const SOURCE_DATE = '2026-11-09';
const SCOPE = 'Canada-wide (country-level targeting)';

// Range buckets as returned by the account (space-separated, e.g. '1K-10K').
// Values are formatted with a comma for display.
const SNAPSHOT = {
  // Top two rows: the two highest-volume queries in the dataset.
  queries: [
    { label: 'dentist near me', range: '100K-1M', competition: 'Medium' },
    { label: 'dental clinic near me', range: '100K-1M', competition: 'Medium' },
  ],
  // Demand bars (treatment intent, Canada-wide).
  bars: [
    { label: 'General dentistry', query: 'dentist near me', range: '100K-1M', width: 94, tone: 'teal' },
    { label: 'Emergency care', query: 'emergency dentist calgary', range: '1K-10K', width: 52, tone: 'navy' },
    { label: 'Cosmetic & implants', query: 'dental implants toronto', range: '1K-10K', width: 41, tone: 'light' },
  ],
};

const LIMITATIONS = [
  'Keyword Planner returned only Canada-wide bucketed ranges (e.g. 1K-10K) because the Google Ads account shows a billing-threshold warning.',
  'No 12-month series and no competition index were available — only Low/Medium/High labels.',
  'There are no city-level or province-level results. Each "dentist <city>" figure is a Canada-wide count for a query naming that city; it is not city data.',
  'Bids are in EGP, not CAD. Eight keywords returned no data at all.',
];

const INSIGHT = 'Search demand exists across treatment needs. A clinic-specific website, relevant pages, and an optimized Google Business Profile can help you compete for attention. Rankings and bookings are not guaranteed.';

// Market context from valioz_health_market_research.pdf (not independently verified).
const MARKET_CONTEXT = {
  independentPracticesCA: '13,500-14,000 (~88%)',
  icpEligible: 'Estimated 3,500-5,000',
  regions: 'ON ~6,900 · BC ~2,660 · QC ~2,600 · AB ~2,030 · MB & SK ~780 · Atlantic ~680',
  salesCycleDays: '7-21',
};

module.exports = { SNAPSHOT, LIMITATIONS, INSIGHT, MARKET_CONTEXT, SOURCE_FILE, SOURCE_DATE, SCOPE };
