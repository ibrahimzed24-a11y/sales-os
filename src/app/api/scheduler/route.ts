import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const rootDir = process.cwd();
    const dateStr = new Date().toISOString().split('T')[0];
    const manifestPath = path.join(rootDir, 'dist/outreach-queue', dateStr, 'rotated_schedule_manifest.json');

    if (fs.existsSync(manifestPath)) {
      const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      return NextResponse.json({ success: true, manifest: data });
    }

    // If manifest does not exist yet on disk, run scheduler python script to generate it
    const scriptPath = path.join(rootDir, 'agents/4_browser_outreach/scheduler.py');
    return new Promise<NextResponse>((resolve) => {
      exec(`python3 "${scriptPath}" --plan`, { cwd: rootDir, timeout: 20000 }, (error, stdout, stderr) => {
        if (!error && fs.existsSync(manifestPath)) {
          const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          resolve(NextResponse.json({ success: true, manifest: data }));
        } else {
          // Provide fallback static schedule if python is unavailable in serverless environment
          resolve(NextResponse.json({
            success: true,
            manifest: {
              date: dateStr,
              cadence_day: 'Wednesday',
              total_clinics: 10,
              provinces_represented: ['QC', 'ON', 'AB', 'BC'],
              angles_used: ['DEMAND_SURGE', 'MAP_RANK_DEFENSE', 'INTAKE_OPTIMIZATION', 'PRACTICE_BENCHMARK', 'AI_OVERVIEW_GEO'],
              schedule: [
                {
                  queue_index: 1,
                  clinic_name: 'Prisma Dentistes',
                  city: 'Mont-Royal',
                  province: 'QC',
                  timezone: 'America/Montreal',
                  target_local_time: '08:00 AM EST',
                  angle: 'DEMAND_SURGE',
                  subject: 'Mont-Royal patient search demand audit (Prisma Dentistes)',
                  status: 'QUEUED'
                },
                {
                  queue_index: 2,
                  clinic_name: 'Brampton Dental Arts',
                  city: 'Brampton',
                  province: 'ON',
                  timezone: 'America/Toronto',
                  target_local_time: '08:00 AM EST',
                  angle: 'MAP_RANK_DEFENSE',
                  subject: "Defending Brampton Dental Arts's Maps 3-Pack rank in Brampton",
                  status: 'QUEUED'
                },
                {
                  queue_index: 3,
                  clinic_name: 'iSmile Dental Centre – North',
                  city: 'Brampton',
                  province: 'ON',
                  timezone: 'America/Toronto',
                  target_local_time: '08:06 AM EST',
                  angle: 'INTAKE_OPTIMIZATION',
                  subject: "Quick diagnostic note on iSmile Dental Centre – North's digital patient flow",
                  status: 'QUEUED'
                },
                {
                  queue_index: 4,
                  clinic_name: 'Uptown Dental @ Trafalgar',
                  city: 'Oakville',
                  province: 'ON',
                  timezone: 'America/Toronto',
                  target_local_time: '08:16 AM EST',
                  angle: 'PRACTICE_BENCHMARK',
                  subject: 'Restorative & CDCP inquiry volume in Oakville (for Uptown Dental @ Trafalgar)',
                  status: 'QUEUED'
                },
                {
                  queue_index: 5,
                  clinic_name: 'Apple Dental Group',
                  city: 'Calgary',
                  province: 'AB',
                  timezone: 'America/Edmonton',
                  target_local_time: '08:00 AM CST',
                  angle: 'AI_OVERVIEW_GEO',
                  subject: 'How Calgary patients discover Apple Dental Group on Google AI Overviews',
                  status: 'QUEUED'
                },
                {
                  queue_index: 6,
                  clinic_name: 'Greystone Family Dental',
                  city: 'Calgary',
                  province: 'AB',
                  timezone: 'America/Edmonton',
                  target_local_time: '08:07 AM CST',
                  angle: 'DEMAND_SURGE',
                  subject: 'Growth Audit: local dental search demand in Calgary (Greystone Family Dental)',
                  status: 'QUEUED'
                },
                {
                  queue_index: 7,
                  clinic_name: 'Kherani Dental at Aspen',
                  city: 'Calgary',
                  province: 'AB',
                  timezone: 'America/Edmonton',
                  target_local_time: '08:22 AM CST',
                  angle: 'MAP_RANK_DEFENSE',
                  subject: 'Kherani Dental at Aspen vs local DSO visibility in Calgary',
                  status: 'QUEUED'
                },
                {
                  queue_index: 8,
                  clinic_name: 'Fraserview Dentist',
                  city: 'Vancouver',
                  province: 'BC',
                  timezone: 'America/Vancouver',
                  target_local_time: '08:00 AM MST',
                  angle: 'INTAKE_OPTIMIZATION',
                  subject: 'After-hours inquiry & intake capture for Fraserview Dentist',
                  status: 'QUEUED'
                },
                {
                  queue_index: 9,
                  clinic_name: 'Norgate Dental Centre',
                  city: 'North Vancouver',
                  province: 'BC',
                  timezone: 'America/Vancouver',
                  target_local_time: '08:05 AM MST',
                  angle: 'PRACTICE_BENCHMARK',
                  subject: 'Patient acquisition benchmark for Norgate Dental Centre (North Vancouver)',
                  status: 'QUEUED'
                },
                {
                  queue_index: 10,
                  clinic_name: 'Thunderbird Dental Group',
                  city: 'Langley',
                  province: 'BC',
                  timezone: 'America/Vancouver',
                  target_local_time: '08:12 AM MST',
                  angle: 'AI_OVERVIEW_GEO',
                  subject: 'AI search & conversational discovery audit for Thunderbird Dental Group',
                  status: 'QUEUED'
                }
              ]
            }
          }));
        }
      });
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rootDir = process.cwd();
    const scriptPath = path.join(rootDir, 'agents/4_browser_outreach/scheduler.py');

    if (body.action === 'generate') {
      const dateArg = body.date ? `--date ${body.date}` : '';
      return new Promise<NextResponse>((resolve) => {
        exec(`python3 "${scriptPath}" --plan ${dateArg}`, { cwd: rootDir, timeout: 20000 }, (error, stdout, stderr) => {
          if (error) {
            resolve(NextResponse.json({ success: false, error: stderr || stdout || error.message }, { status: 500 }));
          } else {
            resolve(NextResponse.json({ success: true, output: stdout }));
          }
        });
      });
    }

    return NextResponse.json({ success: true, message: 'Action acknowledged' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
