/**
 * Valioz Health — Dual-Brand Campaign Runner
 *
 * Wrapper (header/footer/button) = Valioz Health ({{V_*}})
 * Content body (logo/headline/accents) = Target clinic ({{C_*}})
 *
 * Katteb: wire runSequence() to a cron or manual trigger inside Sales OS.
 */

const fs = require('fs');
const path = require('path');
const TemplateEngine = require('./template-engine');
const ContactManager = require('./contact-manager');
const DeliveryQueue = require('./delivery-queue');
const Tracking = require('./tracking');
const { resolveClinicBrand } = require('../config/clinic-brands');
const { PLAN, MERGE_TAGS } = require('../config/30-day-plan');
const { STEP_MAP, contentForStep } = require('./sequence-content');

const TEMPLATE_DIR = path.join(__dirname, '..', 'email-sequence', 'templates');

// Map plan template name -> content block file
const CONTENT_BLOCK_MAP = {
  '01-welcome': 'content-01-welcome',
  '02-pas-awareness': 'content-02-pas-awareness',
  '03-aida-conversion': 'content-03-aida-conversion',
  '04-case-study': 'content-04-case-study',
  '05-urgency': 'content-05-urgency',
};

class CampaignRunner {
  constructor({
    salesOsApi,
    valiozBrand = {},
    trackingDomain = 'https://osv.nilesupplies.com',
    rateLimitPerHour = 200,
  } = {}) {
    this.templateEngine = new TemplateEngine({ templateDir: TEMPLATE_DIR, valiozBrand });
    this.baseHtml = fs.readFileSync(path.join(TEMPLATE_DIR, 'base.html'), 'utf8');
    this.contactManager = new ContactManager({ salesOsApi });
    this.deliveryQueue = new DeliveryQueue({ rateLimitPerHour });
    this.tracking = new Tracking({ trackingDomain });
    this.campaignId = `valioz-30day-${Date.now()}`;
    this._contentCache = new Map();
  }

  /**
   * Main entry: run the 30-day sequence.
   * Each contact gets their own clinic-branded content body inside the Valioz wrapper.
   */
  async runSequence({ startFromDay = 1, dryRun = false } = {}) {
    console.log(`[campaign-runner] Starting Valioz 30-day dual-brand sequence (campaign: ${this.campaignId})`);

    const rawContacts = await this.contactManager.loadContacts();
    const contacts = this.contactManager.deduplicate(
      this.contactManager.filterEligible(rawContacts)
    );
    console.log(`[campaign-runner] ${contacts.length} eligible contacts`);

    if (contacts.length === 0) {
      console.log('[campaign-runner] No contacts to send to.');
      return { queued: 0, campaignId: this.campaignId };
    }

    let totalQueued = 0;

    for (const step of PLAN) {
      if (step.day < startFromDay) continue;

      const dayLabel = `Day ${step.day} (${step.dow})`;
      console.log(`[campaign-runner] ${dayLabel} — ${step.subject} (${step.framework})`);

      const contentBlock = this._loadContentBlock(step.template);

      for (const contact of contacts) {
        const clinicBrand = resolveClinicBrand(contact);
        const emailId = `${this.campaignId}-d${step.day}-c${contact.id}`;

        const content = this._buildContent(step, contact, clinicBrand, emailId);

        // Render the clinic-branded content block
        const renderedContent = this.templateEngine.render(contentBlock, {
          valioz: this.templateEngine.valioz,
          clinic: clinicBrand,
          content,
        });

        // Wrap in Valioz base HTML, then render the wrapper tags so the
        // output never ships literal {{HEADLINE}} / {{V_*}} placeholders.
        const withBlock = this.baseHtml.split('{{CONTENT_BLOCK}}').join(renderedContent);
        const fullHtml = this.templateEngine.render(withBlock, {
          valioz: this.templateEngine.valioz,
          clinic: clinicBrand,
          content,
        });

        // Add tracking pixel + wrap links
        const trackedHtml = this.tracking.addOpenPixel(fullHtml, emailId);
        const finalHtml = this.tracking.wrapLinks(trackedHtml, emailId);

        this.deliveryQueue.enqueue({
          to: contact.email,
          subject: step.subject.replace('{{first_name}}', contact.first_name || ''),
          html: finalHtml,
          contactId: contact.id,
          campaignId: this.campaignId,
          stepId: `day-${step.day}`,
          clinicId: contact.clinicId || contact.accountId,
        });
        totalQueued += 1;
      }
    }

    console.log(`[campaign-runner] Queued ${totalQueued} emails`);

    if (dryRun) {
      console.log('[campaign-runner] Dry run — not sending.');
      return { queued: totalQueued, campaignId: this.campaignId, dryRun: true };
    }

    const result = await this.deliveryQueue.process();
    console.log(`[campaign-runner] Send results:`, result);
    return { ...result, campaignId: this.campaignId, totalQueued };
  }

  _loadContentBlock(templateName) {
    const blockName = CONTENT_BLOCK_MAP[templateName];
    if (!blockName) throw new Error(`No content block for template: ${templateName}`);
    if (this._contentCache.has(blockName)) return this._contentCache.get(blockName);
    const file = path.join(TEMPLATE_DIR, `${blockName}.html`);
    const html = fs.readFileSync(file, 'utf8');
    this._contentCache.set(blockName, html);
    return html;
  }

  _buildContent(step, contact, clinicBrand, emailId) {
    const sequenceStep = STEP_MAP[step.template];
    if (!sequenceStep) throw new Error(`No content block for template: ${step.template}`);

    const content = contentForStep(
      sequenceStep,
      {
        clinic_brand_name: clinicBrand.name,
        clinic_email: contact.email,
        resolved_website_url: clinicBrand.siteUrl,
      },
      { contactFirstName: contact.first_name || 'there' }
    );

    return {
      ...content,
      headline: step.subject,
      ctaText: step.cta || content.ctaText,
      ctaLink: `https://health.valioz.com${step.ctaLink || ''}`,
      unsubscribeUrl: `https://osv.nilesupplies.com/unsubscribe?email=${encodeURIComponent(
        contact.email
      )}&token=${emailId}`,
    };
  }
}

module.exports = CampaignRunner;
