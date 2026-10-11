export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Vercel serverless instances freeze between requests, so ongoing setInterval
    // timers must not be started in instrumentation. Database reads and snapshot
    // loading occur on-demand per request or via /api/cron/sync-site-data.
    const { siteDataManager } = await import('./lib/siteDataSnapshot');
    await siteDataManager.loadSnapshot().catch(() => {});
  }
}
