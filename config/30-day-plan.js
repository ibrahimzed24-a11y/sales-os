/**
 * Valioz Health — 30-Day Email Marketing Plan
 * Source: health_valioz_copywriting.md (Part 2)
 * Cadence: Mon / Wed / Fri
 * Framework: PAS (awareness) | AIDA (conversion)
 * Primary CTA: Book a 15-minute Growth Audit
 */

const PLAN = [
  { day: 1,  dow: 'Mon', framework: 'PAS',  template: '02-pas-awareness', subject: 'Your website is losing patients while you sleep', cta: 'Book Your Free Growth Audit', ctaLink: '/' },
  { day: 3,  dow: 'Wed', framework: 'PAS',  template: '02-pas-awareness', subject: 'The $3,000 patient you\'re not seeing', cta: 'See the Audit', ctaLink: '/' },
  { day: 5,  dow: 'Fri', framework: 'PAS',  template: '02-pas-awareness', subject: 'AI is answering patient questions. Is it naming you?', cta: 'Claim your GEO readiness check', ctaLink: '/solutions/' },
  { day: 8,  dow: 'Mon', framework: 'AIDA', template: '03-aida-conversion', subject: 'What a patient-winning healthcare website actually looks like', cta: 'Schedule a Website Review', ctaLink: '/contact/' },
  { day: 10, dow: 'Wed', framework: 'AIDA', template: '03-aida-conversion', subject: 'SEO for healthcare isn\'t generic. Here\'s why.', cta: 'Get your healthcare SEO audit', ctaLink: '/solutions/' },
  { day: 12, dow: 'Fri', framework: 'AIDA', template: '03-aida-conversion', subject: 'GEO: The new SEO your competitors haven\'t heard of yet', cta: 'Book your GEO readiness session', ctaLink: '/solutions/' },
  { day: 15, dow: 'Mon', framework: 'PAS',  template: '04-case-study', subject: 'How a dental practice added 40 bookings/month', cta: 'Read the full case study', ctaLink: '/insights/' },
  { day: 17, dow: 'Wed', framework: 'PAS',  template: '04-case-study', subject: 'Psychologist practice: from invisible to top 3 local pack', cta: 'See how we did it', ctaLink: '/insights/' },
  { day: 19, dow: 'Fri', framework: 'AIDA', template: '03-aida-conversion', subject: 'The tracking most practices ignore (and why it costs them)', cta: 'Book a performance tracking setup call', ctaLink: '/contact/' },
  { day: 22, dow: 'Mon', framework: 'AIDA', template: '03-aida-conversion', subject: 'Your next 10 patients are searching right now', cta: 'Book your 15-minute Growth Audit this week', ctaLink: '/' },
  { day: 24, dow: 'Wed', framework: 'PAS+Urgency', template: '05-urgency', subject: 'Last chance: free growth audit this month', cta: 'Claim Your Audit Spot', ctaLink: '/' },
  { day: 26, dow: 'Fri', framework: 'AIDA', template: '03-aida-conversion', subject: 'The patient acquisition system, in one call', cta: 'Schedule your Growth Audit', ctaLink: '/' },
  { day: 29, dow: 'Mon', framework: 'PAS',  template: '02-pas-awareness', subject: 'Are you booked out for next month?', cta: 'Book Your Growth Audit', ctaLink: '/' },
];

const MERGE_TAGS = {
  // Contact fields resolved per recipient
  first_name: '{{first_name}}',
  last_name: '{{last_name}}',
  email: '{{email}}',
  company: '{{company}}',
  city: '{{city}}',
  specialty: '{{specialty}}',
  // System fields
  unsubscribe_url: '{{unsubscribe_url}}',
  cta_link: '{{cta_link}}',
  cta_text: '{{cta_text}}',
  // Valioz brand
  logo_url: '{{logo_url}}',
  valioz_site: 'https://health.valioz.com',
};

module.exports = { PLAN, MERGE_TAGS };
