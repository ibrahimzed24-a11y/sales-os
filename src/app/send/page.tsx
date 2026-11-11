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
  Check,
  Compass,
  Zap,
  Globe2,
  Calendar,
  Shuffle
} from 'lucide-react';
import { PrototypeEmail } from '@/components/email/PrototypeEmail';

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
    description: 'Generates dual-brand (48px logos) emails & proposals with pure white (#FFFFFF) background and multi-vector angle rotation.',
    schedule: 'On-demand per lead',
    status: 'active',
  },
  {
    name: '4_browser_outreach',
    role: 'Strategic Scheduler & Webmail Runner',
    skill: '/browser-outreach',
    description: 'Executes sunrise cadence across Canada, sets recipient chip with 3s resolution, injects pure-white HTML, auto-labels inbox.',
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

interface ScheduledItem {
  queue_index: number;
  clinic_name: string;
  city: string;
  province: string;
  timezone: string;
  target_local_time: string;
  angle: string;
  subject: string;
  status: string;
  contact_person?: string;
  recipient_email?: string;
}

export default function AgentsOutreachPage() {
  const [activeTab, setActiveTab] = useState<'scheduler' | 'preview' | 'fleet' | 'queue' | 'briefs'>('scheduler');
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [testRecipient, setTestRecipient] = useState('ibrahim.zed24@gmail.com');
  const [briefs, setBriefs] = useState<any[]>([]);

  const fetchSchedule = async () => {
    setLoadingSchedule(true);
    try {
      const res = await fetch('/api/scheduler');
      const data = await res.json();
      if (data?.manifest) {
        setScheduleData(data.manifest);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSchedule(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
    fetch('/api/agents/briefs')
      .then((r) => r.json())
      .then((d) => setBriefs(d.briefs || []))
      .catch(() => {});
  }, []);

  const triggerAgentAction = async (action: string, extra: Record<string, any> = {}) => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: '4_browser_outreach',
          action,
          ...extra,
        }),
      });
      const data = await res.json();
      setRunResult(data.output || data.message || JSON.stringify(data));
      if (action === 'generate') {
        fetchSchedule();
      }
    } catch (err: any) {
      setRunResult(`Error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      {/* Top Banner: Autonomous Status */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-2xl border border-line bg-panel p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl font-bold tracking-tight text-fg">VALIOZ Health — Autonomous Outreach OS</h1>
          </div>
          <p className="text-xs text-muted">
            5-Agent autonomous pipeline acquiring independent Canadian dental clinics ($1.2M–$3.5M, 3–7 chairs).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => triggerAgentAction('test-send', { recipient: testRecipient })}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 transition"
          >
            <Send className="h-3.5 w-3.5" />
            {running ? 'Sending...' : 'Test Send Dual-Brand'}
          </button>

          <button
            onClick={() => triggerAgentAction('check')}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-background px-3.5 py-2 text-xs font-semibold text-fg hover:bg-muted/10 disabled:opacity-50 transition"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
            Check Hostinger Session
          </button>
        </div>
      </div>

      {/* Execution Feedback Banner */}
      {runResult && (
        <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4 text-xs font-mono text-fg overflow-x-auto">
          <div className="flex items-center justify-between pb-1 border-b border-teal-500/20 mb-2 font-bold text-teal-600">
            <span>Agent Execution Log</span>
            <button onClick={() => setRunResult(null)} className="text-muted hover:text-fg">Close</button>
          </div>
          <pre className="whitespace-pre-wrap">{runResult}</pre>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-2">
        <button
          onClick={() => setActiveTab('scheduler')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'scheduler'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-muted hover:text-fg hover:bg-muted/10'
          }`}
        >
          <Compass className="h-4 w-4" />
          Strategic Rotating Scheduler
        </button>

        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'preview'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-muted hover:text-fg hover:bg-muted/10'
          }`}
        >
          <Eye className="h-4 w-4" />
          Live Pure-White Prototype
        </button>

        <button
          onClick={() => setActiveTab('fleet')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'fleet'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-muted hover:text-fg hover:bg-muted/10'
          }`}
        >
          <Layers className="h-4 w-4" />
          Fleet Overview
        </button>

        <button
          onClick={() => setActiveTab('briefs')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'briefs'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-muted hover:text-fg hover:bg-muted/10'
          }`}
        >
          <FileText className="h-4 w-4" />
          Growth Briefs ({briefs.length})
        </button>
      </div>

      {/* TAB 1: STRATEGIC ROTATING SCHEDULER */}
      {activeTab === 'scheduler' && (
        <div className="space-y-6">
          {/* Cadence Matrix Banner */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-line bg-panel p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-teal-600">Active Outreach Days</div>
              <div className="mt-1 text-lg font-bold text-fg">Tue, Wed, Thu</div>
              <div className="mt-0.5 text-xs text-muted">Strict CASL & College Compliance</div>
            </div>

            <div className="rounded-xl border border-line bg-panel p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-teal-600">Local Send Target</div>
              <div className="mt-1 text-lg font-bold text-fg">08:00 AM Local</div>
              <div className="mt-0.5 text-xs text-muted">Atlantic to Pacific Sunrise Progression</div>
            </div>

            <div className="rounded-xl border border-line bg-panel p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-teal-600">Micro-Jitter Spacing</div>
              <div className="mt-1 text-lg font-bold text-fg">6 – 14 Minutes</div>
              <div className="mt-0.5 text-xs text-muted">Humanized anti-spam dispatch intervals</div>
            </div>

            <div className="rounded-xl border border-line bg-panel p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-teal-600">Quality Daily Cap</div>
              <div className="mt-1 text-lg font-bold text-fg">10 Clinics Max</div>
              <div className="mt-0.5 text-xs text-muted">Max 3 per province (ON, BC, AB, QC)</div>
            </div>
          </div>

          {/* Sunrise Cadence Progression Bar */}
          <div className="rounded-2xl border border-line bg-panel p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-teal-600" />
                <h3 className="text-sm font-bold text-fg">Canadian Sunrise Time-Zone Progression</h3>
              </div>
              <span className="text-xs text-muted">Follows the working day sunrise East &rarr; West</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
              <div className="rounded-xl bg-teal-500/10 border border-teal-500/30 p-2.5">
                <div className="font-bold text-teal-700 dark:text-teal-400">1. Atlantic (AT)</div>
                <div className="text-[11px] text-muted">08:00 AM AT (12:00 UTC)</div>
                <div className="mt-1 text-[10px] text-teal-600 font-semibold">NS, NB, PE</div>
              </div>
              <div className="rounded-xl bg-teal-500/10 border border-teal-500/30 p-2.5">
                <div className="font-bold text-teal-700 dark:text-teal-400">2. Eastern (ET)</div>
                <div className="text-[11px] text-muted">08:00 AM ET (13:00 UTC)</div>
                <div className="mt-1 text-[10px] text-teal-600 font-semibold">ON, QC</div>
              </div>
              <div className="rounded-xl bg-teal-500/10 border border-teal-500/30 p-2.5">
                <div className="font-bold text-teal-700 dark:text-teal-400">3. Central (CT)</div>
                <div className="text-[11px] text-muted">08:00 AM CT (14:00 UTC)</div>
                <div className="mt-1 text-[10px] text-teal-600 font-semibold">MB, SK</div>
              </div>
              <div className="rounded-xl bg-teal-500/10 border border-teal-500/30 p-2.5">
                <div className="font-bold text-teal-700 dark:text-teal-400">4. Mountain (MT)</div>
                <div className="text-[11px] text-muted">08:00 AM MT (15:00 UTC)</div>
                <div className="mt-1 text-[10px] text-teal-600 font-semibold">AB</div>
              </div>
              <div className="rounded-xl bg-teal-500/10 border border-teal-500/30 p-2.5">
                <div className="font-bold text-teal-700 dark:text-teal-400">5. Pacific (PT)</div>
                <div className="text-[11px] text-muted">08:00 AM PT (16:00 UTC)</div>
                <div className="mt-1 text-[10px] text-teal-600 font-semibold">BC</div>
              </div>
            </div>
          </div>

          {/* Today's Rotated Cadence Table */}
          <div className="rounded-2xl border border-line bg-panel p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-fg">Today&apos;s Strategically Rotated Queue</h3>
                <p className="text-xs text-muted">
                  Multi-vector twisting: Subject lines &amp; pitch angles rotate across every recipient to eliminate spam footprint.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchSchedule}
                  disabled={loadingSchedule}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-background px-3 py-1.5 text-xs font-semibold text-fg hover:bg-muted/10 transition"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingSchedule ? 'animate-spin' : ''}`} />
                  Refresh Plan
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-muted/20 text-muted uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-3">Slot</th>
                    <th className="px-4 py-3">Clinic &amp; Location</th>
                    <th className="px-4 py-3">Local Time &amp; TZ</th>
                    <th className="px-4 py-3">Rotated Angle</th>
                    <th className="px-4 py-3">Twisted Subject Line</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {scheduleData?.schedule?.map((item: ScheduledItem) => (
                    <tr key={item.queue_index} className="hover:bg-muted/10 transition">
                      <td className="px-4 py-3 font-mono font-bold text-teal-600">
                        #{String(item.queue_index).padStart(2, '0')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-fg">{item.clinic_name}</div>
                        <div className="text-[11px] text-muted">{item.city}, {item.province}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-fg">{item.target_local_time}</span>
                        <div className="text-[10px] text-muted font-mono">{item.timezone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-teal-500/10 px-2.5 py-0.5 text-[11px] font-bold text-teal-600">
                          {item.angle}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-fg font-medium max-w-xs truncate" title={item.subject}>
                        {item.subject}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE PROTOTYPE PREVIEW */}
      {activeTab === 'preview' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold">Live Pure-White HTML Component Prototype</h3>
              <p className="text-xs text-muted">
                100% native HTML components: responsive cards, metrics, live typography, and SVG trend curve.
              </p>
            </div>
          </div>

          <PrototypeEmail />
        </div>
      )}

      {/* TAB 3: FLEET OVERVIEW */}
      {activeTab === 'fleet' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENTS.map((agent) => (
            <div key={agent.name} className="rounded-2xl border border-line bg-panel p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-teal-600" />
                  <span className="font-bold text-sm text-fg">{agent.name}</span>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                  {agent.status}
                </span>
              </div>
              <div className="text-xs font-semibold text-teal-600">{agent.role}</div>
              <p className="text-xs text-muted leading-relaxed">{agent.description}</p>
              <div className="border-t border-line pt-2 text-[11px] text-muted flex items-center justify-between">
                <span>Cadence:</span>
                <span className="font-medium text-fg">{agent.schedule}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: GROWTH BRIEFS */}
      {activeTab === 'briefs' && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold">Daily Growth Briefs &amp; Handover Logs</h3>
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
