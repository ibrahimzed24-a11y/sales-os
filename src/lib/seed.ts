import type {
  Account,
  Activity,
  ActivityStatus,
  ActivityType,
  Contact,
  Deal,
  Entities,
  LeadSource,
  LeadStatus,
  PlaybookCategory,
  PlaybookItem,
  Priority,
  Product,
  Quote,
  StageId,
  Tier,
} from '@/types/sales-os';

const REPS = ['Sara Ali', 'Omar Hassan', 'Lina Park'];

export function buildSeed(): Entities {
  const now = Date.now();
  const iso = (off: number) => new Date(now + off * 86400000).toISOString();
  const day = (off: number) => iso(off).slice(0, 10);

  const accT: [string, string, string, number, number, Tier][] = [
    ['Northwind Logistics', 'northwind.io', 'Logistics', 1200, 240000000, 'Enterprise'],
    ['Helix Biotech', 'helixbio.com', 'Healthcare', 640, 98000000, 'Enterprise'],
    ['Brightpath Education', 'brightpath.edu', 'Education', 310, 36000000, 'Mid-Market'],
    ['Quanta Financial', 'quantafin.com', 'Financial Services', 880, 150000000, 'Enterprise'],
    ['Lumen Retail Group', 'lumenretail.com', 'Retail', 420, 61000000, 'Mid-Market'],
    ['Atlas Manufacturing', 'atlasmfg.com', 'Manufacturing', 950, 120000000, 'Enterprise'],
    ['Pixelforge Studios', 'pixelforge.co', 'Media', 45, 4200000, 'SMB'],
    ['Cedar Health Network', 'cedarhealth.org', 'Healthcare', 270, 28000000, 'Mid-Market'],
  ];
  const accounts: Account[] = accT.map((a, i) => ({
    id: `acc_${i + 1}`,
    name: a[0],
    domain: a[1],
    industry: a[2],
    size: a[3],
    annualRevenue: a[4],
    tier: a[5],
    createdAt: iso(-200 + i * 6),
  }));

  const conT: [string, string, string, number, LeadStatus, number, LeadSource, string[]][] = [
    ['Maya', 'Chen', 'VP Operations', 0, 'Qualified', 88, 'Inbound', ['decision-maker']],
    ['Daniel', 'Reyes', 'IT Director', 0, 'Working', 64, 'Outbound', ['technical']],
    ['Priya', 'Nair', 'Chief Medical Officer', 1, 'Qualified', 91, 'Referral', ['champion']],
    ['Tom', 'Becker', 'Procurement Lead', 1, 'Contacted', 52, 'Outbound', ['procurement']],
    ['Aisha', 'Khan', 'Head of Digital', 2, 'Working', 70, 'Inbound', ['champion']],
    ['Lucas', 'Meyer', 'CFO', 3, 'Qualified', 85, 'Partner', ['decision-maker', 'finance']],
    ['Elena', 'Petrova', 'Risk Manager', 3, 'New', 40, 'Outbound', []],
    ['Noah', 'Williams', 'COO', 4, 'Contacted', 58, 'Inbound', ['decision-maker']],
    ['Sofia', 'Rossi', 'Marketing Director', 4, 'Working', 66, 'Inbound', ['marketing']],
    ['Hiroshi', 'Tanaka', 'Plant Director', 5, 'Qualified', 82, 'Referral', ['decision-maker']],
    ['Grace', 'Okafor', 'Supply Chain Lead', 5, 'Contacted', 55, 'Outbound', ['technical']],
    ['Ben', 'Foster', 'Founder', 6, 'New', 35, 'Inbound', ['founder']],
    ['Layla', 'Mansour', 'Ops Manager', 7, 'Working', 61, 'Partner', []],
    ['Chris', 'Doyle', 'Sales Director', 2, 'Unqualified', 20, 'Outbound', ['cold']],
    ['Mina', 'Sato', 'Head of Procurement', 5, 'New', 45, 'Inbound', ['procurement']],
  ];
  const contacts: Contact[] = conT.map((c, i) => ({
    id: `con_${i + 1}`,
    accountId: accounts[c[3]].id,
    firstName: c[0],
    lastName: c[1],
    email: `${c[0].toLowerCase()}.${c[1].toLowerCase()}@${accounts[c[3]].domain}`,
    phone: `+1 415 555 01${10 + i}`,
    role: c[2],
    leadStatus: c[4],
    leadScore: c[5],
    source: c[6],
    tags: c[7],
    owner: REPS[i % 3],
    lastContactedAt: c[4] === 'New' ? null : iso(-(i % 9) - 1),
    createdAt: iso(-120 + i * 4),
  }));

  const dealT: [string, number, number, StageId, number, number, number][] = [
    ['Northwind Fleet Platform', 0, 0, 'negotiation', 120000, 18, 2],
    ['Helix Clinical Rollout', 1, 2, 'proposal', 85000, 30, 3],
    ['Brightpath LMS Pilot', 2, 4, 'discovery', 36000, 45, 5],
    ['Quanta Compliance Suite', 3, 5, 'negotiation', 95000, 21, 1],
    ['Lumen Omnichannel POS', 4, 7, 'demo', 62000, 40, 9],
    ['Atlas Plant Analytics', 5, 9, 'proposal', 72000, 33, 11],
    ['Pixelforge Team Plan', 6, 11, 'lead_in', 18000, 60, 2],
    ['Cedar Patient Portal', 7, 12, 'discovery', 48000, 50, 8],
    ['Atlas Procurement Add-on', 5, 14, 'lead_in', 28000, 70, 4],
    ['Northwind Analytics Upsell', 0, 1, 'closed_won', 54000, -3, 2],
    ['Helix Training Package', 1, 3, 'closed_won', 41000, -10, 2],
    ['Lumen Loyalty Module', 4, 8, 'closed_lost', 33000, -15, 12],
  ];
  const deals: Deal[] = dealT.map((d, i) => ({
    id: `deal_${i + 1}`,
    title: d[0],
    accountId: accounts[d[1]].id,
    primaryContactId: contacts[d[2]].id,
    stage: d[3],
    value: d[4],
    currency: 'USD',
    probability: { lead_in: 10, discovery: 25, demo: 40, proposal: 60, negotiation: 80, closed_won: 100, closed_lost: 0 }[d[3]],
    expectedCloseDate: day(d[5]),
    lossReason: d[3] === 'closed_lost' ? 'Chose incumbent vendor' : undefined,
    notes: '',
    owner: REPS[i % 3],
    updatedAt: iso(-d[6]),
    createdAt: iso(-60 - i * 3),
  }));

  const actT: [ActivityType, string, ActivityStatus, Priority, number, number, number, string][] = [
    ['call', 'Pricing call with Maya Chen', 'pending', 'urgent', 0, 0, 0, ''],
    ['email', 'Send security questionnaire to Helix', 'pending', 'high', -2, 1, 2, ''],
    ['meeting', 'Demo for Lumen leadership', 'pending', 'high', 0, 4, 7, ''],
    ['task', 'Prepare Atlas ROI model', 'pending', 'medium', 3, 5, 9, ''],
    ['call', 'Discovery call with Aisha Khan', 'completed', 'medium', -4, 2, 4, 'Connected'],
    ['email', 'Follow up on proposal - Quanta', 'pending', 'high', -1, 3, 5, ''],
    ['note', 'Quanta CFO wants 24-month term', 'completed', 'low', -2, 3, 5, ''],
    ['call', 'Intro call with Ben Foster', 'pending', 'low', 2, 6, 11, ''],
    ['meeting', 'Contract review with Northwind legal', 'pending', 'urgent', 1, 0, 0, ''],
    ['call', 'Left voicemail for Tom Becker', 'completed', 'medium', -3, 1, 3, 'Left Voicemail'],
    ['task', 'LinkedIn touch - Hiroshi Tanaka', 'pending', 'low', 0, 5, 9, ''],
    ['email', 'Send case study to Cedar Health', 'pending', 'medium', 4, 7, 12, ''],
    ['call', 'Check-in with Noah Williams', 'completed', 'medium', -6, 4, 7, 'No Answer'],
    ['meeting', 'Kickoff for Helix Training', 'completed', 'high', -9, 1, 3, 'Connected'],
    ['task', 'Update CRM notes for stale deals', 'pending', 'medium', -1, 4, 8, ''],
  ];
  const activities: Activity[] = actT.map((a, i) => ({
    id: `act_${i + 1}`,
    type: a[0],
    subject: a[1],
    description: '',
    status: a[2],
    priority: a[3],
    dueDate: day(a[4]),
    dealId: deals[a[5]].id,
    contactId: contacts[a[6]].id,
    outcome: a[7],
    createdAt: iso(-12 + i),
  }));

  const prodT: [string, string, 'recurring' | 'one-time', 'monthly' | 'annual' | 'one-time', number][] = [
    ['SOS-CORE', 'Platform Core (per seat)', 'recurring', 'monthly', 45],
    ['SOS-PRO', 'Platform Pro (per seat)', 'recurring', 'monthly', 85],
    ['SOS-ENT', 'Enterprise License', 'recurring', 'annual', 48000],
    ['SOS-ONB', 'Onboarding & Setup', 'one-time', 'one-time', 6500],
    ['SOS-TRN', 'Team Training Workshop', 'one-time', 'one-time', 3000],
    ['SOS-SUP', 'Premium Support', 'recurring', 'annual', 9000],
  ];
  const products: Product[] = prodT.map((p, i) => ({
    id: `prod_${i + 1}`,
    sku: p[0],
    name: p[1],
    kind: p[2],
    billingCycle: p[3],
    basePrice: p[4],
  }));

  const mk = (id: string, deal: number, status: Quote['status'], items: [number, number, number][], tax: number): Quote => {
    const qi = items.map((it) => ({
      productId: products[it[0]].id,
      name: products[it[0]].name,
      quantity: it[1],
      unitPrice: products[it[0]].basePrice,
      discount: it[2],
    }));
    const sub = qi.reduce((a, l) => a + l.quantity * l.unitPrice * (1 - l.discount / 100), 0);
    return {
      id,
      dealId: deals[deal].id,
      status,
      items: qi,
      taxRate: tax,
      totalAmount: Math.round(sub * (1 + tax / 100)),
      validUntil: day(20),
      createdAt: iso(-5),
    };
  };
  const quotes: Quote[] = [
    mk('quote_1', 0, 'Sent', [[2, 2, 10], [3, 1, 0], [5, 1, 0]], 0),
    mk('quote_2', 1, 'Draft', [[1, 60, 15], [3, 1, 0], [4, 2, 0]], 8),
    mk('quote_3', 3, 'Accepted', [[2, 1, 5], [5, 1, 0]], 0),
  ];

  const pbT: [PlaybookCategory, string, string[], string][] = [
    ['Script', 'Cold call opener', ['cold', 'call'], 'Hi {{first_name}}, this is [your name] from Sales OS. I know I am calling out of the blue - do you have 30 seconds to hear why I called, and then you can tell me if it makes sense to continue?\n\nWe help teams like {{company}} see their whole pipeline in one place. Is managing follow-ups a pain right now?'],
    ['Framework', 'BANT qualification', ['qualification'], 'Budget: Is there an approved budget? Who controls it?\nAuthority: Who signs off, and who else is involved?\nNeed: What happens if nothing changes?\nTimeline: What is driving the date you want this live by?'],
    ['Framework', 'MEDDIC checklist', ['qualification', 'enterprise'], 'Metrics: Which numbers will improve?\nEconomic buyer: Who owns the budget?\nDecision criteria: How will you choose?\nDecision process: What are the steps and dates?\nIdentify pain: What is it costing today?\nChampion: Who is selling this internally?'],
    ['Template', 'Follow-up after demo', ['email', 'demo'], 'Subject: Next steps for {{company}}\n\nHi {{first_name}},\n\nThanks for your time today. As promised, here is a recap of what we covered and the next step: a short call with your finance lead to review pricing.\n\nDoes Thursday work?\n\nBest,\n[your name]'],
    ['Template', 'Breakup email', ['email', 'cold'], 'Subject: Should I close your file?\n\nHi {{first_name}},\n\nI have not heard back, so I will assume the timing is not right for {{company}}. If that changes, reply to this email and I will pick it up from here.\n\nBest,\n[your name]'],
    ['Objection', '"It is too expensive"', ['price'], 'Acknowledge: "I understand - budget matters."\nExplore: "Compared to what? What number did you have in mind?"\nReframe: Tie the price to the cost of the problem (lost deals, wasted rep hours).\nClose: "If the ROI is clear, would this fit your budget?"'],
    ['Objection', '"We already use a competitor"', ['competitor'], 'Acknowledge: "Great, that means you value this problem."\nExplore: "What would you change about it if you could?"\nDifferentiate: Focus on one gap they named, not a feature list.\nClose: Offer a side-by-side pilot with one team.'],
    ['Objection', '"Send me an email"', ['brush-off'], 'Acknowledge: "Happy to."\nQualify: "So I send the right thing, what is the one problem you would want fixed?"\nCommit: Book a 15-minute follow-up before the email is sent.'],
  ];
  const playbooks: PlaybookItem[] = pbT.map((p, i) => ({
    id: `pb_${i + 1}`,
    category: p[0],
    title: p[1],
    tags: p[2],
    content: p[3],
    updatedAt: iso(-30 + i),
  }));

  return { accounts, contacts, deals, activities, products, quotes, playbooks };
}
