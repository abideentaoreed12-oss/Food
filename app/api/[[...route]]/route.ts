import { NextRequest, NextResponse } from 'next/server';
// EMERGENCY_RESTORE_MARKER - content will be replaced
export async function GET() {
  return NextResponse.json({ error: 'API temporarily restoring' }, { status: 503 });
}
export async function POST() {
  return NextResponse.json({ error: 'API temporarily restoring' }, { status: 503 });
}
