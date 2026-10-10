#!/usr/bin/env python3
from pathlib import Path
import subprocess
import sys

FILE = Path('app/api/[[...route]]/route.ts')

def main():
    size = FILE.stat().st_size if FILE.exists() else 0
    print(f'current size={size}')
    if size < 1000:
        print('Restoring from 46acaa9')
        data = subprocess.check_output(['git', 'show', '46acaa9:app/api/[[...route]]/route.ts'])
        FILE.write_bytes(data)
    text = FILE.read_text()
    if 'isEnvAdmin' in text and 'Teeplus1029' not in text:
        print('Already fixed')
        return 0
    old = """    const isMasterAdmin =
      (ADMIN_EMAIL && ADMIN_PASSWORD && email === ADMIN_EMAIL && password === ADMIN_PASSWORD) ||
      (email === 'admin@veyrang.com' && (password === 'Admin123!' || (ADMIN_PASSWORD && password === ADMIN_PASSWORD))) ||
      (email === 'abideentaoreed12@gmail.com' && (password === 'Teeplus1029' || password === 'Admin123!')) ||
      (email === 'abideentaoreed66@gmail.com' && (password === 'Admin123!' || password === 'Teeplus1029' || password === 'Password123!'));

    const d1Res = await d1.query('SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1', [email]);
    let u = d1Res.results?.[0];

    if (!u) {
      if (isMasterAdmin) {
        u = {
          id: 'usr-admin-1',
          email,
          role: 'admin',
          name: 'System Administrator',
          phone: '+234 801 234 5678',
          wallet_balance_ngn: 350000,
          wallet_balance_usd: 250,
          is_approved: 1
        };
      } else {
        return NextResponse.json({ success: false, error: 'Invalid email or password.' }, { status: 401 });
      }
    } else if (!isMasterAdmin) {
      if (!u?.password_hash) {
        return NextResponse.json({ success: false, error: 'Invalid email or password.' }, { status: 401 });
      }
      const ok = await bcrypt.compare(password, u.password_hash);
      if (!ok) {
        return NextResponse.json({ success: false, error: 'Invalid email or password.' }, { status: 401 });
      }
    }"""
    new = """    // Admin bootstrap only via env credentials — never hardcode passwords in source.
    const isEnvAdmin =
      Boolean(ADMIN_EMAIL) &&
      Boolean(ADMIN_PASSWORD) &&
      email === ADMIN_EMAIL &&
      password === ADMIN_PASSWORD;

    const d1Res = await d1.query('SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1', [email]);
    let u = d1Res.results?.[0];

    if (!u) {
      if (isEnvAdmin) {
        // Bootstrap admin shell from env only (no invented wallet balances).
        u = {
          id: 'usr-admin-1',
          email,
          role: 'admin',
          name: 'System Administrator',
          phone: '',
          wallet_balance_ngn: 0,
          wallet_balance_usd: 0,
          is_approved: 1
        };
      } else {
        return NextResponse.json({ success: false, error: 'Invalid email or password.' }, { status: 401 });
      }
    } else {
      // Always verify password against stored hash for existing users.
      if (!u?.password_hash) {
        return NextResponse.json({ success: false, error: 'Invalid email or password.' }, { status: 401 });
      }
      const ok = await bcrypt.compare(password, u.password_hash);
      if (!ok) {
        // Env admin may still authenticate if credentials match env (password reset / recovery).
        if (!(isEnvAdmin && email === ADMIN_EMAIL)) {
          return NextResponse.json({ success: false, error: 'Invalid email or password.' }, { status: 401 });
        }
      }
    }"""
    if old not in text:
        print('OLD block not found', file=sys.stderr)
        return 1
    FILE.write_text(text.replace(old, new, 1))
    out = FILE.read_text()
    assert 'Teeplus1029' not in out
    assert 'Admin123!' not in out
    assert 'isEnvAdmin' in out
    print('Fixed size', len(out))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
