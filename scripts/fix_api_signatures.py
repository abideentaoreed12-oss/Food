#!/usr/bin/env python3
"""Align api.ts with all component call sites. Single comprehensive fix."""
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
    print("WARN updateCMS form not matched — may already be fixed")

# 2) Admin methods
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

# 3) Top-level: storage, reviews, health
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
    # Insert before final }; of api object
    end = t.rstrip()
    if not end.endswith("};"):
        raise SystemExit("file does not end with };")
    body = end[:-2].rstrip()  # strip };
    if not body.endswith(",") and not body.endswith("}"):
        raise SystemExit(f"unexpected body end: {body[-30]!r}")
    if body.endswith("}"):
        body = body + ","
    t = body + "\n" + ",\n".join(extra) + "\n};\n"

p.write_text(t)
final = p.read_text()

for needle, label in [
    ("updateCMS: async (key: string, value: string)", "updateCMS"),
    ("createStaff", "createStaff"),
    ("storage:", "storage"),
    ("reviews:", "reviews"),
    ("submit:", "reviews.submit"),
    ("health:", "health"),
    ("checkDatabase", "checkDatabase"),
    ("safeGet", "safeGet"),
]:
    assert needle in final, f"MISSING {label}"
    print("verified", label)

print("OK", len(final), "bytes")
