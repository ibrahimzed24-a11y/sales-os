import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cohort = searchParams.get('cohort'); // 'A', 'B', or null (all)
    const rootDir = process.cwd();

    const pathA = path.join(rootDir, 'data/segregated/cohort_a_live_website.json');
    const pathB = path.join(rootDir, 'data/segregated/cohort_b_no_website.json');
    const pathExcluded = path.join(rootDir, 'data/segregated/excluded_dso_clinics.json');

    const cohortA = fs.existsSync(pathA) ? JSON.parse(fs.readFileSync(pathA, 'utf-8')) : [];
    const cohortB = fs.existsSync(pathB) ? JSON.parse(fs.readFileSync(pathB, 'utf-8')) : [];
    const excludedDso = fs.existsSync(pathExcluded) ? JSON.parse(fs.readFileSync(pathExcluded, 'utf-8')) : [];

    if (cohort === 'A') {
      return NextResponse.json({ cohort: 'COHORT_A_LIVE_WEBSITE', count: cohortA.length, leads: cohortA });
    }
    if (cohort === 'B') {
      return NextResponse.json({ cohort: 'COHORT_B_NO_WEBSITE', count: cohortB.length, leads: cohortB });
    }
    if (cohort === 'DSO') {
      return NextResponse.json({ cohort: 'EXCLUDED_DSO', count: excludedDso.length, leads: excludedDso });
    }

    return NextResponse.json({
      cohortA: { count: cohortA.length, leads: cohortA },
      cohortB: { count: cohortB.length, leads: cohortB },
      excludedDso: { count: excludedDso.length },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
