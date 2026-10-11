#!/usr/bin/env python3
"""Harden LKG: cold-start bootstrap, sync timestamps on load, no empty menu categories."""
from pathlib import Path

p = Path("lib/siteDataSnapshot.ts")
t = p.read_text()

old_d1 = """          this.currentSnapshot = {
            ...parsed,
            schemaVersion: parsed.schemaVersion || 1,
            source: 'cloudflare_d1',
            syncStatus: 'synced'
          };
          this.persistToDisk(this.currentSnapshot);
          return this.currentSnapshot;"""
new_d1 = """          this.currentSnapshot = {
            ...parsed,
            schemaVersion: parsed.schemaVersion || 1,
            source: 'cloudflare_d1',
            syncStatus: 'synced'
          };
          const loadedAt = Date.parse(String(parsed.updatedAt || '')) || Date.now();
          this.lastSyncTimestamp = loadedAt;
          this.persistToDisk(this.currentSnapshot);
          return this.currentSnapshot;"""
if old_d1 in t:
    t = t.replace(old_d1, new_d1)
    print("d1 ts")
elif "loadedAt" in t:
    print("d1 ts already")

old_r2 = """          this.currentSnapshot = {
            ...r2Snapshot,
            schemaVersion: r2Snapshot.schemaVersion || 1,
            source: 'cloudflare_r2',
            syncStatus: 'synced'
          };
          this.persistToDisk(this.currentSnapshot);
          return this.currentSnapshot;"""
new_r2 = """          this.currentSnapshot = {
            ...r2Snapshot,
            schemaVersion: r2Snapshot.schemaVersion || 1,
            source: 'cloudflare_r2',
            syncStatus: 'synced'
          };
          const loadedAt = Date.parse(String(r2Snapshot.updatedAt || '')) || Date.now();
          this.lastSyncTimestamp = loadedAt;
          this.persistToDisk(this.currentSnapshot);
          return this.currentSnapshot;"""
if old_r2 in t:
    t = t.replace(old_r2, new_r2)
    print("r2 ts")

old_serve = """  public async servePublicCatalogue(): Promise<SiteDataSnapshot | null> {
    return this.syncIfStale(false);
  }"""
new_serve = """  public async servePublicCatalogue(): Promise<SiteDataSnapshot | null> {
    if (!this.currentSnapshot) {
      await this.loadSnapshot();
    }
    if (!this.getLastKnownGood()) {
      // First boot / empty cache: wait once for D1 so public does not 503 on cold start.
      try {
        return await this.refreshSnapshot({ force: true });
      } catch (err: any) {
        console.warn('[SiteData] bootstrap refresh failed:', err?.message || err);
        return null;
      }
    }
    return this.syncIfStale(false);
  }"""
if old_serve in t:
    t = t.replace(old_serve, new_serve)
    print("bootstrap")
elif "bootstrap refresh failed" in t:
    print("bootstrap already")
else:
    print("WARN serve")

p.write_text(t)

p = Path("lib/restaurantMenu.ts")
t = p.read_text()
old_f = "return categories.filter((c) => c.items.length > 0 || categories.length === 1);"
new_f = "return categories.filter((c) => c.items.length > 0);"
if old_f in t:
    p.write_text(t.replace(old_f, new_f))
    print("empty cats")
else:
    print("cats ok")

print("DONE")
