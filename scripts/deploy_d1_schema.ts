import fs from 'fs';
import path from 'path';
import { d1Client } from '../server/db/d1Client.ts';

async function deployProD1Schema() {
  console.log('🚀 Starting Cloudflare D1 Production-Grade Schema Migration...');

  const sqlFilePath = path.join(process.cwd(), 'server', 'db', 'schema_pro.sql');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

  // Split by semicolon, filter comments and empty statements
  const statements = sqlContent
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  console.log(`📋 Found ${statements.length} DDL statements to execute on Cloudflare D1...`);

  let executedCount = 0;
  const failures: string[] = [];
  for (const [index, statement] of statements.entries()) {
    try {
      await d1Client.query(statement);
      executedCount++;
    } catch (err: any) {
      failures.push(`Statement ${index + 1}: ${err?.message || 'Unknown D1 error'}`);
      console.error(`❌ ${failures[failures.length - 1]}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`D1 schema migration incomplete: ${executedCount}/${statements.length} statements succeeded. ${failures.join(' | ')}`);
  }
  console.log(`✅ Successfully executed all ${executedCount} schema statements.`);

  // Verify all tables currently in Cloudflare D1
  const tablesRes = await d1Client.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' ORDER BY name;"
  );
  console.log('\n📊 Live Cloudflare D1 Tables:');
  console.log(tablesRes.results.map((r: any) => `  - ${r.name}`).join('\n'));

  // Schema deployment only: business catalog and promotions must be managed from verified production data and admin workflows.
}

deployProD1Schema().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
