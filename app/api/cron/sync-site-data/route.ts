import { NextRequest, NextResponse } from 'next/server';
import { siteDataManager } from '../../../../lib/siteDataSnapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Vercel Cron or administrator scheduled snapshot refresh.
 * Requires Authorization: Bearer ${CRON_SECRET} (always).
 */
function authorizeCron(req: NextRequest): NextResponse | null {
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  if (!cronSecret) {
    return NextResponse.json(
      { success: false, error: 'CRON_SECRET is not configured' },
      { status: 503 }
    );
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized cron invocation' }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const denied = authorizeCron(req);
    if (denied) return denied;

    const snapshot = await siteDataManager.refreshSnapshot({ force: true, allowEmpty: true, isAuthorizedAdmin: true });

    return NextResponse.json({
      success: true,
      refreshedAt: new Date().toISOString(),
      version: snapshot?.version || 0,
      restaurantsCount: snapshot?.restaurants?.length || 0,
      syncStatus: snapshot?.syncStatus || 'unknown'
    });
  } catch (error: any) {
    console.error('[Cron /api/cron/sync-site-data] Error refreshing site data snapshot:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to refresh site data snapshot' },
      { status: 500 }
    );
  }
}
