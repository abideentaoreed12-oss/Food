import { d1Client } from '../server/db/d1Client.ts';
import { INITIAL_RESTAURANTS } from '../src/data/mockData.ts';

const PROMO_CODES = [
  { code: 'VEYRA10', type: 'percent', value: 10, minOrder: 15, maxDiscount: 10 },
  { code: 'FREESHIP', type: 'fixed', value: 3.99, minOrder: 25, maxDiscount: 3.99 },
  { code: 'FIRST50', type: 'percent', value: 50, minOrder: 20, maxDiscount: 15 },
  { code: 'WELCOME20', type: 'percent', value: 20, minOrder: 30, maxDiscount: 20 }
];

async function runSafeMigration() {
  console.log('🔄 Executing Zero-Loss Production D1 Migration...');

  // Helper to add column if not exists
  async function addColumnIfNotExists(table: string, column: string, type: string) {
    try {
      const info = await d1Client.query(`PRAGMA table_info(${table});`);
      const exists = info.results.some((c: any) => c.name.toLowerCase() === column.toLowerCase());
      if (!exists) {
        await d1Client.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type};`);
        console.log(`  ➕ Added column ${column} to ${table}`);
      }
    } catch (err: any) {
      console.warn(`  ⚠️ Could not add column ${column} to ${table}: ${err.message}`);
    }
  }

  // 1. Upgrade existing restaurants table
  console.log('1️⃣ Upgrading restaurants columns...');
  await addColumnIfNotExists('restaurants', 'owner_id', 'TEXT');
  await addColumnIfNotExists('restaurants', 'slug', 'TEXT');
  await addColumnIfNotExists('restaurants', 'review_count', 'INTEGER DEFAULT 0');
  await addColumnIfNotExists('restaurants', 'delivery_time_min', 'INTEGER DEFAULT 20');
  await addColumnIfNotExists('restaurants', 'delivery_time_max', 'INTEGER DEFAULT 35');
  await addColumnIfNotExists('restaurants', 'delivery_fee', 'REAL DEFAULT 3.99');
  await addColumnIfNotExists('restaurants', 'min_order', 'REAL DEFAULT 15.0');
  await addColumnIfNotExists('restaurants', 'price_tier', 'TEXT DEFAULT "$$"');
  await addColumnIfNotExists('restaurants', 'address', 'TEXT DEFAULT ""');
  await addColumnIfNotExists('restaurants', 'distance_km', 'REAL DEFAULT 2.5');
  await addColumnIfNotExists('restaurants', 'tags', 'TEXT DEFAULT "[]"');
  await addColumnIfNotExists('restaurants', 'badge', 'TEXT');
  await addColumnIfNotExists('restaurants', 'accent_color', 'TEXT DEFAULT "#10b981"');
  await addColumnIfNotExists('restaurants', 'is_open', 'INTEGER DEFAULT 1');
  await addColumnIfNotExists('restaurants', 'is_busy_paused', 'INTEGER DEFAULT 0');
  await addColumnIfNotExists('restaurants', 'commission_percent', 'REAL DEFAULT 15.0');
  await addColumnIfNotExists('restaurants', 'zone', 'TEXT DEFAULT "NYC"');
  await addColumnIfNotExists('restaurants', 'banner_r2_url', 'TEXT');

  // 2. Upgrade existing orders table
  console.log('2️⃣ Upgrading orders columns...');
  await addColumnIfNotExists('orders', 'customer_apartment', 'TEXT');
  await addColumnIfNotExists('orders', 'delivery_notes', 'TEXT');
  await addColumnIfNotExists('orders', 'restaurant_address', 'TEXT');
  await addColumnIfNotExists('orders', 'courier_id', 'TEXT');
  await addColumnIfNotExists('orders', 'courier_name', 'TEXT');
  await addColumnIfNotExists('orders', 'courier_phone', 'TEXT');
  await addColumnIfNotExists('orders', 'subtotal', 'REAL DEFAULT 0.0');
  await addColumnIfNotExists('orders', 'delivery_fee', 'REAL DEFAULT 0.0');
  await addColumnIfNotExists('orders', 'service_fee', 'REAL DEFAULT 0.0');
  await addColumnIfNotExists('orders', 'tip', 'REAL DEFAULT 0.0');
  await addColumnIfNotExists('orders', 'discount_amount', 'REAL DEFAULT 0.0');
  await addColumnIfNotExists('orders', 'wallet_deduction', 'REAL DEFAULT 0.0');
  await addColumnIfNotExists('orders', 'fulfillment_type', 'TEXT DEFAULT "delivery"');
  await addColumnIfNotExists('orders', 'scheduled_slot', 'TEXT');
  await addColumnIfNotExists('orders', 'is_contactless', 'INTEGER DEFAULT 0');
  await addColumnIfNotExists('orders', 'promo_code', 'TEXT');
  await addColumnIfNotExists('orders', 'handover_pin', 'TEXT DEFAULT "4821"');
  await addColumnIfNotExists('orders', 'prep_time_adjustment_min', 'INTEGER DEFAULT 0');
  await addColumnIfNotExists('orders', 'transaction_ref', 'TEXT DEFAULT ""');
  await addColumnIfNotExists('orders', 'route_progress', 'INTEGER DEFAULT 0');
  await addColumnIfNotExists('orders', 'estimated_arrival_minutes', 'INTEGER DEFAULT 25');

  // 3. Upgrade existing transactions & audit_logs
  console.log('3️⃣ Upgrading transactions & audit_logs columns...');
  await addColumnIfNotExists('transactions', 'user_id', 'TEXT');
  await addColumnIfNotExists('transactions', 'idempotency_key', 'TEXT');
  await addColumnIfNotExists('transactions', 'raw_response', 'TEXT');
  await addColumnIfNotExists('audit_logs', 'details_json', 'TEXT');

  // 4. Create all new normalized tables
  console.log('4️⃣ Creating normalized child & auxiliary tables...');

  const newTables = [
    `CREATE TABLE IF NOT EXISTS saved_addresses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      address TEXT NOT NULL,
      apartment TEXT,
      city TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      delivery_instructions TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS otps (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      purpose TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      is_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS menu_categories (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL,
      dietary_tags TEXT NOT NULL DEFAULT '[]',
      popular INTEGER NOT NULL DEFAULT 0,
      calories INTEGER,
      prep_time_min INTEGER NOT NULL DEFAULT 15,
      is_available INTEGER NOT NULL DEFAULT 1,
      image_r2_url TEXT,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS item_modifier_groups (
      id TEXT PRIMARY KEY,
      menu_item_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_required INTEGER NOT NULL DEFAULT 0,
      max_select INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS item_modifiers (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0.0,
      is_available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS courier_profiles (
      user_id TEXT PRIMARY KEY,
      vehicle_type TEXT NOT NULL DEFAULT 'Bicycle',
      plate_number TEXT NOT NULL DEFAULT '',
      rating REAL NOT NULL DEFAULT 5.0,
      trips_completed INTEGER NOT NULL DEFAULT 0,
      is_online INTEGER NOT NULL DEFAULT 1,
      current_lat REAL DEFAULT 40.7128,
      current_lng REAL DEFAULT -74.0060,
      active_order_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      menu_item_id TEXT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      special_instructions TEXT,
      item_total REAL NOT NULL,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS order_item_customizations (
      id TEXT PRIMARY KEY,
      order_item_id TEXT NOT NULL,
      group_id TEXT,
      group_name TEXT NOT NULL,
      option_id TEXT,
      option_name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0.0,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS order_status_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS order_chats (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      sender_id TEXT,
      sender_name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS wallet_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      order_id TEXT,
      type TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount REAL NOT NULL,
      balance_before REAL NOT NULL,
      balance_after REAL NOT NULL,
      reference TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'completed',
      note TEXT,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS promo_codes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      discount_type TEXT NOT NULL,
      value REAL NOT NULL,
      min_order_amount REAL NOT NULL DEFAULT 0.0,
      max_discount_cap REAL,
      usage_limit INTEGER DEFAULT 1000,
      times_used INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT,
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS promo_redemptions (
      id TEXT PRIMARY KEY,
      promo_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      discount_applied REAL NOT NULL,
      redeemed_at TEXT NOT NULL
    );`
  ];

  for (const sql of newTables) {
    await d1Client.query(sql);
  }
  console.log('  ✅ All 14 child tables created successfully.');

  // 5. Create Performance & User Isolation Indexes
  console.log('5️⃣ Creating Performance & User Isolation Indexes...');
  const indexStatements = [
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);',
    'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);',
    'CREATE INDEX IF NOT EXISTS idx_saved_addresses_user ON saved_addresses(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_otps_email_purpose ON otps(email, purpose);',
    'CREATE INDEX IF NOT EXISTS idx_restaurants_zone ON restaurants(zone);',
    'CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON menu_categories(restaurant_id);',
    'CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);',
    'CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);',
    'CREATE INDEX IF NOT EXISTS idx_modifier_groups_item ON item_modifier_groups(menu_item_id);',
    'CREATE INDEX IF NOT EXISTS idx_modifiers_group ON item_modifiers(group_id);',
    'CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);',
    'CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);',
    'CREATE INDEX IF NOT EXISTS idx_orders_courier ON orders(courier_id);',
    'CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);',
    'CREATE INDEX IF NOT EXISTS idx_customizations_item ON order_item_customizations(order_item_id);',
    'CREATE INDEX IF NOT EXISTS idx_status_history_order ON order_status_history(order_id);',
    'CREATE INDEX IF NOT EXISTS idx_order_chats_order ON order_chats(order_id);',
    'CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user ON wallet_ledger(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_wallet_ledger_ref ON wallet_ledger(reference);',
    'CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON promo_redemptions(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);'
  ];

  for (const idx of indexStatements) {
    try {
      await d1Client.query(idx);
    } catch (err: any) {
      console.warn(`  Index note: ${err.message}`);
    }
  }

  // 6. Populate Relational Catalog
  console.log('6️⃣ Populating Relational Catalog Data...');
  for (const rest of INITIAL_RESTAURANTS) {
    await d1Client.query(
      `INSERT INTO restaurants (id, name, slug, cuisine, rating, review_count, delivery_time_min, delivery_time_max, delivery_fee, min_order, price_tier, address, distance_km, tags, badge, accent_color, is_open, is_busy_paused, commission_percent, zone, raw_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         cuisine = excluded.cuisine,
         rating = excluded.rating,
         delivery_fee = excluded.delivery_fee,
         is_open = excluded.is_open,
         raw_json = excluded.raw_json;`,
      [
        rest.id,
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

  // 7. Seed Promo Codes
  console.log('7️⃣ Seeding promo codes...');
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

  // 8. Seed Courier Profile
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

  // 9. Verify Final Table Count & List
  const allTables = await d1Client.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' ORDER BY name;"
  );
  console.log(`\n🎉 Migration Complete! Total live tables in Cloudflare D1: ${allTables.results.length}`);
  console.log(allTables.results.map((r: any, i: number) => `  ${i + 1}. ${r.name}`).join('\n'));
}

runSafeMigration().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
