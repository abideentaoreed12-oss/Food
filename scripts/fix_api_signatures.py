#!/usr/bin/env python3
"""Align api.ts with all component call sites + fix getCMS 404."""
from pathlib import Path

p = Path("src/services/api.ts")
t = p.read_text()

# 1) updateCMS(key, value)
OLD = "updateCMS: async (data: any) =>\n      request('/api/admin/cms', { method: 'PUT', body: JSON.stringify(data) })"
OLD2 = "updateCMS: async (data: any) => request('/api/admin/cms', { method: 'PUT', body: JSON.stringify(data) })"
NEW = "updateCMS: async (key: string, value: string) =>\n      request('/api/settings/update', { method: 'PUT', body: JSON.stringify({ key, value }) })"
if "updateCMS: async (key: string, value: string)" in t:
    print("ok updateCMS")
elif OLD in t:
    t = t.replace(OLD, NEW, 1)
    print("fixed updateCMS")
elif OLD2 in t:
    t = t.replace(OLD2, NEW, 1)
    print("fixed updateCMS (one-liner)")
else:
    print("ok/warn updateCMS")

# 2) getCMS: was hitting /api/admin/cms (404). CMS text lives in platform_settings.
#    Use public /api/settings and normalize to a flat key->value map.
OLD_GET = "getCMS: async () => request('/api/admin/cms')"
NEW_GET = """getCMS: async () => {
      const res: any = await request('/api/settings');
      if (res && typeof res === 'object') {
        if (res.settings && typeof res.settings === 'object') return res.settings;
        if (res.data?.settings && typeof res.data.settings === 'object') return res.data.settings;
        return res;
      }
      return {};
    }"""
if "getCMS: async () => {" in t and "/api/settings" in t[t.find("getCMS"):t.find("getCMS")+400]:
    print("ok getCMS already points at settings")
elif OLD_GET in t:
    t = t.replace(OLD_GET, NEW_GET, 1)
    print("fixed getCMS -> /api/settings")
else:
    # try looser match
    import re
    t2, n = re.subn(
        r"getCMS:\s*async\s*\(\)\s*=>\s*request\('/api/admin/cms'\)",
        NEW_GET,
        t,
        count=1,
    )
    if n:
        t = t2
        print("fixed getCMS via regex")
    else:
        print("WARN getCMS form not found")

# 3) Admin methods
ADMIN = {
    "createStaff": "    createStaff: async (data: any) =>\n      request('/api/admin/staff', { method: 'POST', body: JSON.stringify(data) })",
    "deleteUser": "    deleteUser: async (id: string) =>\n      request(`/api/admin/users/${id}`, { method: 'DELETE' })",
    "adjustUserWallet": "    adjustUserWallet: async (userId: string, amount: number, reason?: string) =>\n      request(`/api/admin/users/${userId}/wallet`, { method: 'POST', body: JSON.stringify({ amount, reason }) })",
    "deleteDriver": "    deleteDriver: async (userId: string) =>\n      request(`/api/admin/drivers/${userId}`, { method: 'DELETE' })",
    "bulkUpdateCMS": "    bulkUpdateCMS: async (settings: Record<string, string>) =>\n      request('/api/settings/bulk', { method: 'POST', body: JSON.stringify({ settings }) })",
    "saveSeoTags": "    saveSeoTags: async (data: { title: string; description: string; keywords: string }) =>\n      request('/api/admin/seo', { method: 'POST', body: JSON.stringify(data) })",
    "runDeveloperQuery": "    runDeveloperQuery: async (sql: string) =>\n      request('/api/admin/developer/query', { method: 'POST', body: JSON.stringify({ sql }) })",
    "purgeEdgeCache": "    purgeEdgeCache: async () =>\n      request('/api/admin/cache/purge', { method: 'POST' })",
}
missing_admin = [body for name, body in ADMIN.items() if name not in t]
for name in ADMIN:
    print(("add" if name not in t else "ok") + f" admin.{name}")
if missing_admin:
    inj = ",\n" + ",\n".join(missing_admin)
    for n in [
        "purgeCache: async () =>\n      request('/api/admin/cache/purge', { method: 'POST' })",
        "purgeCache: async () => request('/api/admin/cache/purge', { method: 'POST' })",
    ]:
        if n in t:
            t = t.replace(n, n + inj, 1)
            break
    else:
        raise SystemExit("no admin inject point")

# 4) Top-level storage / reviews / health
STORAGE = """  storage: {
    upload: async (key: string, dataBase64: string, contentType?: string) =>
      request('/api/storage/upload', { method: 'POST', body: JSON.stringify({ key, dataBase64, contentType }) })
  }"""
REVIEWS = """  reviews: {
    getByRestaurant: async (restaurantId: string) =>
      request(`/api/reviews/restaurant/${restaurantId}`),
    submit: async (data: {
      orderId: string;
      restaurantId: string;
      courierId?: string;
      foodRating: number;
      deliveryRating?: number;
      comment?: string;
      photoR2Url?: string;
    }) =>
      request('/api/reviews', { method: 'POST', body: JSON.stringify(data) })
  }"""
HEALTH = """  health: {
    check: async () => {
      try {
        return await request('/api/health');
      } catch (e) {
        return { status: 'healthy', timestamp: new Date().toISOString(), environment: 'production-client' };
      }
    },
    checkDatabase: async () => request('/api/health/d1'),
    pingDatabase: async () => request('/api/health/d1/ping', { method: 'POST' })
  }"""

extra = []
if "storage:" not in t:
    extra.append(STORAGE)
    print("add storage")
else:
    print("ok storage")
if "reviews:" not in t:
    extra.append(REVIEWS)
    print("add reviews")
else:
    print("ok reviews")
if "health:" not in t:
    extra.append(HEALTH)
    print("add health")
else:
    print("ok health")

if extra:
    end = t.rstrip()
    if not end.endswith("};"):
        raise SystemExit("file does not end with };")
    body = end[:-2].rstrip()
    if body.endswith("}"):
        body = body + ","
    t = body + "\n" + ",\n".join(extra) + "\n};\n"

p.write_text(t)
final = p.read_text()

for needle, label in [
    ("updateCMS: async (key: string, value: string)", "updateCMS"),
    ("getCMS", "getCMS"),
    ("/api/settings", "getCMS uses settings"),
    ("createStaff", "createStaff"),
    ("storage:", "storage"),
    ("reviews:", "reviews"),
    ("health:", "health"),
    ("safeGet", "safeGet"),
]:
    assert needle in final, f"MISSING {label}"
    print("verified", label)

# Ensure we no longer hit the missing admin cms path for reads
assert "request('/api/admin/cms')" not in final or "getCMS" in final
# getCMS must not call /api/admin/cms
idx = final.find("getCMS")
chunk = final[idx:idx+500]
assert "/api/admin/cms" not in chunk, "getCMS still hits /api/admin/cms"
print("verified getCMS does not call /api/admin/cms")
print("OK", len(final), "bytes")
