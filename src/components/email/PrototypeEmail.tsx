'use client';

import React, { useState } from 'react';
import { Search, MapPin, Calendar, Check, ExternalLink, RefreshCw } from 'lucide-react';

interface PrototypeEmailProps {
  clinicName?: string;
  city?: string;
  logoUrl?: string;
  websiteUrl?: string;
}

export function PrototypeEmail({
  clinicName = 'Brampton Dental Arts',
  city = 'Brampton',
  logoUrl = 'https://raw.githubusercontent.com/ibrahimzed24-a11y/sales-os/main/assets/clinic-logos/brampton-dental-arts.png',
  websiteUrl = 'https://bramptondentalarts.com/',
}: PrototypeEmailProps) {
  const [activeClinic, setActiveClinic] = useState(clinicName);
  const [activeCity, setActiveCity] = useState(city);

  return (
    <div className="mx-auto max-w-[640px] rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-slate-800 shadow-xl">
      {/* 1. Header Component */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <img
            src="https://raw.githubusercontent.com/ibrahimzed24-a11y/sales-os/main/assets/VALIOZ_Health_Primary.png"
            alt="VALIOZ Health"
            className="h-7 w-auto object-contain"
          />
          <span className="text-slate-300 font-light text-xl">|</span>
          <img
            src={logoUrl}
            alt={activeClinic}
            className="h-8 max-w-[150px] w-auto object-contain"
          />
        </div>
        <div className="self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
            📊 Growth Audit
          </span>
        </div>
      </div>

      {/* 2. Hero Component */}
      <div className="pt-6 pb-6">
        <div className="text-[11px] font-extrabold uppercase tracking-widest text-teal-600 mb-2">
          {activeCity.toUpperCase()} MARKET INSIGHTS
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
          More patients are searching for dental care in <span className="text-teal-600">{activeCity}.</span>
        </h1>
        <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
          Here's a quick growth audit for {activeClinic} and what it means for your next stage of growth.
        </p>
        <div className="mt-4">
          <a
            href="https://health.valioz.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-teal-700 transition"
          >
            View Your Full Growth Audit &rarr;
          </a>
        </div>
      </div>

      {/* 3. Metrics Grid Component */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-6">
        <div className="rounded-xl border border-teal-100 bg-[#F0F8F9] p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-[10px]">🔍</span>
            Local Search Demand
          </div>
          <div className="mt-2 text-xl font-extrabold text-slate-900">
            ~18.4K <span className="text-xs font-medium text-slate-500">/mo</span>
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">Dental services in {activeCity}</div>
        </div>

        <div className="rounded-xl border border-teal-100 bg-[#F0F8F9] p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-[10px]">📍</span>
            Map Searches
          </div>
          <div className="mt-2 text-xl font-extrabold text-teal-600">
            +37% &nearr;
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">vs. last 3 months</div>
        </div>

        <div className="rounded-xl border border-teal-100 bg-[#F0F8F9] p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-[10px]">📅</span>
            Booking Intent
          </div>
          <div className="mt-2">
            <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-700">
              High
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Implants · Invisalign · Emergency</div>
        </div>
      </div>

      {/* 4. Key Opportunities Component */}
      <div className="pb-6">
        <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mb-3">
          Your Key Opportunities
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 font-extrabold text-sm mb-2.5">
              G
            </div>
            <div className="text-sm font-bold text-slate-900">Stronger Local Visibility</div>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Improve your Maps presence and "near me" rankings.
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-extrabold text-sm mb-2.5">
              ✦
            </div>
            <div className="text-sm font-bold text-slate-900">More High-Value Patients</div>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Capture demand for implants, Invisalign, and cosmetic care.
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 font-extrabold text-sm mb-2.5">
              📊
            </div>
            <div className="text-sm font-bold text-slate-900">Turn Interest into Bookings</div>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              A faster, smoother digital patient journey.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Demand & Opportunity Two-Column Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pb-6">
        {/* Canadian Demand Card */}
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="text-xs font-extrabold text-slate-900 mb-3">Canadian Dental Search Demand</div>
          <div className="space-y-2.5">
            <div>
              <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                <span>General dentistry</span>
                <span className="text-teal-600 font-bold">100K – 1M <span className="text-[9px] text-slate-400 font-normal">/mo</span></span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 rounded-full w-[94%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                <span>Emergency care</span>
                <span className="text-slate-800 font-bold">10K – 100K <span className="text-[9px] text-slate-400 font-normal">/mo</span></span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-800 rounded-full w-[52%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                <span>Cosmetic & implants</span>
                <span className="text-teal-500 font-bold">10K – 100K <span className="text-[9px] text-slate-400 font-normal">/mo</span></span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-teal-400 rounded-full w-[41%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                <span>CDCP inquiries</span>
                <span className="text-teal-600 font-bold">10K – 100K <span className="text-[9px] text-slate-400 font-normal">/mo</span></span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-teal-600 rounded-full w-[38%]" />
              </div>
            </div>
          </div>
        </div>

        {/* Opportunity Card */}
        <div className="rounded-xl bg-gradient-to-br from-[#0B253A] to-[#173A55] p-5 text-white flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-teal-300 mb-2">
              <span>🎯</span> The Opportunity
            </div>
            <p className="text-xs sm:text-sm text-slate-100 leading-relaxed">
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

      {/* 6. VALIOZ Difference Bar Component */}
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 gap-2">
          <span className="font-extrabold text-slate-900">The VALIOZ Difference</span>
          <div className="flex items-center gap-2">
            <span>👥 A dedicated healthcare team</span>
            <span className="text-teal-600 font-bold">+</span>
            <span>🤖 AI Growth Agent</span>
            <span className="text-teal-600 font-bold">+</span>
            <span>📈 Clear results</span>
          </div>
        </div>
      </div>

      {/* 7. Primary CTA Component */}
      <div className="text-center py-4">
        <a
          href="https://health.valioz.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-full bg-teal-600 px-8 py-4 text-base font-extrabold text-white shadow-lg hover:bg-teal-700 transition"
        >
          📅 Book Your Free Growth Audit &rarr;
        </a>
      </div>

      {/* 8. Reply Prompt & Footer */}
      <div className="text-center text-xs sm:text-sm text-slate-600 mb-6">
        Or simply reply <strong className="text-slate-900">"YES"</strong> to this email, and we'll send you the full diagnostic video.
      </div>

      <div className="border-t border-b border-slate-100 py-3 mb-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
        <div>
          <strong className="text-teal-600">VALIOZ Health</strong> | Healthcare Digital Growth
        </div>
        <div className="flex items-center gap-3">
          <a href="https://health.valioz.com/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-800">
            health.valioz.com
          </a>
          <span>·</span>
          <a href="mailto:sales@health.valioz.com" className="hover:text-slate-800">
            sales@health.valioz.com
          </a>
        </div>
      </div>

      <div className="text-center text-[10px] text-slate-400 leading-relaxed">
        This brief is prepared exclusively for {activeClinic}. Data reflects Canada-wide ranges from Google Ads Keyword Planner (2026-11-09) and is for planning purposes only. · <a href={`https://health.valioz.com/unsubscribe/?clinic=${encodeURIComponent(activeClinic)}`} className="underline hover:text-slate-600">Unsubscribe</a>
      </div>
    </div>
  );
}
