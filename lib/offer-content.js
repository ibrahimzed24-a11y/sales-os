/**
 * Shared offer backbone for the five-step sequence.
 *
 * The same snapshot, patient-journey, VALIOZ difference, ownership and pricing
 * sections appear in every email. Keeping them here means the offer is edited
 * once, not five times, and every step stays consistent.
 *
 * Journey step 01 ("Your own custom website") is offered ONLY to clinics that
 * do not have a live website. Clinics that already have a running site never
 * see that step — the remaining journey steps renumber accordingly.
 *
 * All figures come from lib/sourced-data.js — the actual Keyword Planner
 * values. They are Canada-wide ranges, not local estimates, and are labelled
 * as such in the email.
 */

const { SNAPSHOT, LIMITATIONS, INSIGHT } = require('./sourced-data');

const BAR_TONES = { teal: '#03A8A4', navy: '#173A55', light: '#A5D9D5' };

const RANGE_DISPLAY = { '100-1K': '100-1K', '1K-10K': '1K-10K', '10K-100K': '10K-100K', '100K-1M': '100K-1M' };

function queryRows() {
  return SNAPSHOT.queries
    .map(
      (q) => `<tr>
        <td width="50%" valign="top" style="padding:0 5px 0 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F1F8F7;border-radius:11px;">
            <tr>
              <td style="padding:20px 14px;">
                <div style="font-size:31px;letter-spacing:-1px;color:#063F4E;font-weight:bold;">${RANGE_DISPLAY[q.range]}</div>
                <div style="color:#59717A;font-size:12px;line-height:1.5;margin-top:5px;">Monthly searches for &ldquo;${q.label}&rdquo; — ${q.competition} competition</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join('')
    .replace(/<tr>\n        <td width="50%" valign="top" style="padding:0 5px 0 0;">/g, '<tr>')
    .replace(/<\/table>\n        <\/td>\n      <\/tr>/g, '</table>\n        </td>');
}

function barRows() {
  return SNAPSHOT.bars
    .map((bar, index) => {
      const tone = BAR_TONES[bar.tone] || BAR_TONES.teal;
      const padLeft = index === 0 ? '18px 8px 0 0' : '14px 8px 0 0';
      const trackPad = index === 0 ? '18px 10px 0 0' : '14px 10px 0 0';
      return `<tr>
          <td class="barlabel" width="135" valign="middle" style="font-size:12px;color:#536A76;padding:${padLeft};">${bar.label}</td>
          <td valign="middle" style="padding:${trackPad};">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#EDF3F4;border-radius:10px;">
              <tr>
                <td width="${bar.width}%" style="background:${tone};height:12px;border-radius:10px;font-size:0;line-height:0;">&nbsp;</td>
                <td width="${100 - bar.width}%" style="font-size:0;line-height:0;">&nbsp;</td>
              </tr>
            </table>
          </td>
          <td width="40" align="right" valign="middle" style="font-size:12px;font-weight:bold;padding:${index === 0 ? '18px' : '14px'} 0 0 0;">${bar.range}</td>
        </tr>`;
    })
    .join('\n        ');
}

function ctaBlock({ clinicName, ctaLink, ctaText, psCopy }) {
  return `<tr>
  <td class="pad" style="padding:30px 42px 34px 42px;">
    <div style="font-size:18px;font-weight:bold;text-align:center;color:#172C46;margin:0 0 14px 0;">
      Would you like this built for ${clinicName}?
    </div>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td align="center">
          <a class="btn-link" href="${ctaLink}" target="_blank"
             style="display:inline-block;background:#00AFA5;color:#FFFFFF;border-radius:9px;padding:16px 34px;
                    text-align:center;font-size:17px;font-weight:bold;text-decoration:none;">
            ${ctaText}
          </a>
        </td>
      </tr>
    </table>
    <div class="reply-box" style="margin:15px auto 0;background:#E9F7F4;color:#0B4A4A;border-radius:9px;padding:16px;
                text-align:center;font-size:17px;font-weight:bold;">
      Just reply YES
    </div>
    <p style="font-size:12px;color:#526774;text-align:center;margin:12px 0 0 0;">
      We&rsquo;ll explain the next steps personally. No software to learn.
    </p>
    <div style="height:1px;background:#E5EDED;margin:24px 0 20px 0;"></div>
    <p style="font-size:13px;line-height:1.6;color:#566B79;margin:0;">
      P.S.&nbsp;<strong>${psCopy}</strong>
    </p>
  </td>
</tr>`;
}

function journeyRows({ hasWebsite }) {
  // Journey items: { number, title, body }
  const items = [
    {
      number: '01',
      title: 'Your own custom website',
      body: 'Designed for your clinic, not pulled from a generic SaaS template. Mobile-first service pages, team introduction, trust signals, and an easy appointment path.',
    },
    {
      number: '02',
      title: 'Google Search + Google Business Profile',
      body: 'Local SEO, treatment keyword research, service content, Business Profile optimization, photos and ongoing posts or updates with your approval.',
    },
    {
      number: '03',
      title: 'GEO + AI visibility',
      body: 'Content structured for discoverability in AI-powered search, plus research into questions patients ask and where your clinic may have visibility gaps.',
    },
    {
      number: '04',
      title: 'Instagram + TikTok search',
      body: '8 branded social designs and 6 short-form video assets for TikTok and Reels, informed by patient interests and relevant search topics.',
    },
    {
      number: '05',
      title: 'Content + measurement',
      body: '8 SEO-focused articles, Google Analytics 4, Google Tag Manager, and Search Console setup to understand activity and guide improvements.',
    },
  ];

  // Clinics with a live website never get offered a custom website — drop item 01.
  const filtered = hasWebsite ? items.slice(1) : items;

  return filtered
    .map(
      (item, index) => `<tr>
        <td width="28" valign="top" style="padding:15px 0;border-bottom:1px solid #E6EDED;color:#00A6A1;font-size:12px;font-weight:bold;">
          ${index + 1}
        </td>
        <td valign="top" style="padding:15px 0;border-bottom:1px solid #E6EDED;">
          <b style="font-size:14px;color:#172C46;">${item.title}</b>
          <p style="margin:4px 0 0 0;color:#637782;font-size:12px;line-height:1.55;">${item.body}</p>
        </td>
      </tr>`
    )
    .join('\n      ');
}

function offerBlock({ hasWebsite = false } = {}) {
  return `<tr>
  <td class="pad" style="padding:0 42px 0 42px;">
    <div style="height:1px;background:#E5EDED;margin:30px 0;"></div>
    <div style="font-size:12px;color:#667D88;font-weight:bold;letter-spacing:.7px;text-transform:uppercase;">
      Your search snapshot &nbsp;
      <span style="display:inline-block;background:#FFF3DC;color:#865F18;font-size:10px;font-weight:bold;padding:5px 8px;border-radius:4px;letter-spacing:.4px;text-transform:none;">
        Real Keyword Planner data — Canada-wide
      </span>
    </div>
    <table class="metric-col" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:21px;">
      <tr>
        <td width="50%" valign="top" style="padding:0 5px 0 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F1F8F7;border-radius:11px;">
            <tr>
              <td style="padding:20px 14px;">
                <div style="font-size:31px;letter-spacing:-1px;color:#063F4E;font-weight:bold;">${SNAPSHOT.queries[0].range}</div>
                <div style="color:#59717A;font-size:12px;line-height:1.5;margin-top:5px;">Monthly searches for &ldquo;${SNAPSHOT.queries[0].label}&rdquo; — ${SNAPSHOT.queries[0].competition} competition</div>
              </td>
            </tr>
          </table>
        </td>
        <td width="50%" valign="top" style="padding:0 0 0 5px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F1F8F7;border-radius:11px;">
            <tr>
              <td style="padding:20px 14px;">
                <div style="font-size:31px;letter-spacing:-1px;color:#063F4E;font-weight:bold;">${SNAPSHOT.queries[1].range}</div>
                <div style="color:#59717A;font-size:12px;line-height:1.5;margin-top:5px;">Monthly searches for &ldquo;${SNAPSHOT.queries[1].label}&rdquo; — ${SNAPSHOT.queries[1].competition} competition</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <div style="padding:22px;border:1px solid #E2ECEB;border-radius:12px;margin-top:17px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td align="left" style="font-size:14px;font-weight:bold;color:#172C46;">Where patient search demand sits</td>
          <td align="right" style="font-size:11px;color:#7B8B93;">Monthly volume (range)</td>
        </tr>
      </table>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        ${barRows()}
      </table>
      <div style="font-size:12px;color:#5E727C;background:#F4F8F8;border-left:3px solid #00A9A4;padding:12px 14px;margin-top:18px;line-height:1.6;">
        <b>What this means:</b> ${INSIGHT}
      </div>
    </div>
  </td>
</tr>
<tr>
  <td class="pad" style="padding:0 42px 0 42px;">
    <div style="height:1px;background:#E5EDED;margin:30px 0;"></div>
    <h2 style="font-size:24px;line-height:1.2;letter-spacing:-.65px;margin:0 0 12px 0;color:#172C46;font-weight:bold;">
      Imagine the patient journey working for you.
    </h2>
    <p style="font-size:14px;line-height:1.7;color:#526774;margin:0;">
      Someone searches Google, compares nearby practices on Maps, checks Instagram or TikTok, asks an AI assistant, then looks for a clinic they trust enough to contact. We build your presence around that entire journey.
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top:1px solid #E6EDED;margin-top:24px;">
      ${journeyRows({ hasWebsite })}
    </table>
  </td>
</tr>
<tr>
  <td class="dark" style="background:#122F47;padding:28px 42px;">
    <div style="font-size:11px;font-weight:800;letter-spacing:2.1px;color:#65E3D4;text-transform:uppercase;">The VALIOZ difference</div>
    <h2 style="font-size:24px;line-height:1.2;margin:7px 0 10px 0;color:#FFFFFF;font-weight:bold;">
      Real humans.<br><span style="color:#57E1D2;">AI-powered momentum.</span>
    </h2>
    <p style="color:#D0E2E8;font-size:13px;line-height:1.7;margin:0;">
      You&rsquo;re not buying a self-serve dashboard or a recycled website. Our human team guides strategy, design and quality while your AI Growth Agent researches keywords, monitors competitors, identifies content gaps, and supports ongoing execution.
    </p>
    <table class="two" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:15px;">
      <tr>
        <td width="50%" valign="top" style="padding:0 18px 0 0;">
          <b style="color:#FFFFFF;font-size:14px;">Human expertise</b>
          <p style="color:#D0E2E8;font-size:13px;line-height:1.7;margin:4px 0 0 0;">Strategy, custom design, review, brand and patient experience.</p>
        </td>
        <td width="50%" valign="top" style="padding:0 0 0 18px;">
          <b style="color:#FFFFFF;font-size:14px;">Daily Growth Brief</b>
          <p style="color:#D0E2E8;font-size:13px;line-height:1.7;margin:4px 0 0 0;">A clear daily update covering work completed, opportunities discovered and what&rsquo;s next.</p>
        </td>
      </tr>
    </table>
  </td>
</tr>
<tr>
  <td class="pad" style="padding:30px 42px 0 42px;">
    <div style="background:#F2F8F7;padding:24px;border-radius:12px;">
      <strong style="font-size:17px;color:#172C46;">Your clinic. Your digital assets.</strong>
      <p style="font-size:13px;color:#637783;line-height:1.65;margin:8px 0 0 0;">
        You purchase your domain and hosting directly in accounts you control, with their costs paid separately. Your website and connected business accounts remain yours. We work using the access you grant us. No rented website or mandatory platform subscription.
      </p>
    </div>
    <div style="background:#E9F7F4;border-radius:14px;padding:25px;margin-top:25px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:2.1px;color:#00AFA5;text-transform:uppercase;">Your 30-day launch</div>
      <div style="margin:10px 0 6px 0;">
        <span style="font-size:51px;line-height:1;font-weight:800;color:#063E4C;letter-spacing:-2px;">$499</span>
        <span style="font-size:13px;color:#526B75;">one time</span>
      </div>
      <div style="font-size:13px;color:#526B75;line-height:1.65;">
        <b>Custom website + 30 days of Human + AI Growth service included.</b><br>
        Includes the SEO, Google Business Profile, AI visibility, content, social, video, analytics and daily briefs described above.
      </div>
      <div style="height:1px;background:#C8E4E0;margin:18px 0;"></div>
      <b style="font-size:14px;color:#172C46;">After 30 days: $299/month, optional.</b>
      <div style="margin-top:15px;font-size:12px;color:#55727C;line-height:1.65;">
        Keep your website even if you stop. Domain and hosting are purchased separately by you. Publishing and production require access, clinic details and suitable approved materials.
      </div>
    </div>
  </td>
</tr>`;
}

module.exports = { offerBlock, ctaBlock };
