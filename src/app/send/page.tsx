'use client';

import { useState, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  FileText, 
  RefreshCw, 
  ExternalLink, 
  AlertTriangle,
  Play,
  Layers,
  Sparkles,
  Users,
  ChevronRight,
  Eye,
  Check
} from 'lucide-react';

interface AgentInfo {
  name: string;
  role: string;
  skill: string;
  description: string;
  schedule: string;
  status: 'active' | 'standby' | 'scheduled';
}

const AGENTS: AgentInfo[] = [
  {
    name: '1_orchestrator',
    role: 'Conductor & Handover',
    skill: '/orchestrator',
    description: 'Autonomous cycle runner, daily 10-clinic quota, clinic time-zone dispatch coordinator, and Daily Growth Brief author.',
    schedule: 'Tue, Wed, Thu @ 08:00 AM Local',
    status: 'active',
  },
  {
    name: '2_lead_intel',
    role: 'Lead Intel & Segregation',
    skill: '/lead-intel',
    description: 'Filters 93 corporate DSOs (dentalcorp, 123Dentist), segregates 45 clinics into Cohort A vs B, maps Canadian time zones.',
    schedule: 'Pre-flight cycle',
    status: 'active',
  },
  {
    name: '3_copywriter',
    role: 'DSPy & Terse Copywriter',
    skill: '/copywriter',
    description: 'Generates dual-brand (48px logos) emails & proposals with pure white (#FFFFFF) background and cohort-tailored patient journey.',
    schedule: 'On-demand per lead',
    status: 'active',
  },
  {
    name: '4_browser_outreach',
    role: 'Hostinger Webmail Runner',
    skill: '/browser-outreach',
    description: 'Headless browser automation via CDP, sets recipient chip with 3s resolution, injects pure-white HTML, auto-labels inbox.',
    schedule: 'Tue, Wed, Thu @ 08:00 AM Local',
    status: 'active',
  },
  {
    name: '5_pipeline_crm',
    role: 'Pipeline CRM & Tracker',
    skill: '/pipeline-crm',
    description: 'In-place tracker updater, deal stage progression, $499 CAD Stripe proposal generator, CASL suppression enforcement.',
    schedule: 'Post-flight cycle',
    status: 'active',
  },
];

interface QueueItem {
  clinic_name: string;
  city: string;
  province: string;
  time_zone: string;
  local_send_time: string;
  decision_maker: string;
  cohort: 'A' | 'B';
  website_status: string;
  status: string;
}

const DEMO_QUEUE: QueueItem[] = [
  { clinic_name: 'Brampton Dental Arts', city: 'Brampton', province: 'ON', time_zone: 'ET (UTC-5)', local_send_time: '08:00 AM ET', decision_maker: 'Dr. Sheikh', cohort: 'A', website_status: 'Live Website', status: 'Queued' },
  { clinic_name: 'Donway Dental Centre', city: 'North York', province: 'ON', time_zone: 'ET (UTC-5)', local_send_time: '08:00 AM ET', decision_maker: 'Practice Manager', cohort: 'A', website_status: 'Live Website', status: 'Queued' },
  { clinic_name: 'Boutique Dental Care', city: 'Toronto', province: 'ON', time_zone: 'ET (UTC-5)', local_send_time: '08:00 AM ET', decision_maker: 'Practice Manager', cohort: 'A', website_status: 'Live Website', status: 'Queued' },
  { clinic_name: 'Smiles on Bay', city: 'Toronto', province: 'ON', time_zone: 'ET (UTC-5)', local_send_time: '08:00 AM ET', decision_maker: 'Practice Manager', cohort: 'B', website_status: 'No Website / Broken', status: 'Queued' },
  { clinic_name: 'West Edmonton Mall Dental Centre', city: 'Edmonton', province: 'AB', time_zone: 'MT (UTC-7)', local_send_time: '08:00 AM MT', decision_maker: 'Dr. Karukappadath', cohort: 'A', website_status: 'Live Website', status: 'Queued' },
  { clinic_name: 'Strathcona Dental Clinic', city: 'Edmonton', province: 'AB', time_zone: 'MT (UTC-7)', local_send_time: '08:00 AM MT', decision_maker: 'Practice Manager', cohort: 'A', website_status: 'Live Website', status: 'Queued' },
  { clinic_name: 'Urban Dental Clinic', city: 'Vancouver', province: 'BC', time_zone: 'PT (UTC-8)', local_send_time: '08:00 AM PT', decision_maker: 'Practice Manager', cohort: 'A', website_status: 'Live Website', status: 'Queued' },
  { clinic_name: 'Arbutus North Dental Centre', city: 'Vancouver', province: 'BC', time_zone: 'PT (UTC-8)', local_send_time: '08:00 AM PT', decision_maker: 'Practice Manager', cohort: 'A', website_status: 'Live Website', status: 'Queued' },
  { clinic_name: 'Kitsilano Dental Group', city: 'Vancouver', province: 'BC', time_zone: 'PT (UTC-8)', local_send_time: '08:00 AM PT', decision_maker: 'Practice Manager', cohort: 'A', website_status: 'Live Website', status: 'Queued' },
  { clinic_name: 'Sherwood Dental Care', city: 'Halifax', province: 'NS', time_zone: 'AT (UTC-4)', local_send_time: '08:00 AM AT', decision_maker: 'Practice Manager', cohort: 'A', website_status: 'Live Website', status: 'Queued' },
];

export default function AgentsOutreachPage() {
  const [activeTab, setActiveTab] = useState<'fleet' | 'queue' | 'preview' | 'briefs'>('fleet');
  const [previewCohort, setPreviewCohort] = useState<'A' | 'B'>('A');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [briefs, setBriefs] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/agents/briefs')
      .then((r) => r.json())
      .then((d) => setBriefs(d.briefs || []))
      .catch(() => {});
  }, []);

  const triggerAgentCycle = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'dry_run' }),
      });
      const data = await res.json();
      setRunResult(data.message || 'Autonomous cycle completed successfully');
    } catch (err: any) {
      setRunResult(`Execution error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Mission Statement */}
      <div className="rounded-xl border border-line bg-panel p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <Bot className="h-5 w-5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight">Autonomous 5-Agent Mission Control</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                Continuous Engine Active
              </span>
            </div>
            <p className="mt-1.5 text-sm text-muted">
              Fully automated sales outreach specialist for Valioz Health targeting independent Canadian dental practices (3–7 operatories, non-DSO).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={triggerAgentCycle}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-50"
            >
              {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? 'Running Handover Cycle...' : 'Run Autonomous Handover'}
            </button>
          </div>
        </div>

        {runResult && (
          <div className="mt-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            {runResult}
          </div>
        )}

        {/* Operational Constraints Bar */}
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <div className="rounded-lg bg-bg p-3">
            <p className="text-xs font-medium text-muted">Schedule</p>
            <p className="mt-1 text-sm font-semibold">Tue, Wed, Thu</p>
            <p className="text-[11px] text-muted">Excludes Mon & Fri</p>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <p className="text-xs font-medium text-muted">Local Sending Time</p>
            <p className="mt-1 text-sm font-semibold">08:00 AM Clinic Time</p>
            <p className="text-[11px] text-muted">ET, CT, MT, PT, AT matched</p>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <p className="text-xs font-medium text-muted">Daily Volume</p>
            <p className="mt-1 text-sm font-semibold">10 Verified Clinics</p>
            <p className="text-[11px] text-muted">Max 3 clinics per province</p>
          </div>
          <div className="rounded-lg bg-bg p-3">
            <p className="text-xs font-medium text-muted">DSO Suppression</p>
            <p className="mt-1 text-sm font-semibold">93 Excluded</p>
            <p className="text-[11px] text-muted">dentalcorp & 123Dentist blocked</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line gap-2">
        <button
          onClick={() => setActiveTab('fleet')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'fleet' ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-fg'
          }`}
        >
          <Bot className="h-4 w-4" />
          5-Agent Fleet
        </button>
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'queue' ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-fg'
          }`}
        >
          <Clock className="h-4 w-4" />
          Outreach Queue (10/day)
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'preview' ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-fg'
          }`}
        >
          <Eye className="h-4 w-4" />
          Dual-Brand Email Preview
        </button>
        <button
          onClick={() => setActiveTab('briefs')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'briefs' ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-fg'
          }`}
        >
          <FileText className="h-4 w-4" />
          Daily Growth Briefs
        </button>
      </div>

      {/* TAB 1: 5-AGENT FLEET */}
      {activeTab === 'fleet' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {AGENTS.map((agent) => (
              <div key={agent.name} className="flex flex-col justify-between rounded-xl border border-line bg-panel p-5 shadow-sm">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-teal-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-teal-600 dark:text-teal-400">
                      {agent.skill}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      Ready
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-semibold">{agent.role}</h3>
                  <p className="mt-1 text-xs text-muted leading-relaxed">{agent.description}</p>
                </div>

                <div className="mt-4 border-t border-line pt-3">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>Cadence:</span>
                    <span className="font-medium text-fg">{agent.schedule}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Handover Architecture Pipeline */}
          <div className="rounded-xl border border-line bg-panel p-6">
            <h3 className="text-base font-semibold">Autonomous Handover Flow</h3>
            <p className="mt-1 text-xs text-muted">
              Every active outreach day, the 5 agents execute in strict linear succession without manual intervention:
            </p>

            <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex-1 rounded-lg border border-line bg-bg p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-600 dark:text-teal-400">
                  <Bot className="h-3.5 w-3.5" /> 1. Orchestrator
                </div>
                <p className="mt-1 text-xs text-muted">Determines 10 clinics, matches local time zones, launches cycle.</p>
              </div>
              <ChevronRight className="hidden lg:block h-5 w-5 text-muted shrink-0" />

              <div className="flex-1 rounded-lg border border-line bg-bg p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-600 dark:text-teal-400">
                  <Layers className="h-3.5 w-3.5" /> 2. Lead Intel
                </div>
                <p className="mt-1 text-xs text-muted">Suppresses DSOs, segregates into Cohort A vs B, checks CASL opt-outs.</p>
              </div>
              <ChevronRight className="hidden lg:block h-5 w-5 text-muted shrink-0" />

              <div className="flex-1 rounded-lg border border-line bg-bg p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-600 dark:text-teal-400">
                  <Sparkles className="h-3.5 w-3.5" /> 3. Copywriter
                </div>
                <p className="mt-1 text-xs text-muted">DSPy + Terse builds 48px dual-brand pure white (#FFFFFF) emails.</p>
              </div>
              <ChevronRight className="hidden lg:block h-5 w-5 text-muted shrink-0" />

              <div className="flex-1 rounded-lg border border-line bg-bg p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-600 dark:text-teal-400">
                  <Send className="h-3.5 w-3.5" /> 4. Browser Outreach
                </div>
                <p className="mt-1 text-xs text-muted">Executes in Hostinger webmail, commits chips, delivers at 08:00 AM local.</p>
              </div>
              <ChevronRight className="hidden lg:block h-5 w-5 text-muted shrink-0" />

              <div className="flex-1 rounded-lg border border-line bg-bg p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-600 dark:text-teal-400">
                  <ShieldCheck className="h-3.5 w-3.5" /> 5. Pipeline CRM
                </div>
                <p className="mt-1 text-xs text-muted">Updates tracker CSV in-place, logs deals, creates $499 Stripe proposals.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OUTREACH QUEUE */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Active Daily Dispatch Queue</h3>
              <p className="text-xs text-muted">
                Exactly 10 verified independent Canadian clinics per active outreach day (Tue/Wed/Thu), scheduled for 08:00 AM in each clinic&apos;s local time zone.
              </p>
            </div>
            <div className="text-xs text-muted">
              Showing <span className="font-semibold text-fg">10 of 45</span> verified independent clinics
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line bg-panel shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-raised/50 text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Clinic & City</th>
                  <th className="px-4 py-3 font-medium">Province / Zone</th>
                  <th className="px-4 py-3 font-medium">Local Dispatch</th>
                  <th className="px-4 py-3 font-medium">Recipient</th>
                  <th className="px-4 py-3 font-medium">Cohort & Offer</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y border-line">
                {DEMO_QUEUE.map((item, idx) => (
                  <tr key={idx} className="hover:bg-raised/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-fg">
                      <div>{item.clinic_name}</div>
                      <div className="text-[11px] text-muted">{item.city}, {item.province}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs">{item.province}</span>
                      <div className="text-[11px] text-muted">{item.time_zone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded bg-bg px-2 py-0.5 font-medium text-fg">
                        <Clock className="h-3 w-3 text-brand" />
                        {item.local_send_time}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{item.decision_maker}</td>
                    <td className="px-4 py-3">
                      {item.cohort === 'A' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                          Cohort A (Live Site &bull; SEO/GEO)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-600 dark:text-purple-400">
                          Cohort B ($499 Web Build)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DUAL-BRAND EMAIL PREVIEW */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold">Core Sliced Visual Template Engine (Pure-White #FFFFFF)</h3>
              <p className="text-xs text-muted">
                Pixel-level responsive 600px email layout with high-converting visual demand intelligence slices.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-teal-500/10 px-2.5 py-0.5 text-xs font-semibold text-teal-600">
                Active Core Design
              </span>
            </div>
          </div>

          {/* Email Preview Card */}
          <div className="mx-auto max-w-[620px] rounded-xl border border-line bg-white p-2 sm:p-4 text-slate-800 shadow-md">
            <div className="overflow-hidden rounded-lg border border-slate-100 bg-white">
              {/* Slice 1: Top Visual with Dual-Brand Header, Insights & Demand */}
              <img
                src="https://raw.githubusercontent.com/ibrahimzed24-a11y/sales-os/main/assets/email_top.jpg"
                alt="VALIOZ Health Growth Audit - Brampton Dental Arts"
                className="w-full h-auto block"
              />

              {/* Slice 2: Interactive CTA Button */}
              <a
                href="https://health.valioz.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:opacity-95 transition-opacity"
              >
                <img
                  src="https://raw.githubusercontent.com/ibrahimzed24-a11y/sales-os/main/assets/email_cta.jpg"
                  alt="Book Your Free Growth Audit"
                  className="w-full h-auto block"
                />
              </a>

              {/* Slice 3: Footer with Fast Reply & Contact */}
              <img
                src="https://raw.githubusercontent.com/ibrahimzed24-a11y/sales-os/main/assets/email_footer.jpg"
                alt="VALIOZ Health & Brampton Dental Arts Information"
                className="w-full h-auto block"
              />

              {/* Legal Unsubscribe & Brand Links */}
              <div className="bg-white py-3 px-4 text-center text-xs text-slate-500 border-t border-slate-100">
                <a
                  href="https://health.valioz.com/unsubscribe/?clinic=Brampton%20Dental%20Arts"
                  className="text-slate-500 underline hover:text-slate-700"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Unsubscribe
                </a>
                {' '}·{' '}
                <a
                  href="https://health.valioz.com/"
                  className="text-teal-600 underline hover:text-teal-700 font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  VALIOZ Health
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DAILY GROWTH BRIEFS */}
      {activeTab === 'briefs' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold">Daily Growth Briefs & Handover Logs</h3>
            <p className="text-xs text-muted">
              Autonomous summaries generated after each day&apos;s 10-clinic dispatch cycle.
            </p>
          </div>

          <div className="space-y-3">
            {briefs.length > 0 ? (
              briefs.map((brief, idx) => (
                <div key={idx} className="rounded-xl border border-line bg-panel p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-fg">{brief.date}</span>
                    <span className="rounded bg-teal-500/10 px-2 py-0.5 text-xs font-medium text-teal-600">
                      {brief.clinicsSent} Dispatched
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted leading-relaxed">{brief.summary}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-line bg-panel p-6 text-center text-xs text-muted">
                No archived briefs found. Click &quot;Run Autonomous Handover&quot; to generate today&apos;s cycle brief.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
