#!/usr/bin/env python3
"""Restore JWT_SECRET, ADMIN_* env constants and verifyToken — required for build."""
from pathlib import Path

p = Path("app/api/[[...route]]/route.ts")
t = p.read_text()
if "function verifyToken" in t and "const JWT_SECRET" in t:
    print("already fixed")
    raise SystemExit(0)

marker = "\n\nasync function getUser(req: NextRequest) {"
insert = """

const JWT_SECRET = (process.env.JWT_SECRET || '').trim();
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();

function verifyToken(req: NextRequest): any | null {
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

async function getUser(req: NextRequest) {"""

if marker not in t:
    marker2 = "\nasync function getUser(req: NextRequest) {"
    if marker2 in t and "function verifyToken" not in t:
        t = t.replace(marker2, insert.lstrip("\n"), 1)
        p.write_text(t)
        print("fixed via alt marker")
    else:
        print("WARN no marker")
        raise SystemExit(1)
else:
    t = t.replace(marker, insert, 1)
    p.write_text(t)
    print("fixed")

assert "function verifyToken" in p.read_text()
assert "const JWT_SECRET" in p.read_text()
print("OK")
