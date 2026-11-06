import { NextResponse } from 'next/server';
import { buildSeed } from '@/lib/seed';

export function GET() {
  return NextResponse.json(buildSeed());
}
