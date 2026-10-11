import { NextRequest, NextResponse } from 'next/server';
import { siteDataManager } from '../../../../lib/siteDataSnapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron or administrator scheduled snapshot refresh.
 * Replaces client-side/instance setInterval timers with serverless scheduled execution.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is configured, enforce Bearer authentication
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized cron invocation' }, { status: 401 });
    }

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
