import { NextRequest, NextResponse } from 'next/server';
import { siteDataManager } from '../../../../lib/siteDataSnapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized cron invocation' }, { status: 401 });
    }

    const snapshot = await siteDataManager.syncOnce();

    return NextResponse.json({
      success: true,
      refreshedAt: new Date().toISOString(),
      version: snapshot?.version || 0,
      restaurantsCount: snapshot?.restaurants?.length || 0,
      syncStatus: snapshot?.syncStatus || 'unknown'
    });
  } catch (error: any) {
    console.error('[Cron /api/cron/sync] Error syncing site data snapshot:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to sync site data snapshot' },
      { status: 500 }
    );
  }
}
