import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID, randomInt, randomBytes, createHash } from 'crypto';
import { sendVerificationEmail } from './email';
import { d1 } from './d1';
import { r2 } from './r2';
import { siteDataManager, PUBLIC_SETTINGS_WHITELIST } from './siteDataSnapshot';
import { paymentGateway } from './payment';
import {
  calculateRestaurantDistanceMetrics,
  calculateDistanceAndDuration,
  calculateBatchRestaurantDistanceMetrics,
  geocodeAddress,
  reverseGeocodeCoordinates
} from '../server/utils/distance';
import { buildPublicRestaurant, buildPublicRestaurantList } from './restaurantMenu';

/**
 * Keep the restaurant document (the public storefront's canonical menu source)
 * synchronized with the normalized menu_items table after every menu mutation.
 */
export async function syncMenuItemToRestaurantJson(
  itemId: string,
  item: any | null,
  targetRestaurantId?: string | null,
  deletedItemName?: string | null
) {
  // Public menus are served from menu_items / menu_categories only.
  // Strip legacy embedded categories from restaurants.raw_json after mutations.
  const restaurantsRes = await d1.query(
    targetRestaurantId
      ? 'SELECT id, raw_json FROM restaurants WHERE id = ?'
      : 'SELECT id, raw_json FROM restaurants',
    targetRestaurantId ? [targetRestaurantId] : [],
    { cache: false }
  );
  if (!restaurantsRes || restaurantsRes.success === false || !Array.isArray(restaurantsRes.results)) {
    throw new Error('Could not read restaurants while clearing legacy embedded menus.');
  }
  for (const row of restaurantsRes.results || []) {
    let restaurantData: any = {};
    try { restaurantData = row.raw_json ? JSON.parse(row.raw_json) : {}; } catch { restaurantData = {}; }
    if (!restaurantData || typeof restaurantData !== 'object') continue;
    if (!('categories' in restaurantData) && !('menuItems' in restaurantData) && !('menu_items' in restaurantData)) continue;
    delete restaurantData.categories;
    delete restaurantData.menuItems;
    delete restaurantData.menu_items;
    const updateRes = await d1.query('UPDATE restaurants SET raw_json = ? WHERE id = ?', [JSON.stringify(restaurantData), row.id]);
    if (!updateRes || updateRes.success === false) {
      throw new Error('Could not strip embedded menu from restaurant ' + row.id);
    }
  }
  // The D1 menu mutation is already committed before this helper runs. Snapshot/R2
  // persistence is a distribution step, not a reason to report a successful menu
  // edit as failed. Attempt an immediate refresh; the regular sync cycle can retry
  // if R2 is temporarily unavailable.
  try {
    const snapshot = await siteDataManager.refreshSnapshot({ force: true, allowEmpty: true, isAuthorizedAdmin: true });
    if (!snapshot || snapshot.syncStatus !== 'synced' || !snapshot.metadata?.persistedToD1 || !snapshot.metadata?.persistedToR2) {
      console.warn('[MenuSync] D1 mutation succeeded, but immediate snapshot persistence is incomplete; scheduled sync will retry.');
    }
  } catch (syncError: any) {
    console.warn('[MenuSync] D1 mutation succeeded, but immediate snapshot refresh failed; scheduled sync will retry:', syncError?.message || syncError);
  }
}


export const JWT_SECRET = (process.env.JWT_SECRET || '').trim();
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
export const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();

export function verifyToken(req: NextRequest): any | null {
  if (!JWT_SECRET) return null;
  try {
    const authHeader = req.headers.get('authorization');
    const rawToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies.get('veyrang_jwt_token')?.value ||
        req.cookies.get('veyrang_token')?.value ||
        req.cookies.get('veyrang_auth_token')?.value ||
        req.cookies.get('token')?.value ||
        req.cookies.get('auth_token')?.value;
    const token = (rawToken || '').trim();
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

export async function getUser(req: NextRequest) {
  const decoded = verifyToken(req);
  if (!decoded) return null;
  const d1Res = await d1
    .query(
      'SELECT id, email, role, name, phone, address, restaurant_id, wallet_balance_ngn, wallet_balance_usd, saved_addresses, is_approved FROM users WHERE id = ? OR LOWER(email) = LOWER(?) LIMIT 1',
      [decoded.id, decoded.email || '']
    )
    .catch(() => ({ results: [] as any[] }));
  if (d1Res.results?.[0]) {
    const u = d1Res.results[0];
    let savedAddresses: any[] = [];
    try {
      savedAddresses =
        typeof u.saved_addresses === 'string'
          ? JSON.parse(u.saved_addresses)
          : u.saved_addresses || [];
    } catch {
      savedAddresses = [];
    }
    return {
      id: u.id,
      email: u.email,
      role: u.role || decoded.role || 'customer',
      name: u.name || decoded.name || 'User',
      phone: u.phone || '',
      address: u.address || '',
      restaurantId: u.restaurant_id || undefined,
      isApproved: u.is_approved !== 0,
      walletBalanceNGN: Number(u.wallet_balance_ngn || 0),
      walletBalanceUSD: Number(u.wallet_balance_usd || 0),
      savedAddresses
    };
  }
  return {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role || 'customer',
    name: decoded.name || (decoded.email ? decoded.email.split('@')[0] : 'User'),
    phone: '',
    address: '',
    isApproved: true,
    walletBalanceNGN: 0,
    walletBalanceUSD: 0,
    savedAddresses: []
  };
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return (
    origin === 'https://veyrang.com' ||
    origin === 'https://www.veyrang.com' ||
    origin === 'https://ais-dev-b3frbycfvmzsap3tmpvq42-66468010994.europe-west2.run.app' ||
    origin === 'https://ais-pre-b3frbycfvmzsap3tmpvq42-66468010994.europe-west2.run.app' ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1')
  );
}
