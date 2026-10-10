export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { siteDataManager } = await import('./lib/siteDataSnapshot');
    siteDataManager.startBackgroundSync(10000);
  }
}
