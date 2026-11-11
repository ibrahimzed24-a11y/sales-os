'use client';

import React, { useState } from 'react';
import { Search, MapPin, Calendar, Check, ExternalLink, RefreshCw, Smartphone, Monitor, Sparkles } from 'lucide-react';

interface PrototypeEmailProps {
  clinicName?: string;
  city?: string;
  logoUrl?: string;
  websiteUrl?: string;
}

export function PrototypeEmail({
  clinicName = 'Brampton Dental Arts',
  city = 'Brampton',
  logoUrl = 'https://osv.nilesupplies.com/assets/clinic-logos/brampton-dental-arts.png',
  websiteUrl = 'https://bramptondentalarts.com/',
}: PrototypeEmailProps) {
  const [activeClinic, setActiveClinic] = useState(clinicName);
  const [activeCity, setActiveCity] = useState(city);
  const [activeStep, setActiveStep] = useState<'01-welcome' | '02-case-study' | '03-value-add' | '04-breakup'>('01-welcome');
  const [activeAngle, setActiveAngle] = useState<'DEMAND_SURGE' | 'MAP_RANK_DEFENSE' | 'INTAKE_OPTIMIZATION' | 'PRACTICE_BENCHMARK' | 'AI_OVERVIEW_GEO'>('DEMAND_SURGE');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  const getHeroContent = () => {
    if (activeStep === '02-case-study') {
      return {
        eyebrow: `${activeCity.toUpperCase()} PRACTICE BENCHMARK • CASE STUDY`,
        headline: <>How leading independent clinics in {activeCity} protect their <span className="text-[#00AFA5]">patient intake.</span></>,
        lead: `A comparative look at how ${activeClinic}'s digital presence benchmarks against local practices capturing high-production implant and Invisalign cases.`,
        cta: 'View Comparative Case Study →',
      };
    }
    if (activeStep === '03-value-add') {
      return {
        eyebrow: `${activeCity.toUpperCase()} AFTER-HOURS INTAKE TEARDOWN`,
        headline: <>Are patients searching after 5 PM booking with <span className="text-[#00AFA5]">{activeClinic}?</span></>,
        lead: `Over 43% of local dental inquiries happen outside operatory hours. Here's a 3-minute diagnostic teardown on capturing those lost bookings.`,
        cta: 'Watch 3-Min Intake Teardown →',
      };
    }
    if (activeStep === '04-breakup') {
      return {
        eyebrow: `${activeCity.toUpperCase()} DIAGNOSTIC ARCHIVE • FINAL BRIEF`,
        headline: <>Archiving {activeClinic}&apos;s growth diagnostic for <span className="text-[#00AFA5]">{activeCity}.</span></>,
        lead: `We are closing out this quarter's private practice audit for ${activeCity}. Leaving your interactive diagnostic access open in case your team reviews it later.`,
        cta: 'Access Permanent Audit →',
      };
    }

    switch (activeAngle) {
      case 'MAP_RANK_DEFENSE':
        return {
          eyebrow: `${activeCity.toUpperCase()} LOCAL RANK & 3-PACK DEFENSE`,
          headline: <>Defending <span className="text-[#00AFA5]">{activeClinic}</span> against corporate rollups in {activeCity}.</>,
          lead: `Here is how ${activeClinic}'s Google Maps footprint benchmarks against private and DSO practices in ${activeCity}.`,
          cta: 'View Your Full Growth Audit →',
        };
      case 'INTAKE_OPTIMIZATION':
        return {
          eyebrow: `${activeCity.toUpperCase()} DIGITAL INTAKE AUDIT`,
          headline: <>Converting local patient interest into booked chairs in <span className="text-[#00AFA5]">{activeCity}.</span></>,
          lead: `A fast diagnostic of ${activeClinic}'s inquiry-to-appointment conversion and after-hours patient capture.`,
          cta: 'View Your Full Growth Audit →',
        };
      case 'PRACTICE_BENCHMARK':
        return {
          eyebrow: `${activeCity.toUpperCase()} PRACTICE ACQUISITION BENCHMARK`,
          headline: <>High-production dental demand in <span className="text-[#00AFA5]">{activeCity}.</span></>,
          lead: `Comparative patient discovery metrics and restorative treatment volume benchmarks for ${activeClinic}.`,
          cta: 'View Your Full Growth Audit →',
        };
      case 'AI_OVERVIEW_GEO':
        return {
          eyebrow: `${activeCity.toUpperCase()} AI OVERVIEWS & CONVERSATIONAL SEARCH`,
          headline: <>How {activeCity} patients discover <span className="text-[#00AFA5]">{activeClinic}</span> on Google AI.</>,
          lead: `Analysis of search queries structured for Google AI Overviews and modern voice patient acquisition.`,
          cta: 'View Your Full Growth Audit →',
        };
      default: // DEMAND_SURGE
        return {
          eyebrow: `${activeCity.toUpperCase()} MARKET INSIGHTS`,
          headline: <>More patients are searching for dental care in <span className="text-[#00AFA5]">{activeCity}.</span></>,
          lead: `Here's a quick growth audit for ${activeClinic} and what it means for your next stage of growth.`,
          cta: 'View Your Full Growth Audit →',
        };
    }
  };

  const hero = getHeroContent();

  return (
    <div className="space-y-4">
      {/* Control Bar: Sequence Step + Angle + Viewport */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-fg">Sequence Step:</span>
            {[
              { id: '01-welcome', label: 'Step 1: Growth Audit' },
              { id: '02-case-study', label: 'Step 2: Case Study' },
              { id: '03-value-add', label: 'Step 3: Teardown' },
              { id: '04-breakup', label: 'Step 4: Resource Handoff' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveStep(s.id as any)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  activeStep === s.id
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-muted/10 text-muted hover:text-fg hover:bg-muted/20'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 border border-line rounded-lg p-0.5 bg-background">
            <button
              onClick={() => setViewMode('desktop')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition ${
                viewMode === 'desktop' ? 'bg-teal-600 text-white' : 'text-muted hover:text-fg'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" /> Desktop (600px)
            </button>
            <button
              onClick={() => setViewMode('mobile')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition ${
                viewMode === 'mobile' ? 'bg-teal-600 text-white' : 'text-muted hover:text-fg'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" /> Mobile Phone (375px)
            </button>
          </div>
        </div>

        {activeStep === '01-welcome' && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-medium text-muted">Twisted Pitch Angle:</span>
            {[
              { id: 'DEMAND_SURGE', label: 'Demand Surge' },
              { id: 'MAP_RANK_DEFENSE', label: 'Map Rank Defense' },
              { id: 'INTAKE_OPTIMIZATION', label: 'Intake Optimization' },
              { id: 'PRACTICE_BENCHMARK', label: 'Practice Benchmark' },
              { id: 'AI_OVERVIEW_GEO', label: 'AI/GEO Visibility' },
            ].map((a) => (
              <button
                key={a.id}
                onClick={() => setActiveAngle(a.id as any)}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                  activeAngle === a.id
                    ? 'bg-teal-500/20 text-teal-700 dark:text-teal-300 font-bold border border-teal-500/30'
                    : 'text-muted hover:text-fg'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Email Container (Pure White #ffffff) */}
      <div className="w-full flex justify-center bg-slate-100 p-4 sm:p-8 rounded-2xl overflow-x-auto">
        <div
          style={{ width: viewMode === 'mobile' ? '375px' : '600px' }}
          className="bg-white border border-slate-200 text-[#142C49] shadow-2xl transition-all duration-300 rounded-2xl p-6 sm:p-8"
        >
          {/* 1. Dual-Brand Header Component */}
          <div className="flex items-center justify-between border-b border-[#EEF3F4] pb-4 mb-6">
            <div className="flex items-center gap-3">
              <img
                src="https://osv.nilesupplies.com/assets/valioz-logo-horizontal.png"
                alt="VALIOZ Health"
                className="h-7 sm:h-8 w-auto object-contain"
              />
              <span className="text-[#CBD5E1] text-xl font-light">|</span>
              <img
                src={logoUrl}
                alt={activeClinic}
                className="h-7 sm:h-8 max-w-[140px] sm:max-w-[170px] w-auto object-contain"
              />
            </div>
            {viewMode === 'desktop' && (
              <span className="inline-flex items-center rounded-full bg-[#E6F8F7] px-3 py-1 text-xs font-bold text-[#008E91]">
                📊 Growth Audit
              </span>
            )}
          </div>

          {/* 2. Hero Section: Two-Column on Desktop, Stacked on Mobile */}
          <div className={`mb-7 ${viewMode === 'desktop' ? 'grid grid-cols-12 gap-5 items-center' : 'space-y-4'}`}>
            <div className={viewMode === 'desktop' ? 'col-span-7' : 'w-full'}>
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#00AFA5] mb-2">
                {hero.eyebrow}
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold leading-snug tracking-tight text-[#142C49] mb-3">
                {hero.headline}
              </h1>
              <p className="text-xs sm:text-sm text-[#506879] leading-relaxed mb-4">
                {hero.lead}
              </p>
              <div>
                <a
                  href="https://health.valioz.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-full bg-[#00AFA5] px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-[#009b93] transition"
                >
                  {hero.cta}
                </a>
              </div>
            </div>

            <div className={viewMode === 'desktop' ? 'col-span-5' : 'w-full pt-2'}>
              <img
                src="https://osv.nilesupplies.com/assets/dental-chair-hero.jpg"
                alt="Modern Dental Operatory"
                className="w-full rounded-xl object-cover shadow-sm border border-slate-100 max-h-[220px]"
              />
            </div>
          </div>

          {/* 3. Three Smart Stat Cards Component */}
          <div className={`grid ${viewMode === 'desktop' ? 'grid-cols-3' : 'grid-cols-1'} gap-2.5 mb-7`}>
            <div className="rounded-xl border border-[#DDEEF0] bg-[#F0F8F9] p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#556C7A]">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E1F3F4] text-[10px]">🔍</span>
                Local Search Demand
              </div>
              <div className="mt-2 text-xl font-extrabold text-[#142C49]">
                ~18.4K <span className="text-xs font-semibold text-[#788F9D]">/mo</span>
              </div>
              <div className="mt-0.5 text-[10px] text-[#788F9D]">Dental services in {activeCity}</div>
            </div>

            <div className="rounded-xl border border-[#DDEEF0] bg-[#F0F8F9] p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#556C7A]">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E1F3F4] text-[10px]">📍</span>
                Map Searches
              </div>
              <div className="mt-2 text-xl font-extrabold text-[#00AFA5]">
                +37% &nearr;
              </div>
              <div className="mt-0.5 text-[10px] text-[#788F9D]">vs. last 3 months</div>
            </div>

            <div className="rounded-xl border border-[#DDEEF0] bg-[#F0F8F9] p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#556C7A]">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E1F3F4] text-[10px]">📅</span>
                Booking Intent
              </div>
              <div className="mt-2">
                <span className="inline-block rounded-full bg-[#E2F7EB] px-2.5 py-0.5 text-xs font-extrabold text-[#00A86B]">
                  High
                </span>
              </div>
              <div className="mt-1 text-[10px] text-[#788F9D]">Implants · Invisalign · Emergency</div>
            </div>
          </div>

          {/* 4. Key Opportunities Component */}
          <div className="mb-7">
            <h2 className="text-base font-extrabold text-[#142C49] mb-3">
              Your Key Opportunities
            </h2>
            <div className={`grid ${viewMode === 'desktop' ? 'grid-cols-3' : 'grid-cols-1'} gap-2.5`}>
              <div className="rounded-xl border border-[#E6EFF0] bg-white p-3.5 shadow-sm">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EBF9F8] text-[#00AFA5] font-extrabold text-xs mb-2">
                  G
                </div>
                <div className="text-xs font-bold text-[#142C49]">Stronger Local Visibility</div>
                <p className="mt-1 text-[11px] text-[#607784] leading-relaxed">
                  Improve your Maps presence and &quot;near me&quot; rankings.
                </p>
              </div>

              <div className="rounded-xl border border-[#E6EFF0] bg-white p-3.5 shadow-sm">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EFF4FE] text-[#3B82F6] font-extrabold text-xs mb-2">
                  ✦
                </div>
                <div className="text-xs font-bold text-[#142C49]">More High-Value Patients</div>
                <p className="mt-1 text-[11px] text-[#607784] leading-relaxed">
                  Capture demand for implants, Invisalign, and cosmetic care.
                </p>
              </div>

              <div className="rounded-xl border border-[#E6EFF0] bg-white p-3.5 shadow-sm">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F5EEFD] text-[#8B5CF6] font-extrabold text-xs mb-2">
                  📊
                </div>
                <div className="text-xs font-bold text-[#142C49]">Turn Interest into Bookings</div>
                <p className="mt-1 text-[11px] text-[#607784] leading-relaxed">
                  A faster, smoother digital patient journey.
                </p>
              </div>
            </div>
          </div>

          {/* 5. Demand & Opportunity Two-Column Row */}
          <div className={`grid ${viewMode === 'desktop' ? 'grid-cols-2' : 'grid-cols-1'} gap-3 mb-7`}>
            {/* Canadian Dental Search Demand */}
            <div className="rounded-xl border border-[#E6EFF0] bg-white p-4 shadow-sm">
              <div className="text-xs font-extrabold text-[#142C49] mb-3">Canadian Dental Search Demand</div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-[#2D4352] mb-1">
                    <span>General dentistry</span>
                    <span className="text-[#00AFA5] font-bold">100K – 1M <span className="text-[9px] text-[#788F9D] font-normal">/mo</span></span>
                  </div>
                  <div className="h-1.5 w-full bg-[#EDF5F5] rounded-full overflow-hidden">
                    <div className="h-full bg-[#00AFA5] rounded-full w-[94%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-[#2D4352] mb-1">
                    <span>Emergency care</span>
                    <span className="text-[#173A55] font-bold">10K – 100K <span className="text-[9px] text-[#788F9D] font-normal">/mo</span></span>
                  </div>
                  <div className="h-1.5 w-full bg-[#EDF5F5] rounded-full overflow-hidden">
                    <div className="h-full bg-[#173A55] rounded-full w-[52%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-[#2D4352] mb-1">
                    <span>Cosmetic &amp; implants</span>
                    <span className="text-[#3BA59F] font-bold">10K – 100K <span className="text-[9px] text-[#788F9D] font-normal">/mo</span></span>
                  </div>
                  <div className="h-1.5 w-full bg-[#EDF5F5] rounded-full overflow-hidden">
                    <div className="h-full bg-[#7EDAD4] rounded-full w-[41%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-semibold text-[#2D4352] mb-1">
                    <span>CDCP inquiries</span>
                    <span className="text-[#00AFA5] font-bold">10K – 100K <span className="text-[9px] text-[#788F9D] font-normal">/mo</span></span>
                  </div>
                  <div className="h-1.5 w-full bg-[#EDF5F5] rounded-full overflow-hidden">
                    <div className="h-full bg-[#00AFA5] rounded-full w-[38%]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Dark Opportunity Card */}
            <div className="rounded-xl bg-[#0F2438] p-4 text-white flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#00F0DB] mb-2">
                  <span>🎯</span> The Opportunity
                </div>
                <p className="text-xs text-[#E1E9EE] leading-relaxed">
                  Patients are already looking. The next step is making <b className="text-white">{activeClinic}</b> the easiest choice to book.
                </p>
              </div>
              <div className="pt-3">
                <svg width="100%" height="40" viewBox="0 0 240 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 34C40 34 60 24 90 24C120 24 140 14 170 14C200 14 215 6 236 3" stroke="#00F0DB" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="90" cy="24" r="3" fill="#00F0DB"/>
                  <circle cx="170" cy="14" r="3" fill="#00F0DB"/>
                  <circle cx="236" cy="3" r="4" fill="#FFFFFF" stroke="#00F0DB" strokeWidth="2"/>
                </svg>
              </div>
            </div>
          </div>

          {/* 6. The VALIOZ Difference Bar Component */}
          <div className="rounded-xl border border-[#E6EFF0] bg-[#F7FAFB] p-3 mb-6">
            <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#788F9D] gap-2">
              <span className="font-extrabold text-[#142C49]">The VALIOZ Difference</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <span>👥 Dedicated team</span>
                <span className="text-[#00AFA5] font-bold">+</span>
                <span>🤖 AI Growth Agent</span>
                <span className="text-[#00AFA5] font-bold">+</span>
                <span>📈 Clear results</span>
              </div>
            </div>
          </div>

          {/* 7. Primary CTA Component */}
          <div className="text-center py-2 mb-4">
            <a
              href="https://health.valioz.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full bg-[#00AFA5] px-7 py-3 text-sm font-extrabold text-white shadow-lg hover:bg-[#009b93] transition tracking-wide"
            >
              📅 Book Your Free Growth Audit &rarr;
            </a>
          </div>

          {/* 8. Reply Prompt & Footer Component */}
          <div className="text-center text-xs text-[#556C7A] mb-5">
            Or simply reply <strong className="text-[#142C49]">&ldquo;YES&rdquo;</strong> to this email, and we&apos;ll send you the full diagnostic video.
          </div>

          <div className="border-t border-b border-[#EAEFEF] py-3 mb-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#556C7A] gap-2">
            <div>
              <strong className="text-[#00AFA5]">VALIOZ Health</strong> | Healthcare Digital Growth
            </div>
            <div className="flex items-center gap-3">
              <a href="https://health.valioz.com/" target="_blank" rel="noopener noreferrer" className="hover:text-[#142C49]">
                health.valioz.com
              </a>
              <span>·</span>
              <a href="mailto:sales@health.valioz.com" className="hover:text-[#142C49]">
                sales@health.valioz.com
              </a>
            </div>
          </div>

          <div className="text-center text-[10px] text-[#8B9FA8] leading-relaxed">
            This brief is prepared exclusively for {activeClinic}. Data reflects Canada-wide ranges from Google Ads Keyword Planner (2026-11-09) and is for planning purposes only. · <a href={`https://health.valioz.com/unsubscribe/?clinic=${encodeURIComponent(activeClinic)}`} className="underline hover:text-[#556C7A]">Unsubscribe</a>
          </div>
        </div>
      </div>
    </div>
  );
}
