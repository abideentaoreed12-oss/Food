#!/usr/bin/env python3
"""Inject missing api.admin.* methods required by AdminPortal."""
from pathlib import Path

p = Path("src/services/api.ts")
t = p.read_text()

METHODS = {
    "createStaff": """    createStaff: async (data: any) =>
      request('/api/admin/staff', { method: 'POST', body: JSON.stringify(data) })""",
    "deleteUser": """    deleteUser: async (id: string) =>
      request(`/api/admin/users/${id}`, { method: 'DELETE' })""",
    "adjustUserWallet": """    adjustUserWallet: async (userId: string, amount: number, reason?: string) =>
      request(`/api/admin/users/${userId}/wallet`, { method: 'POST', body: JSON.stringify({ amount, reason }) })""",
    "deleteDriver": """    deleteDriver: async (userId: string) =>
      request(`/api/admin/drivers/${userId}`, { method: 'DELETE' })""",
    "uploadAsset": """    uploadAsset: async (key: string, dataBase64: string, contentType?: string) =>
      request('/api/storage/upload', { method: 'POST', body: JSON.stringify({ key, dataBase64, contentType }) })""",
    "deleteAsset": """    deleteAsset: async (key: string) =>
      request(`/api/storage/file/${encodeURIComponent(key)}`, { method: 'DELETE' })""",
    "bulkUpdateCMS": """    bulkUpdateCMS: async (settings: Record<string, string>) =>
      request('/api/settings/bulk', { method: 'POST', body: JSON.stringify({ settings }) })""",
    "saveSeoTags": """    saveSeoTags: async (data: { title: string; description: string; keywords: string }) =>
      request('/api/admin/seo', { method: 'POST', body: JSON.stringify(data) })""",
    "runDeveloperQuery": """    runDeveloperQuery: async (sql: string) =>
      request('/api/admin/developer/query', { method: 'POST', body: JSON.stringify({ sql }) })""",
    "purgeEdgeCache": """    purgeEdgeCache: async () =>
      request('/api/admin/cache/purge', { method: 'POST' })""",
}

to_add = []
for name, body in METHODS.items():
    if name in t:
        print(f"skip {name}")
    else:
        print(f"add {name}")
        to_add.append(body)

if not to_add:
    print("nothing to add")
else:
    injection = ",\n" + ",\n".join(to_add)
    # Prefer insert after purgeCache
    needles = [
        "purgeCache: async () =>\n      request('/api/admin/cache/purge', { method: 'POST' })",
        "purgeCache: async () => request('/api/admin/cache/purge', { method: 'POST' })",
    ]
    done = False
    for needle in needles:
        if needle in t:
            t = t.replace(needle, needle + injection, 1)
            done = True
            print(f"injected after purgeCache ({len(needle)} char form)")
            break
    if not done:
        # Fallback: before admin block closing that precedes settings/health/geocode
        for closer in ["\n  },\n\n  settings:", "\n  },\n\n  health:", "\n  },\n\n  geocode:", "\n  },\n\n  payment:"]:
            if closer in t:
                # Find the admin section's closing - the last occurrence before settings that is inside admin
                # Safer: insert before the first of these that appears after 'admin:'
                admin_idx = t.find("  admin: {")
                pos = t.find(closer, admin_idx)
                if pos > 0:
                    t = t[:pos] + injection + t[pos:]
                    done = True
                    print(f"injected before {closer.strip()!r}")
                    break
    if not done:
        raise SystemExit("Could not find injection point")
    p.write_text(t)
    print(f"wrote {len(t)} bytes")

final = p.read_text()
assert "createStaff" in final, "createStaff missing"
assert "safeGet" in final, "safeGet missing"
print("verified OK")
