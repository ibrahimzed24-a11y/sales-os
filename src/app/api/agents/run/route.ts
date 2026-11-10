import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const force = Boolean(body.force);
    const rootDir = process.cwd();
    const scriptPath = path.join(rootDir, 'agents/1_orchestrator/agent.py');

    const flag = force ? '--force' : '';
    const cmd = `python3 "${scriptPath}" --run-daily ${flag}`;

    return new Promise<NextResponse>((resolve) => {
      exec(cmd, { cwd: rootDir, timeout: 30000 }, (error, stdout, stderr) => {
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
