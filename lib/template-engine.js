/**
 * Valioz Health — Dual-Brand Email Template Engine
 *
 * V_*      = Valioz Health (sender) — outer shell, header, footer, CTA
 * C_*      = Target clinic (recipient) — logo, link, accent, text color
 * CONTENT  = Per-step copy and links
 *
 * Supports simple {{#if TAG}}...{{/if}} blocks. In strict mode any tag left
 * after replacement throws, so missing copy can never silently ship empty.
 */

const fs = require('fs');
const path = require('path');
const DEFAULT_VALIOZ = require('./valioz-brand');

class TemplateEngine {
  constructor({ templateDir, valiozBrand } = {}) {
    this.templateDir = templateDir;
    this.valioz = { ...DEFAULT_VALIOZ, ...valiozBrand };
    this._cache = new Map();
  }

  load(name) {
    if (this._cache.has(name)) return this._cache.get(name);
    const file = path.join(this.templateDir, `${name}.html`);
    if (!fs.existsSync(file)) {
      throw new Error(`Template not found: ${file}`);
    }
    const html = fs.readFileSync(file, 'utf8');
    this._cache.set(name, html);
    return html;
  }

  render(html, { valioz = this.valioz, clinic = {}, content = {}, strict = true } = {}) {
    const v = { ...this.valioz, ...valioz };

    const values = {
      // Sender brand
      '{{V_LOGO_URL}}': v.logoUrl,
      '{{V_SITE_URL}}': v.siteUrl,
      '{{V_WHATSAPP_URL}}': v.whatsappUrl,
      '{{V_WHATSAPP_NUMBER}}': v.whatsappNumber,
      '{{V_BRAND_URL}}': v.brandUrl,
      '{{V_ADDRESS}}': v.address,
      '{{V_NAVY}}': v.navy,
      '{{V_NAVY_DEEP}}': v.navyDeep,
      '{{V_TURQUOISE}}': v.turquoise,
      '{{V_TURQUOISE_DEEP}}': v.turquoiseDeep,
      '{{V_MIST}}': v.mist,
      '{{V_CANVAS}}': v.canvas,
      '{{V_INK}}': v.ink,
      '{{V_MUTED}}': v.muted,
      '{{V_WHITE}}': v.white,
      '{{V_LINE}}': v.line,
      // Legacy aliases retained for older content blocks
      '{{V_TEAL}}': v.turquoise,
      '{{V_TEAL_DEEP}}': v.turquoiseDeep,
      '{{V_MINT}}': v.mist,
      '{{V_CORAL}}': v.turquoise,
      '{{V_CORAL_DEEP}}': v.turquoiseDeep,

      // Recipient clinic
      '{{C_NAME}}': clinic.name || '',
      '{{C_PRIMARY}}': clinic.primary || '#172C46',
      '{{C_SECONDARY}}': clinic.secondary || '#56667A',
      '{{C_TEXT}}': clinic.text || '#212121',
      '{{C_ACCENT}}': clinic.accent || '#00AFA5',
      '{{C_LOGO_URL}}': clinic.logoUrl || '',
      '{{C_SITE_URL}}': clinic.siteUrl || 'https://health.valioz.com',

      // Sequence content
      '{{EYEBROW_TAG}}': content.eyebrowTag || '',
      '{{HEADLINE}}': content.headline || '',
      '{{LEAD_COPY}}': content.leadCopy || '',
      '{{FIRST_NAME}}': content.firstName || '',
      '{{CITY}}': content.city || '',
      '{{OFFER_BLOCK}}': content.offerBlock || '',
      '{{CTA_BLOCK}}': content.ctaBlock || '',
      '{{RESEARCH_CARD}}': content.researchCard || '',
      '{{BODY_COPY}}': content.bodyCopy || '',
      '{{BODY_COPY_PAS_PROBLEM}}': content.bodyCopyPasProblem || '',
      '{{BODY_COPY_PAS_AGITATION}}': content.bodyCopyPasAgitation || '',
      '{{BODY_COPY_PAS_SOLUTION}}': content.bodyCopyPasSolution || '',
      '{{BODY_COPY_AIDA_ATTENTION}}': content.bodyCopyAidaAttention || '',
      '{{BODY_COPY_AIDA_INTEREST}}': content.bodyCopyAidaInterest || '',
      '{{BODY_COPY_AIDA_DESIRE}}': content.bodyCopyAidaDesire || '',
      '{{BODY_COPY_CASE_PROBLEM}}': content.bodyCopyCaseProblem || '',
      '{{BODY_COPY_CASE_AGITATION}}': content.bodyCopyCaseAgitation || '',
      '{{BODY_COPY_CASE_SOLUTION}}': content.bodyCopyCaseSolution || '',
      '{{BODY_COPY_URGENCY_PROBLEM}}': content.bodyCopyUrgencyProblem || '',
      '{{BODY_COPY_URGENCY_AGITATION}}': content.bodyCopyUrgencyAgitation || '',
      '{{BODY_COPY_URGENCY_SOLUTION}}': content.bodyCopyUrgencySolution || '',
      '{{PROOF}}': content.proof || '',
      '{{STAT_COPY}}': content.statCopy || '',
      '{{PS_COPY}}': content.psCopy || '',
      '{{CTA_LINK}}': content.ctaLink || '#',
      '{{CTA_TEXT}}': content.ctaText || 'Book Your Growth Audit',
      '{{UNSUBSCRIBE_URL}}': content.unsubscribeUrl || '#',
    };

    for (const key of Object.keys(values)) {
      if (values[key] === undefined || values[key] === null) delete values[key];
    }

    // Simple conditionals: keep the body only when the tag resolves truthy.
    let out = html.replace(
      /{{#if\s+([A-Z0-9_]+)}}\s*([\s\S]*?){{\/if}}/g,
      (_, tag, body) => (values[`{{${tag}}}`] ? body : '')
    );

    for (const [tag, value] of Object.entries(values)) {
      out = out.split(tag).join(String(value));
    }

    const unresolved = [...new Set(out.match(/{{[^}]+}}/g) || [])];
    if (unresolved.length) {
      if (strict) {
        throw new Error(`Unresolved template tags: ${unresolved.join(', ')}`);
      }
      out = out.replace(/{{[^}]+}}/g, '');
    }

    return out;
  }
}

module.exports = TemplateEngine;
