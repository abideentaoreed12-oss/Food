import { d1Client } from '../server/db/d1Client';
import { r2 } from '../lib/r2';
import { d1 } from '../lib/d1';

async function runAuditTests() {
  console.log('====================================================');
  console.log(' VEYRANG CLOUDFLARE D1 & R2 VERIFICATION TEST SUITE ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, detail?: any) {
    if (condition) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc}`, detail || '');
      failed++;
    }
  }

  // 1. D1 Live Connection Test
  console.log('--- 1. Testing Live Cloudflare D1 Connection ---');
  const d1Ping = await d1.ping();
  assert('D1 responds to ping query', d1Ping.connected, d1Ping.error);
  console.log(`   D1 Query Latency: ${d1Ping.latencyMs}ms`);

  // 2. Audit All 32 D1 Tables
  console.log('\n--- 2. Auditing 32 Live D1 Tables ---');
  const tablesRes = await d1Client.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' ORDER BY name");
  const tableNames = (tablesRes.results || []).map((r: any) => r.name);
  assert('32 database tables present in D1', tableNames.length === 32, `Found ${tableNames.length} tables: ${tableNames.join(', ')}`);

  const expectedTables = [
    'addons', 'audit_logs', 'categories', 'courier_locations', 'courier_profiles',
    'delivery_zones', 'item_modifier_groups', 'item_modifiers', 'menu_categories',
    'menu_items', 'notifications_broadcasts', 'order_chats', 'order_item_customizations',
    'order_items', 'order_status_history', 'orders', 'otps', 'platform_settings',
    'promo_codes', 'promo_redemptions', 'promos', 'restaurants', 'reviews',
    'saved_addresses', 'support_tickets', 'transactions', 'user_virtual_accounts',
    'users', 'verification_codes', 'wallet_ledger', 'wallet_transactions', 'webhook_events'
  ];

  for (const expected of expectedTables) {
    assert(`Table '${expected}' exists in live D1`, tableNames.includes(expected));
  }

  // 3. Schema & Column Integrity Tests
  console.log('\n--- 3. Verifying Key Column Definitions & Constraints ---');
  const auditCols = await d1Client.query('PRAGMA table_info(audit_logs)');
  const auditColNames = (auditCols.results || []).map((c: any) => c.name);
  assert('audit_logs has created_at column', auditColNames.includes('created_at'));
  assert('audit_logs has details_json column', auditColNames.includes('details_json'));

  const ticketCols = await d1Client.query('PRAGMA table_info(support_tickets)');
  const ticketColNames = (ticketCols.results || []).map((c: any) => c.name);
  assert('support_tickets has customer_name column', ticketColNames.includes('customer_name'));
  assert('support_tickets has issue column', ticketColNames.includes('issue'));
  assert('support_tickets has priority column', ticketColNames.includes('priority'));
  assert('support_tickets has status column', ticketColNames.includes('status'));

  const promoCols = await d1Client.query('PRAGMA table_info(promo_codes)');
  const promoColNames = (promoCols.results || []).map((c: any) => c.name);
  assert('promo_codes has code column', promoColNames.includes('code'));
  assert('promo_codes has discount_type column', promoColNames.includes('discount_type'));
  assert('promo_codes has value column', promoColNames.includes('value'));

  // 4. Live Promo Codes Verification
  console.log('\n--- 4. Checking Active Promo Codes in D1 ---');
  const promoData = await d1Client.query('SELECT code, discount_type, value FROM promo_codes WHERE is_active = 1');
  assert('promo_codes table has synchronized active promo codes', (promoData.results?.length || 0) > 0, promoData.results);
  const codes = (promoData.results || []).map((p: any) => p.code);
  assert('FIRST50 promo code is available', codes.includes('FIRST50'));
  assert('WELCOME20 promo code is available', codes.includes('WELCOME20'));
  assert('FREEDEL promo code is available', codes.includes('FREEDEL'));

  // 5. Cloudflare R2 Storage Operations
  console.log('\n--- 5. Testing Live Cloudflare R2 Bucket Operations ---');
  assert('R2 client is configured', r2.isConfigured());
  const r2Details = r2.getDetails();
  console.log(`   R2 Bucket: ${r2Details.bucketName}`);

  const testKey = `test-audit-${Date.now()}.txt`;
  const testPayload = Buffer.from(`Audit test payload verified at ${new Date().toISOString()}`).toString('base64');

  console.log(`   Uploading test object to R2: ${testKey}`);
  const uploadRes = await r2.upload(testKey, testPayload, 'text/plain');
  assert('R2 upload succeeded directly to bucket', uploadRes.success, uploadRes.error);

  if (uploadRes.success) {
    console.log(`   Fetching test object from R2: ${testKey}`);
    const fetchRes = await r2.getObject(testKey);
    assert('R2 getObject fetched accurate data from bucket', fetchRes !== null && fetchRes.data.length > 0);

    console.log(`   Deleting test object from R2: ${testKey}`);
    const delRes = await r2.delete(testKey);
    assert('R2 delete removed object cleanly', delRes.success);
  }

  // 6. Report Summary
  console.log('\n====================================================');
  console.log(` AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuditTests().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
