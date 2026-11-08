/**
 * Valioz Health — Delivery Queue
 * Queues personalized emails and sends through the configured provider.
 * Katteb: implement sendViaProvider() to call Hostinger SMTP / Sales OS / your ESP.
 */

class DeliveryQueue {
  constructor({ provider = 'smtp', rateLimitPerHour = 200 } = {}) {
    this.provider = provider;
    this.rateLimitPerHour = rateLimitPerHour;
    this.queue = [];
    this.sent = [];
    this.failed = [];
  }

  /**
   * Add a personalized email to the queue.
   * email = { to, subject, html, text?, contactId, campaignId, stepId }
   */
  enqueue(email) {
    this.queue.push({
      ...email,
      queuedAt: new Date().toISOString(),
      attempts: 0,
    });
  }

  /**
   * Process the queue up to rate limit.
   * Returns { sent, failed, remaining }.
   */
  async process() {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const sentThisHour = this.sent.filter((s) => new Date(s.sentAt) > hourAgo).length;
    const slots = Math.max(0, this.rateLimitPerHour - sentThisHour);

    let sent = 0;
    let failed = 0;

    while (this.queue.length > 0 && sent < slots) {
      const job = this.queue.shift();
      job.attempts += 1;
      try {
        await this.sendViaProvider(job);
        this.sent.push({ ...job, sentAt: now.toISOString(), status: 'sent' });
        sent += 1;
      } catch (err) {
        this.failed.push({ ...job, error: err.message, attemptedAt: now.toISOString() });
        // Retry once if under 3 attempts
        if (job.attempts < 3) this.queue.push(job);
        failed += 1;
      }
    }

    return { sent, failed, remaining: this.queue.length };
  }

  /**
   * Katteb: wire this to your actual sending provider.
   * Options: Hostinger SMTP, Sales OS /send endpoint, Nodemailer, etc.
   */
  async sendViaProvider(job) {
    // Never report success when no provider is wired: a silent no-op would
    // mark unsent emails as delivered.
    throw new Error(
      `No email provider configured — cannot send to ${job.to}. Wire sendViaProvider() first.`
    );
  }

  getStats() {
    return {
      queued: this.queue.length,
      sent: this.sent.length,
      failed: this.failed.length,
    };
  }
}

module.exports = DeliveryQueue;
