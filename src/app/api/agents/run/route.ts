import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const force = Boolean(body.force);
    const rootDir = process.cwd();

    let cmd: string;
    if (body.agent === '4_browser_outreach' || body.skill === '/browser-outreach') {
      const scriptPath = path.join(rootDir, 'agents/4_browser_outreach/agent.py');
      if (body.action === 'test-send') {
        const recipient = body.recipient || 'ibrahim.zed24@gmail.com';
        cmd = `python3 "${scriptPath}" --test-send "${recipient}"`;
      } else if (body.action === 'scan') {
        cmd = `python3 "${scriptPath}" --scan`;
      } else if (body.action === 'run-queue') {
        const dryRun = body.dryRun ? '--dry-run' : '';
        cmd = `python3 "${scriptPath}" --run-queue ${dryRun}`;
      } else {
        cmd = `python3 "${scriptPath}" --check`;
      }
    } else {
      const scriptPath = path.join(rootDir, 'agents/1_orchestrator/agent.py');
      const flag = force ? '--force' : '';
      cmd = `python3 "${scriptPath}" --run-daily ${flag}`;
    }

    return new Promise<NextResponse>((resolve) => {
      exec(cmd, { cwd: rootDir, timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
          resolve(NextResponse.json({ success: false, error: stderr || stdout || error.message }, { status: 500 }));
        } else {
          resolve(NextResponse.json({ success: true, output: stdout }));
        }
      });
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
