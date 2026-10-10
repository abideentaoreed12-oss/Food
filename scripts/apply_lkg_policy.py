#!/usr/bin/env python3
"""Make last-known-good = last successful D1 read; distribute that file; empty is valid."""
from pathlib import Path

p = Path("lib/siteDataSnapshot.ts")
text = p.read_text()
changed = False

old_catch = """      } catch (err: any) {
        this.consecutiveFailures++;
        console.warn(
          '[SiteData] Failed to refresh snapshot from primary source:',
          err?.message || err,
          'Not serving a stale catalogue after a failed D1 refresh.'
        );
        return null;
      } finally {"""

new_catch = """      } catch (err: any) {
        this.consecutiveFailures++;
        // Outage: distribute last successful D1 snapshot only — never invent catalogue data.
        const lkg = this.getLastKnownGood();
        if (lkg) {
          console.warn(
            '[SiteData] D1 refresh failed; distributing last successful D1 snapshot v' +
              lkg.version +
              ':',
            err?.message || err
          );
          return {
            ...lkg,
            syncStatus: 'fallback' as const,
            lastAttemptedAt: new Date().toISOString(),
            metadata: {
              ...(lkg.metadata || {
                restaurantCount: lkg.restaurants?.length || 0,
                deliveryZoneCount: lkg.deliveryZones?.length || 0,
                promoCodeCount: lkg.promoCodes?.length || 0,
                persistedToD1: false,
                persistedToR2: false,
              }),
              consecutiveFailures: this.consecutiveFailures,
              lastError: String(err?.message || err),
            },
          };
        }
        console.warn(
          '[SiteData] D1 refresh failed and no last-known-good snapshot exists yet:',
          err?.message || err
        );
        return null;
      } finally {"""

if old_catch in text:
    text = text.replace(old_catch, new_catch)
    changed = True
    print("catch -> LKG")
elif "distributing last successful D1 snapshot" in text:
    print("catch already LKG")
else:
    print("WARN catch pattern missing")

old_strip = """        // Filter out any internal passwords or secret columns
        for (const r of restaurants) {
          delete r.password;
          delete r.password_hash;
          delete r.token;
          delete r.secret;
        }"""
new_strip = """        // Secrets + never publish embedded menu blobs (menu_items is the dish source).
        for (const r of restaurants) {
          delete r.password;
          delete r.password_hash;
          delete r.token;
          delete r.secret;
          delete r.categories;
          delete r.menuItems;
          delete r.menu_items;
        }"""
if old_strip in text:
    text = text.replace(old_strip, new_strip)
    changed = True
    print("strip embed")
elif "delete r.categories" in text:
    print("strip already")
else:
    print("WARN strip missing")

old_backoff = """      if (now - this.lastSyncTimestamp < backoffMs) {
        return null;
      }"""
new_backoff = """      if (now - this.lastSyncTimestamp < backoffMs) {
        return this.getLastKnownGood();
      }"""
if old_backoff in text:
    text = text.replace(old_backoff, new_backoff)
    changed = True
    print("backoff -> LKG")

if "getLastSync(" not in text:
    anchor = """  public getLastKnownGood(): SiteDataSnapshot | null {
    if (!this.currentSnapshot) {
      this.loadFromDiskSync();
    }
    return this.currentSnapshot;
  }"""
    repl = anchor + """

  /** Last successful D1 catalogue that was stored and distributed. */
  public getLastSync(): SiteDataSnapshot | null {
    return this.getLastKnownGood();
  }"""
    if anchor in text:
        text = text.replace(anchor, repl)
        changed = True
        print("getLastSync added")

old_doc = """  /**
   * Refreshes the site data snapshot from authoritative Cloudflare D1.
   * Validates fresh data before updating.
   * Preserves previous valid snapshot during failures or transient empty states.
   * Protects against concurrent refreshes using a promise lock.
   */"""
new_doc = """  /**
   * Refreshes from authoritative Cloudflare D1.
   * Success: store+distribute that exact result (empty catalogue allowed) as last-known-good.
   * Failure: return getLastKnownGood() / getLastSync() — last successful D1 read only.
   * Never invent restaurants, prices, or demo menus.
   */"""
if old_doc in text:
    text = text.replace(old_doc, new_doc)
    changed = True
    print("docs")

if changed:
    p.write_text(text)
    print("WROTE", len(text))
else:
    print("No changes")
