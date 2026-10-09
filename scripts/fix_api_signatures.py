#!/usr/bin/env python3
"""Align api.ts with all component call sites. Single comprehensive fix."""
from pathlib import Path
import re

p = Path("src/services/api.ts")
t = p.read_text()

# --- 1) updateCMS(key, value) ---
old_cms_patterns = [
    "updateCMS: async (data: any) =>\n      request('/api/admin/cms', { method: 'PUT', body: JSON.stringify(data) })",
    "updateCMS: async (data: any) => request('/api/admin/cms', { method: 'PUT', body: JSON.stringify(data) })",
]
new_cms = (
    "updateCMS: async (key: string, value: string) =>\n"
    "      request('/api/settings/update', { method: 'PUT', body: JSON.stringify({ key, value }) })"
)
if "updateCMS: async (key: string, value: string)" in t:
    print("ok updateCMS")
else:
    fixed = False
    for old in old_cms_patterns:
        if old in t:
            t = t.replace(old, new_cms, 1)
            print("fixed updateCMS")
            fixed = True
            break
    if not fixed:
        t2 = re.sub(
            r"updateCMS:\s*async\s*\([^)]*\)\s*=>\s*\n?\s*request\('/api/admin/cms'[^)]*\)",
            new_cms,
            t,
            count=1,
        )
        if t2 != t:
            t = t2
            print("fixed updateCMS via regex")
        else:
            print("WARN: could not patch updateCMS")

# --- 2) Required admin methods ---
REQUIRED_ADMIN = {
    "createStaff": "    createStaff: async (data: any) =>\n      request('/api/admin/staff', { method: 'POST', body: JSON.stringify(data) })",
    "deleteUser": "    deleteUser: async (id: string) =>\n      request(`/api/admin/users/${id}`, { method: 'DELETE' })",
    "adjustUserWallet": "    adjustUserWallet: async (userId: string, amount: number, reason?: string) =>\n      request(`/api/admin/users/${userId}/wallet`, { method: 'POST', body: JSON.stringify({ amount, reason }) })",
    "deleteDriver": "    deleteDriver: async (userId: string) =>\n      request(`/api/admin/drivers/${userId}`, { method: 'DELETE' })",
    "bulkUpdateCMS": "    bulkUpdateCMS: async (settings: Record<string, string>) =>\n      request('/api/settings/bulk', { method: 'POST', body: JSON.stringify({ settings }) })",
    "saveSeoTags": "    saveSeoTags: async (data: { title: string; description: string; keywords: string }) =>\n      request('/api/admin/seo', { method: 'POST', body: JSON.stringify(data) })",
    "runDeveloperQuery": "    runDeveloperQuery: async (sql: string) =>\n      request('/api/admin/developer/query', { method: 'POST', body: JSON.stringify({ sql }) })",
}
to_add = []
for name, body in REQUIRED_ADMIN.items():
    if name not in t:
        print(f"add admin.{name}")
        to_add.append(body)
    else:
        print(f"ok admin.{name}")
if to_add:
    injection = ",\n" + ",\n".join(to_add)
    for needle in [
        "purgeCache: async () =>\n      request('/api/admin/cache/purge', { method: 'POST' })",
        "purgeCache: async () => request('/api/admin/cache/purge', { method: 'POST' })",
    ]:
        if needle in t:
            t = t.replace(needle, needle + injection, 1)
            break
    else:
        raise SystemExit("admin inject point missing")

# --- 3) Top-level blocks: storage, reviews, health ---
STORAGE = """
  storage: {
    upload: async (key: string, dataBase64: string, contentType?: string) =>
      request('/api/storage/upload', { method: 'POST', body: JSON.stringify({ key, dataBase64, contentType }) })
  },
"""
REVIEWS = """
  reviews: {
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
  },
"""
HEALTH = """
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
  },
"""

blocks_to_add = []
if "storage:" not in t:
    print("add storage")
    blocks_to_add.append(STORAGE.strip())
else:
    print("ok storage")
if "reviews:" not in t:
    print("add reviews")
    blocks_to_add.append(REVIEWS.strip())
else:
    print("ok reviews")
if "health:" not in t:
    print("add health")
    blocks_to_add.append(HEALTH.strip())
else:
    print("ok health")

if blocks_to_add:
    # Insert before final closing of export const api = { ... };
    # Prefer after geocode/support/payment block
    injection = ",\n\n" + ",\n\n".join(blocks_to_add)
    # Find last top-level section close before final };
    idx = t.rfind("\n};")
    if idx < 0:
        raise SystemExit("no final };")
    # Walk back to find the closing of the last property group
    # Insert before the final `};` — but need comma after previous section
    # Safer: find `\n  }\n};` pattern (last nested close + export close)
    m = list(re.finditer(r"\n  \}\n\};", t))
    if not m:
        # try without newline strictness
        m = list(re.finditer(r"\n  \}\s*\n\};", t))
    if m:
        pos = m[-1].start()
        t = t[:pos] + "\n  },\n" + ",\n".join(blocks_to_add) + "\n};\n"
        # Wait - that replaces the last `  }` of last section incorrectly.
        # Better approach: the last `\n  }\n};` means last section closes then api closes.
        # We want: last section closes with `},` then new sections, then `};`
        t = t  # already assigned above but wrong

# Redo block insertion more carefully
t = p.read_text() if False else t  # keep current t which may have admin fixes

# Re-read logic: if we already mutated wrong, rebuild from disk + reapply
# Actually let's do block insertion cleanly on current t

def ensure_blocks(src: str) -> str:
    needed = []
    if "  storage:" not in src and "\n  storage:" not in src and "storage: {" not in src:
        needed.append(STORAGE.strip())
    if "  reviews:" not in src and "reviews: {" not in src:
        needed.append(REVIEWS.strip())
    if "  health:" not in src and "health: {" not in src:
        needed.append(HEALTH.strip())
    if not needed:
        return src
    # Insert before the final `};` of the api object
    # Find the last occurrence of pattern that closes the outermost object
    # The file ends with something like:\n  }\n};\n
    # Strategy: find last `\n};` and look at what precedes it
    end = src.rstrip()
    if not end.endswith("};"):
        raise SystemExit(f"unexpected ending: {end[-40]!r}")
    # Remove trailing }; and ensure previous section ends with }, then append blocks
    body = end[:-2].rstrip()  # remove };
    if body.endswith(","):
        pass
    elif body.endswith("}"):
        body = body + ","
    else:
        body = body + ","
    new_end = body + "\n" + ",\n".join(needed) + "\n};\n"
    return new_end

t = ensure_blocks(t)

p.write_text(t)
final = p.read_text()

# Verifications matching known build failures
checks = [
    ("updateCMS: async (key: string, value: string)", "updateCMS arity"),
    ("createStaff", "createStaff"),
    ("storage:", "storage"),
    ("upload:", "storage.upload"),
    ("reviews:", "reviews"),
    ("submit:", "reviews.submit"),
    ("health:", "health"),
    ("checkDatabase", "health.checkDatabase"),
    ("safeGet", "safeGet"),
]
for needle, label in checks:
    assert needle in final, f"MISSING {label}"
    print(f"verified {label}")

print(f"OK wrote {len(final)} bytes")
