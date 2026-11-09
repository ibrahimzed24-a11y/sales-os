/**
 * VALIOZ Health - CASL send safeguards and offer constants.
 * Nothing in Sales OS may send a commercial email unless sendReadiness().ok is true.
 * No legal name or mailing address is hard-coded here: they come from the environment
 * (VALIOZ_LEGAL_NAME, VALIOZ_MAILING_ADDRESS) and are rejected if missing or placeholder-like.
 */

export const VALIOZ_BRAND_NAME = 'VALIOZ Health';
export const VALIOZ_SITE_URL = 'https://health.valioz.com';
export const VALIOZ_CTA = 'Just reply YES — we will explain the next steps personally.';

// Planned unsubscribe URL. Kept DISABLED: it is only usable once the page is live and
// VALIOZ_UNSUBSCRIBE_ENABLED=true is set explicitly in the environment.
export const VALIOZ_UNSUBSCRIBE_URL_TEMPLATE = 'https://health.valioz.com/unsubscribe?token={{lead_token}}';

export const VALIOZ_OFFER = {
  currency: 'CAD',
  packagePriceCad: 499,
  freeDays: 30,
  optionalMonthlyCad: 299,
  label: '$499 CAD package - first 30 days free, then optional $299 CAD/month',
  cta: VALIOZ_CTA,
} as const;

// Pipeline / lead statuses used by the VALIOZ workflow (kept separate from the core LeadStatus union).
export const LEAD_VERIFIED_PRIORITY_A = 'LEAD_VERIFIED_PRIORITY_A';
export const QUALIFIED_DEAL = 'QUALIFIED_DEAL';
export const SUPPRESSED_CASL = 'SUPPRESSED_CASL';
export type ValiozStatus = typeof LEAD_VERIFIED_PRIORITY_A | typeof QUALIFIED_DEAL | typeof SUPPRESSED_CASL;

/** Only verified Priority A leads and qualified deals may be emailed; suppressed contacts never. */
export function isContactSendable(status: string | null | undefined, opts: { optedOut?: boolean } = {}): boolean {
  if (opts.optedOut) return false;
  return status === LEAD_VERIFIED_PRIORITY_A || status === QUALIFIED_DEAL;
}

const PLACEHOLDER_RE = /[\[\]{}<>]|placeholder|todo|tbd|lorem|your[ _-]?(address|company)|legal business name|valid mailing address|example/i;
const CA_POSTAL_RE = /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/i;

export function validMailingAddress(addr: string | undefined): boolean {
  const a = (addr ?? '').trim();
  if (a.length < 15 || PLACEHOLDER_RE.test(a)) return false;
  if (!/\d/.test(a)) return false; // civic number required
  if (!CA_POSTAL_RE.test(a)) return false; // Canadian postal code required
  return true;
}

export interface SendReadiness {
  ok: boolean;
  reasons: string[];
}

export function sendReadiness(env: Record<string, string | undefined> = process.env): SendReadiness {
  const reasons: string[] = [];
  const legal = (env.VALIOZ_LEGAL_NAME ?? '').trim();
  if (!legal || PLACEHOLDER_RE.test(legal)) reasons.push('VALIOZ_LEGAL_NAME is missing or a placeholder.');
  if (!validMailingAddress(env.VALIOZ_MAILING_ADDRESS)) {
    reasons.push('VALIOZ_MAILING_ADDRESS is missing, incomplete or a placeholder (a civic address with a Canadian postal code is required).');
  }
  if (env.VALIOZ_UNSUBSCRIBE_ENABLED !== 'true') {
    reasons.push('Unsubscribe link is not enabled (VALIOZ_UNSUBSCRIBE_ENABLED is not "true"); it must be live and working before any send.');
  }
  return { ok: reasons.length === 0, reasons };
}
