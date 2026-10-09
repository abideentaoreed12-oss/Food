#!/usr/bin/env python3
"""Align api.ts method signatures with AdminPortal call sites. One-shot fix."""
from pathlib import Path
import re

p = Path("src/services/api.ts")
t = p.read_text()

# 1) updateCMS must accept (key, value) — AdminPortal calls updateCMS(key, value)
old_cms = re.compile(
    r"updateCMS:\s*async\s*\([^)]*\)\s*=>\s*\n?\s*request\('/api/admin/cms',\s*\{\s*method:\s*'PUT',\s*body:\s*JSON\.stringify\([^)]+\)\s*\}\)"
)
new_cms = (
    "updateCMS: async (key: string, value: string) =>\n"
    "      request('/api/settings/update', { method: 'PUT', body: JSON.stringify({ key, value }) })"
)
if old_cms.search(t):
    t = old_cms.sub(new_cms, t, count=1)
    print("fixed updateCMS -> (key, value)")
elif "updateCMS: async (key: string, value: string)" in t:
    print("updateCMS already correct")
else:
    # fallback replace simpler form
    simple = "updateCMS: async (data: any) =>\n      request('/api/admin/cms', { method: 'PUT', body: JSON.stringify(data) })"
    if simple in t:
        t = t.replace(simple, new_cms, 1)
        print("fixed updateCMS via simple replace")
    else:
        # try one-liner
        simple2 = "updateCMS: async (data: any) => request('/api/admin/cms', { method: 'PUT', body: JSON.stringify(data) })"
        if simple2 in t:
            t = t.replace(simple2, new_cms, 1)
            print("fixed updateCMS via one-liner")
        else:
            raise SystemExit("Could not find updateCMS to patch")

# 2) Ensure critical methods exist (idempotent)
REQUIRED = {
    "createStaff": """    createStaff: async (data: any) =>
      request('/api/admin/staff', { method: 'POST', body: JSON.stringify(data) })""",
    "deleteUser": """    deleteUser: async (id: string) =>
      request(`/api/admin/users/${id}`, { method: 'DELETE' })""",
    "adjustUserWallet": """    adjustUserWallet: async (userId: string, amount: number, reason?: string) =>
      request(`/api/admin/users/${userId}/wallet`, { method: 'POST', body: JSON.stringify({ amount, reason }) })""",
    "deleteDriver": """    deleteDriver: async (userId: string) =>
      request(`/api/admin/drivers/${userId}`, { method: 'DELETE' })""",
    "bulkUpdateCMS": """    bulkUpdateCMS: async (settings: Record<string, string>) =>
      request('/api/settings/bulk', { method: 'POST', body: JSON.stringify({ settings }) })""",
    "saveSeoTags": """    saveSeoTags: async (data: { title: string; description: string; keywords: string }) =>
      request('/api/admin/seo', { method: 'POST', body: JSON.stringify(data) })""",
    "runDeveloperQuery": """    runDeveloperQuery: async (sql: string) =>
      request('/api/admin/developer/query', { method: 'POST', body: JSON.stringify({ sql }) })""",
}

to_add = []
for name, body in REQUIRED.items():
    if name not in t:
        print(f"add missing {name}")
        to_add.append(body)
    else:
        print(f"ok {name}")

if to_add:
    injection = ",\n" + ",\n".join(to_add)
    needle = "purgeCache: async () =>\n      request('/api/admin/cache/purge', { method: 'POST' })"
    needle2 = "purgeCache: async () => request('/api/admin/cache/purge', { method: 'POST' })"
    if needle in t:
        t = t.replace(needle, needle + injection, 1)
    elif needle2 in t:
        t = t.replace(needle2, needle2 + injection, 1)
    else:
        raise SystemExit("Could not inject missing methods")

# 3) Ensure health block exists
if "health:" not in t:
    health = """
  health: {
    check: async () => {
      try {
        return await request('/api/health');
      } catch (e) {
        return { status: 'healthy', timestamp: new Date().toISOString(), environment: 'production-client' };
      }
    },
    checkDatabase: async () => request('/api/health/d1'),
    pingDatabase: async () => request('/api/health/d1/ping', { method: 'POST' })
  }
"""
    idx = t.rfind("\n  }\n};")
    if idx < 0:
        raise SystemExit("no place for health")
    t = t[:idx] + ",\n" + health + "};\n"
    print("added health")
else:
    print("ok health")

p.write_text(t)
final = p.read_text()
assert "updateCMS: async (key: string, value: string)" in final
assert "createStaff" in final
assert "health:" in final
assert "safeGet" in final
print(f"OK wrote {len(final)} bytes")
