/**
 * Valioz Health — Email Tracking
 * Adds open-tracking pixel and wraps links for click tracking.
 * Katteb: implement recordOpen() / recordClick() to write to your DB / Sales OS.
 */

class Tracking {
  constructor({ trackingDomain = 'https://osv.nilesupplies.com' } = {}) {
    this.trackingDomain = trackingDomain;
  }

  /**
   * Insert an open-tracking 1x1 pixel before </body>.
   * emailId = unique id for this send (campaignId + contactId + stepId).
   */
  addOpenPixel(html, emailId) {
    const pixelUrl = `${this.trackingDomain}/api/email/track/open?eid=${encodeURIComponent(emailId)}`;
    const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" border="0">`;
    if (/<\/body>/i.test(html)) {
      return html.replace(/<\/body>/i, `${pixel}</body>`);
    }
    return html + pixel;
  }

  /**
   * Wrap <a href="..."> links so clicks route through your tracker then redirect.
   * linkMap = { originalUrl: trackedUrl } or generate dynamically.
   */
  wrapLinks(html, emailId, baseUrl = this.trackingDomain) {
    return html.replace(
      /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
      (match, href, inner) => {
        const trackedUrl = `${baseUrl}/api/email/track/click?eid=${encodeURIComponent(emailId)}&url=${encodeURIComponent(href)}`;
        return match.replace(href, trackedUrl);
      }
    );
  }

  /**
   * Katteb: implement these to persist events to Sales OS (e.g. /api/email/events).
   */
  async recordOpen(emailId, contactId, campaignId, meta = {}) {
    console.warn(`[tracking] open recorded: eid=${emailId} cid=${contactId}`);
    // await fetch(`${this.trackingDomain}/api/email/events`, { method: 'POST', body: {...} });
  }

  async recordClick(emailId, contactId, campaignId, url, meta = {}) {
    console.warn(`[tracking] click recorded: eid=${emailId} url=${url}`);
  }
}

module.exports = Tracking;
