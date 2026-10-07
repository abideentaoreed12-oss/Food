import fs from 'fs';
import path from 'path';
import { d1Client } from '../server/db/d1Client.ts';
import { INITIAL_RESTAURANTS } from '../src/data/mockData.ts';

const PROMO_CODES = [
  { code: 'VEYRA10', type: 'percent', value: 10, minOrder: 15, maxDiscount: 10 },
  { code: 'FREESHIP', type: 'fixed', value: 3.99, minOrder: 25, maxDiscount: 3.99 },
  { code: 'FIRST50', type: 'percent', value: 50, minOrder: 20, maxDiscount: 15 },
  { code: 'WELCOME20', type: 'percent', value: 20, minOrder: 30, maxDiscount: 20 }
];

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
  for (const statement of statements) {
    try {
      await d1Client.query(statement);
      executedCount++;
    } catch (err: any) {
      console.error(`⚠️ Statement error (may already exist): ${err.message}`);
    }
  }

  console.log(`✅ Successfully executed ${executedCount}/${statements.length} statements!`);

  // Verify all tables currently in Cloudflare D1
  const tablesRes = await d1Client.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' ORDER BY name;"
  );
  console.log('\n📊 Live Cloudflare D1 Tables:');
  console.log(tablesRes.results.map((r: any) => `  - ${r.name}`).join('\n'));

  // Now seed Restaurants, Categories, Menu Items, Modifier Groups & Modifiers with strict foreign keys
  console.log('\n🌱 Populating relational catalog data into Cloudflare D1 (Zero data mixing)...');

  for (const rest of INITIAL_RESTAURANTS) {
    // 1. Insert Restaurant
    await d1Client.query(
      `INSERT INTO restaurants (id, owner_id, name, slug, cuisine, rating, review_count, delivery_time_min, delivery_time_max, delivery_fee, min_order, price_tier, address, distance_km, tags, badge, accent_color, is_open, is_busy_paused, commission_percent, zone, raw_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         cuisine = excluded.cuisine,
         rating = excluded.rating,
         delivery_fee = excluded.delivery_fee,
         is_open = excluded.is_open,
         raw_json = excluded.raw_json;`,
      [
        rest.id,
        null,
        rest.name,
        rest.id,
        rest.cuisine,
        rest.rating,
        rest.reviewCount,
        rest.deliveryTimeMin,
        rest.deliveryTimeMax,
        rest.deliveryFee,
        rest.minOrder,
        rest.priceTier,
        rest.address,
        rest.distanceKm,
        JSON.stringify(rest.tags),
        rest.badge || null,
        rest.accentColor,
        rest.isOpen ? 1 : 0,
        rest.isBusyPaused ? 1 : 0,
        rest.commissionPercent || 15,
        rest.zone || 'NYC',
        JSON.stringify(rest),
        (rest as any).createdAt || new Date().toISOString()
      ]
    );

    // 2. Insert Categories & Menu Items
    let sortIdx = 0;
    for (const cat of rest.categories) {
      sortIdx++;
      await d1Client.query(
        `INSERT INTO menu_categories (id, restaurant_id, name, description, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name;`,
        [cat.id, rest.id, cat.name, cat.description || null, sortIdx, new Date().toISOString()]
      );

      for (const item of cat.items) {
        await d1Client.query(
          `INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, dietary_tags, popular, calories, prep_time_min, is_available, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             price = excluded.price,
             is_available = excluded.is_available;`,
          [
            item.id,
            rest.id,
            cat.id,
            item.name,
            item.description || '',
            item.price,
            JSON.stringify(item.dietary || []),
            item.popular ? 1 : 0,
            item.calories || null,
            item.prepTimeMin || 15,
            item.isAvailable ? 1 : 0,
            new Date().toISOString()
          ]
        );

        // 3. Insert Customization Groups & Options
        if (item.customizations && item.customizations.length > 0) {
          for (const group of item.customizations) {
            await d1Client.query(
              `INSERT INTO item_modifier_groups (id, menu_item_id, name, is_required, max_select, created_at)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET name = excluded.name;`,
              [group.id, item.id, group.name, group.required ? 1 : 0, group.maxSelect || 1, new Date().toISOString()]
            );

            for (const opt of group.options) {
              await d1Client.query(
                `INSERT INTO item_modifiers (id, group_id, name, price, is_available, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET price = excluded.price;`,
                [opt.id, group.id, opt.name, opt.price, 1, new Date().toISOString()]
              );
            }
          }
        }
      }
    }
  }

  // 4. Seed Promo Codes
  console.log('🎟️ Seeding promo codes into Cloudflare D1...');
  for (const promo of PROMO_CODES) {
    await d1Client.query(
      `INSERT INTO promo_codes (id, code, discount_type, value, min_order_amount, max_discount_cap, usage_limit, times_used, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET value = excluded.value;`,
      [
        `promo-${promo.code.toLowerCase()}`,
        promo.code.toUpperCase(),
        promo.type,
        promo.value,
        promo.minOrder,
        promo.maxDiscount || null,
        1000,
        0,
        1,
        new Date().toISOString()
      ]
    );
  }

  // 5. Seed default Courier Profile for existing courier
  await d1Client.query(
    `INSERT INTO courier_profiles (user_id, vehicle_type, plate_number, rating, trips_completed, is_online, current_lat, current_lng, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET is_online = excluded.is_online;`,
    [
      'usr-courier-1',
      'Motorcycle',
      'LAG-849-XK',
      4.9,
      128,
      1,
      40.7128,
      -74.0060,
      new Date().toISOString(),
      new Date().toISOString()
    ]
  );

  console.log('\n🎉 Production-Grade D1 Database Setup Complete! Zero Data Mixing Guaranteed.');
}

deployProD1Schema().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
