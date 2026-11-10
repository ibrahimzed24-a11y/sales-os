import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rootDir = process.cwd();
    const briefsDir = path.join(rootDir, 'dist/growth-briefs');
    if (!fs.existsSync(briefsDir)) {
      return NextResponse.json({ briefs: [] });
    }

    const files = fs.readdirSync(briefsDir).filter((f) => f.endsWith('.md')).sort().reverse();
    const briefs = files.map((f) => {
      const content = fs.readFileSync(path.join(briefsDir, f), 'utf-8');
      return {
        filename: f,
        content,
      };
    });

    return NextResponse.json({ briefs, latest: briefs[0] || null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
