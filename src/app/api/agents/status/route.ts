import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rootDir = process.cwd();
    
    // Load segregation summary
    const summaryPath = path.join(rootDir, 'data/segregated/segregation_summary.json');
    let segregationSummary = {
      total_leads_processed: 138,
      excluded_dso_count: 93,
      eligible_independent_total: 45,
      cohort_a_live_website_count: 34,
      cohort_b_no_website_count: 11,
    };
    if (fs.existsSync(summaryPath)) {
      segregationSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    }

    // Load latest manifest
    const today = new Date().toISOString().slice(0, 10);
    let queueManifest = null;
    const manifestPath = path.join(rootDir, `dist/outreach-queue/${today}/manifest.json`);
    if (fs.existsSync(manifestPath)) {
      queueManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } else {
      // Find latest manifest
      const queueDir = path.join(rootDir, 'dist/outreach-queue');
      if (fs.existsSync(queueDir)) {
        const dates = fs.readdirSync(queueDir).filter((d) => !d.startsWith('.')).sort().reverse();
        if (dates.length > 0) {
          const latestPath = path.join(queueDir, dates[0], 'manifest.json');
          if (fs.existsSync(latestPath)) {
            queueManifest = JSON.parse(fs.readFileSync(latestPath, 'utf-8'));
          }
        }
      }
    }

    // Load tracker rows count
    const trackerPath = path.join(rootDir, 'canadian_clinics_outreach_tracker.csv');
    let trackerCount = 0;
    if (fs.existsSync(trackerPath)) {
      const lines = fs.readFileSync(trackerPath, 'utf-8').trim().split('\n');
      trackerCount = Math.max(0, lines.length - 1);
    }

    return NextResponse.json({
      status: 'OPERATIONAL',
      timestamp: new Date().toISOString(),
      agents: [
        {
          name: 'Master Orchestrator Agent',
          skill: '/orchestrator',
          role: 'System Conductor & Executive Reporting',
          state: 'ACTIVE',
          cadence: 'Tuesday, Wednesday, Thursday @ 08:00 AM local clinic time',
          dailyCap: 10,
        },
        {
          name: 'Lead Intelligence & Data Segmentation Agent',
          skill: '/lead-intel',
          role: 'DSO Exclusion & Cohort Segregation',
          state: 'ACTIVE',
          cohortA: segregationSummary.cohort_a_live_website_count,
          cohortB: segregationSummary.cohort_b_no_website_count,
          excludedDSO: segregationSummary.excluded_dso_count,
        },
        {
          name: 'Dual-Brand Copywriting Agent',
          skill: '/copywriter',
          role: 'DSPy & Terse Dual-Brand Assembly',
          state: 'ACTIVE',
          specs: 'VALIOZ + Clinic logo 48px, pure white background (#FFFFFF), 660px table HTML',
        },
        {
          name: 'Browser Outreach & Reach Webmail Agent',
          skill: '/browser-outreach',
          role: 'Hostinger Reach Webmail Browser Runner',
          state: 'CONNECTED',
          account: 'sales@health.valioz.com',
          driver: 'browser-harness (CDP)',
        },
        {
          name: 'Sales CRM & Pipeline Documentation Agent',
          skill: '/pipeline-crm',
          role: 'Deal Progression & $499 Stripe Proposals',
          state: 'ACTIVE',
          trackedCount: trackerCount,
          offer: '$499 CAD one-time launch + $299/mo optional',
        },
      ],
      segregation: segregationSummary,
      currentQueue: queueManifest,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
