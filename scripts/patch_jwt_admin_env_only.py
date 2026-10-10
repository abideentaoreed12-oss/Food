#!/usr/bin/env python3
"""One-shot: remove JWT secret fallback and Admin123! seed defaults."""
from pathlib import Path
import sys

def must_replace(path: str, old: str, new: str, label: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        # Idempotent if already fixed
        if 'veyrang-jwt-secret' not in text and "|| 'Admin123!'" not in text:
            print(f'{label}: already clean')
            return
        print(f'{label}: OLD block missing', file=sys.stderr)
        raise SystemExit(1)
    p.write_text(text.replace(old, new, 1))
    print(f'{label}: patched')

def main():
    # 1. config
    must_replace(
        'server/config.ts',
        """// All secrets and admin credentials come from environment with safe production defaults.
const jwtSecret = process.env.JWT_SECRET || 'veyrang-jwt-secret-secure-key-2025';
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@veyrang.com').toLowerCase().trim();
const adminPassword = (process.env.ADMIN_PASSWORD || 'Admin123!').trim();""",
        """// Secrets and admin credentials come from environment only — no hardcoded defaults.
const jwtSecret = (process.env.JWT_SECRET || '').trim();
const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const adminPassword = (process.env.ADMIN_PASSWORD || '').trim();""",
        'config',
    )

    # 2. route JWT
    must_replace(
        'app/api/[[...route]]/route.ts',
        "const JWT_SECRET = process.env.JWT_SECRET || 'veyrang-jwt-secret-secure-key-2025';",
        "const JWT_SECRET = (process.env.JWT_SECRET || '').trim();",
        'route-jwt',
    )

    # 3. localStore seed
    must_replace(
        'server/db/localStore.ts',
        """  const adminEmail = (CONFIG.ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@veyrang.com').toLowerCase().trim();
  const adminPassword = CONFIG.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Admin123!';

  const users: User[] = [
    {
      id: 'usr-admin-1',
      email: adminEmail,
      passwordHash: bcrypt.hashSync(adminPassword, salt),
      name: 'System Administrator',
      role: 'admin',
      phone: '+234 801 234 5678',
      walletBalanceUSD: 250.0,
      walletBalanceNGN: 350000,
      savedAddresses: [
        {
          id: 'addr-admin-1',
          label: 'Work',
          address: 'Admiralty Way, Lekki Phase 1',
          city: 'Lagos',
          isDefault: true
        }
      ],
      createdAt: now,
      updatedAt: now
    }
  ];""",
        """  const adminEmail = (CONFIG.ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const adminPassword = (CONFIG.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '').trim();

  // Seed admin only when both email and password are provided via environment — never invent credentials.
  const users: User[] = [];
  if (adminEmail and adminPassword):
    users.append({
      'id': 'usr-admin-1',
    })
""",
        'localStore-seed',
    )

if __name__ == '__main__':
    main()
