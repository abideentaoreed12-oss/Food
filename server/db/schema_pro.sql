-- =============================================================================
-- VeyraNG Production-Grade Cloudflare D1 Database Schema
-- Strict User Partitioning, 3NF Normalization, Zero Data Mixing
-- =============================================================================

-- 1. Identity: Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('customer', 'restaurant', 'courier', 'admin', 'sub_admin')),
  phone TEXT,
  address TEXT,
  restaurant_id TEXT,
  wallet_balance_usd REAL NOT NULL DEFAULT 0.0,
  wallet_balance_ngn REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. Identity: Saved Addresses (Strict user_id isolation)
CREATE TABLE IF NOT EXISTS saved_addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL CHECK(label IN ('Home', 'Work', 'Other')),
  address TEXT NOT NULL,
  apartment TEXT,
  city TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  delivery_instructions TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_saved_addresses_user ON saved_addresses(user_id);

-- 3. Security: One-Time Passwords (OTPs)
CREATE TABLE IF NOT EXISTS otps (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('register', 'forgot')),
  expires_at INTEGER NOT NULL,
  is_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otps_email_purpose ON otps(email, purpose);

-- 4. Merchants: Restaurants
CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  cuisine TEXT NOT NULL,
  rating REAL NOT NULL DEFAULT 5.0,
  review_count INTEGER NOT NULL DEFAULT 0,
  delivery_time_min INTEGER NOT NULL DEFAULT 20,
  delivery_time_max INTEGER NOT NULL DEFAULT 35,
  delivery_fee REAL NOT NULL DEFAULT 3.99,
  min_order REAL NOT NULL DEFAULT 15.00,
  price_tier TEXT NOT NULL DEFAULT '$$' CHECK(price_tier IN ('$', '$$', '$$$')),
  address TEXT NOT NULL,
  distance_km REAL NOT NULL DEFAULT 2.5,
  tags TEXT NOT NULL DEFAULT '[]',
  badge TEXT,
  accent_color TEXT NOT NULL DEFAULT '#10b981',
  is_open INTEGER NOT NULL DEFAULT 1,
  is_busy_paused INTEGER NOT NULL DEFAULT 0,
  commission_percent REAL NOT NULL DEFAULT 15.0,
  zone TEXT NOT NULL DEFAULT 'NYC' CHECK(zone IN ('NYC', 'LAGOS', 'ABUJA')),
  banner_r2_url TEXT,
  raw_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_restaurants_zone ON restaurants(zone);
CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON restaurants(owner_id);

-- 5. Catalog: Menu Categories
CREATE TABLE IF NOT EXISTS menu_categories (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON menu_categories(restaurant_id);

-- 6. Catalog: Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
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
  created_at TEXT NOT NULL,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);

-- 7. Catalog: Item Modifier Groups
CREATE TABLE IF NOT EXISTS item_modifier_groups (
  id TEXT PRIMARY KEY,
  menu_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_required INTEGER NOT NULL DEFAULT 0,
  max_select INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_modifier_groups_item ON item_modifier_groups(menu_item_id);

-- 8. Catalog: Item Modifiers (Options)
CREATE TABLE IF NOT EXISTS item_modifiers (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0.0,
  is_available INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (group_id) REFERENCES item_modifier_groups(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_modifiers_group ON item_modifiers(group_id);

-- 9. Logistics: Courier Profiles (Strict 1:1 user mapping)
CREATE TABLE IF NOT EXISTS courier_profiles (
  user_id TEXT PRIMARY KEY,
  vehicle_type TEXT NOT NULL DEFAULT 'Bicycle' CHECK(vehicle_type IN ('Bicycle', 'Motorcycle', 'Car', 'Van')),
  plate_number TEXT NOT NULL DEFAULT '',
  rating REAL NOT NULL DEFAULT 5.0,
  trips_completed INTEGER NOT NULL DEFAULT 0,
  is_online INTEGER NOT NULL DEFAULT 1,
  current_lat REAL DEFAULT 40.7128,
  current_lng REAL DEFAULT -74.0060,
  active_order_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 10. Orders: Header (Zero data mixing: explicit customer_id, restaurant_id, courier_id)
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  short_id TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  customer_apartment TEXT,
  delivery_notes TEXT,
  restaurant_id TEXT NOT NULL,
  restaurant_name TEXT NOT NULL,
  restaurant_address TEXT NOT NULL,
  courier_id TEXT,
  courier_name TEXT,
  courier_phone TEXT,
  subtotal REAL NOT NULL DEFAULT 0.0,
  delivery_fee REAL NOT NULL DEFAULT 0.0,
  service_fee REAL NOT NULL DEFAULT 0.0,
  tip REAL NOT NULL DEFAULT 0.0,
  discount_amount REAL NOT NULL DEFAULT 0.0,
  wallet_deduction REAL NOT NULL DEFAULT 0.0,
  total REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN' CHECK(currency IN ('NGN', 'USD')),
  fulfillment_type TEXT NOT NULL DEFAULT 'delivery' CHECK(fulfillment_type IN ('delivery', 'pickup', 'scheduled')),
  scheduled_slot TEXT,
  is_contactless INTEGER NOT NULL DEFAULT 0,
  promo_code TEXT,
  handover_pin TEXT NOT NULL DEFAULT '4821',
  prep_time_adjustment_min INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'paid' CHECK(payment_status IN ('pending', 'paid', 'refunded', 'failed')),
  transaction_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'placed' CHECK(status IN ('placed', 'confirmed', 'preparing', 'ready_for_pickup', 'in_transit', 'delivered', 'cancelled')),
  route_progress INTEGER NOT NULL DEFAULT 0,
  estimated_arrival_minutes INTEGER NOT NULL DEFAULT 25,
  raw_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE RESTRICT,
  FOREIGN KEY (courier_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_courier ON orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- 11. Orders: Line Items (Strict order isolation)
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  menu_item_id TEXT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  special_instructions TEXT,
  item_total REAL NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- 12. Orders: Item Customizations
CREATE TABLE IF NOT EXISTS order_item_customizations (
  id TEXT PRIMARY KEY,
  order_item_id TEXT NOT NULL,
  group_id TEXT,
  group_name TEXT NOT NULL,
  option_id TEXT,
  option_name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_customizations_item ON order_item_customizations(order_item_id);

-- 13. Orders: Lifecycle Status History
CREATE TABLE IF NOT EXISTS order_status_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_status_history_order ON order_status_history(order_id);

-- 14. Real-Time Communications: Order Chat (Strict order_id scoping)
CREATE TABLE IF NOT EXISTS order_chats (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK(sender_role IN ('customer', 'courier', 'merchant', 'system')),
  sender_id TEXT,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_order_chats_order ON order_chats(order_id);

-- 15. Financial Ledger: User Wallets (Strict user_id isolation)
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  order_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('topup', 'order_payment', 'refund', 'payout', 'tip', 'bonus')),
  currency TEXT NOT NULL CHECK(currency IN ('NGN', 'USD')),
  amount REAL NOT NULL,
  balance_before REAL NOT NULL,
  balance_after REAL NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('pending', 'completed', 'failed', 'reversed')),
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user ON wallet_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_ref ON wallet_ledger(reference);

-- 16. Promotions: Promo Codes
CREATE TABLE IF NOT EXISTS promo_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  discount_type TEXT NOT NULL CHECK(discount_type IN ('percent', 'fixed')),
  value REAL NOT NULL,
  min_order_amount REAL NOT NULL DEFAULT 0.0,
  max_discount_cap REAL,
  usage_limit INTEGER DEFAULT 1000,
  times_used INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT,
  created_at TEXT NOT NULL
);

-- 17. Promotions: Redemptions (Strict user & order tracking)
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id TEXT PRIMARY KEY,
  promo_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  discount_applied REAL NOT NULL,
  redeemed_at TEXT NOT NULL,
  FOREIGN KEY (promo_id) REFERENCES promo_codes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  UNIQUE(promo_id, user_id, order_id)
);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON promo_redemptions(user_id);

-- 18. Transactions: Gateway Payments
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  user_id TEXT,
  reference TEXT NOT NULL UNIQUE,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method TEXT NOT NULL,
  idempotency_key TEXT,
  raw_response TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order ON transactions(order_id);

-- 19. Security: Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_email TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  ip TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, resource_id);
