/**
 * Valioz Health — Contact Manager
 * Resolves contacts from Sales OS and prepares merge-tag context.
 * Katteb: implement loadContacts() to query your /contacts or /accounts API.
 */

class ContactManager {
  constructor({ salesOsApi } = {}) {
    this.salesOsApi = salesOsApi; // function or object with getContacts()
  }

  /**
   * Fetch contacts from Sales OS.
   * Returns array of { id, email, first_name, last_name, company, city, specialty, status }
   * Override this to call your actual API endpoint (e.g. GET /api/contacts).
   */
  async loadContacts({ filter = {} } = {}) {
    // Placeholder: replace with real Sales OS API call
    // Example: const res = await this.salesOsApi.getContacts({ status: 'active' });
    console.warn('[contact-manager] loadContacts() not wired to Sales OS API — returning empty list.');
    return [];
  }

  /**
   * Filter contacts eligible for a campaign.
   * Excludes unsubscribed, bounced, invalid emails.
   */
  filterEligible(contacts) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return contacts.filter((c) => {
      if (c.status === 'unsubscribed' || c.status === 'bounced') return false;
      if (!c.email || !emailRe.test(c.email)) return false;
      return true;
    });
  }

  /**
   * Deduplicate by email.
   */
  deduplicate(contacts) {
    const seen = new Set();
    return contacts.filter((c) => {
      if (seen.has(c.email)) return false;
      seen.add(c.email);
      return true;
    });
  }
}

module.exports = ContactManager;
