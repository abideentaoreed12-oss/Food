#!/usr/bin/env python3
"""Remove JWT secret fallback and Admin123! seed defaults. Idempotent."""
from pathlib import Path
import sys

def must_replace(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    if not p.exists():
        print(f'{label}: skip missing {path}')
        return
    text = p.read_text()
    if old not in text:
        if 'veyrang-jwt-secret' not in text and "|| 'Admin123!'" not in text:
            print(f'{label}: already clean')
            return
        print(f'{label}: OLD block missing', file=sys.stderr)
        raise SystemExit(1)
    p.write_text(text.replace(old, new, 1))
    print(f'{label}: patched')

def main() -> int:
    must_replace(
        'server/config.ts',
        "// All secrets and admin credentials come from environment with safe production defaults.\n"
        "const jwtSecret = process.env.JWT_SECRET || 'veyrang-jwt-secret-secure-key-2025';\n"
        "const adminEmail = (process.env.ADMIN_EMAIL || 'admin@veyrang.com').toLowerCase().trim();\n"
        "const adminPassword = (process.env.ADMIN_PASSWORD || 'Admin123!').trim();",
        "// Secrets and admin credentials come from environment only — no hardcoded defaults.\n"
        "const jwtSecret = (process.env.JWT_SECRET || '').trim();\n"
        "const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();\n"
        "const adminPassword = (process.env.ADMIN_PASSWORD || '').trim();",
        'config',
    )

    must_replace(
        'app/api/[[...route]]/route.ts',
        "const JWT_SECRET = process.env.JWT_SECRET || 'veyrang-jwt-secret-secure-key-2025';",
        "const JWT_SECRET = (process.env.JWT_SECRET || '').trim();",
        'route-jwt',
    )

    must_replace(
        'server/db/localStore.ts',
        "  const adminEmail = (CONFIG.ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@veyrang.com').toLowerCase().trim();\n"
        "  const adminPassword = CONFIG.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Admin123!';\n"
        "\n"
        "  const users: User[] = [\n"
        "    {\n"
        "      id: 'usr-admin-1',\n"
        "      email: adminEmail,\n"
        "      passwordHash: bcrypt.hashSync(adminPassword, salt),\n"
        "      name: 'System Administrator',\n"
        "      role: 'admin',\n"
        "      phone: '+234 801 234 5678',\n"
        "      walletBalanceUSD: 250.0,\n"
        "      walletBalanceNGN: 350000,\n"
        "      savedAddresses: [\n"
        "        {\n"
        "          id: 'addr-admin-1',\n"
        "          label: 'Work',\n"
        "          address: 'Admiralty Way, Lekki Phase 1',\n"
        "          city: 'Lagos',\n"
        "          isDefault: true\n"
        "        }\n"
        "      ],\n"
        "      createdAt: now,\n"
        "      updatedAt: now\n"
        "    }\n"
        "  ];",
        "  const adminEmail = (CONFIG.ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').toLowerCase().trim();\n"
        "  const adminPassword = (CONFIG.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '').trim();\n"
        "\n"
        "  // Seed admin only when both email and password are provided via environment — never invent credentials.\n"
        "  const users: User[] = [];\n"
        "  if (adminEmail && adminPassword) {\n"
        "    users.push({\n"
        "      id: 'usr-admin-1',\n"
        "      email: adminEmail,\n"
        "      passwordHash: bcrypt.hashSync(adminPassword, salt),\n"
        "      name: 'System Administrator',\n"
        "      role: 'admin',\n"
        "      phone: '',\n"
        "      walletBalanceUSD: 0,\n"
        "      walletBalanceNGN: 0,\n"
        "      savedAddresses: [],\n"
        "      createdAt: now,\n"
        "      updatedAt: now\n"
        "    });\n"
        "  }",
        'localStore-seed',
    )

    must_replace(
        'lib/d1.ts',
        "      if (!hasAdmin) {\n"
        "        const adminEmail = (CONFIG.ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@veyrang.com').toLowerCase().trim();\n"
        "        const adminPass = CONFIG.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Admin123!';\n"
        "        const passHash = bcrypt.hashSync(adminPass, 10);\n"
        "        this.executeLocal(\n"
        "          `INSERT OR IGNORE INTO users (id, email, password_hash, name, role, phone, address, wallet_balance_usd, wallet_balance_ngn, saved_addresses, is_approved, created_at, updated_at)\n"
        "           VALUES ('usr-admin-1', ?, ?, 'System Administrator', 'admin', '+234 801 234 5678', 'Lekki Phase 1, Lagos', 0, 0, '[]', 1, ?, ?)`,\n"
        "          [adminEmail, passHash, now, now]\n"
        "        );\n"
        "      }",
        "      if (!hasAdmin) {\n"
        "        const adminEmail = (CONFIG.ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').toLowerCase().trim();\n"
        "        const adminPass = (CONFIG.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '').trim();\n"
        "        // Seed admin only when env credentials are present — never invent Admin123! or similar.\n"
        "        if (adminEmail && adminPass) {\n"
        "          const passHash = bcrypt.hashSync(adminPass, 10);\n"
        "          this.executeLocal(\n"
        "            `INSERT OR IGNORE INTO users (id, email, password_hash, name, role, phone, address, wallet_balance_usd, wallet_balance_ngn, saved_addresses, is_approved, created_at, updated_at)\n"
        "             VALUES ('usr-admin-1', ?, ?, 'System Administrator', 'admin', '', '', 0, 0, '[]', 1, ?, ?)`,\n"
        "            [adminEmail, passHash, now, now]\n"
        "          );\n"
        "        }\n"
        "      }",
        'd1-seed',
    )

    must_replace(
        'server/db/index.ts',
        "  const adminEmail = CONFIG.ADMIN_EMAIL;\n"
        "  const adminPassword = CONFIG.ADMIN_PASSWORD;\n"
        "\n"
        "  const users: User[] = [\n"
        "    {\n"
        "      id: 'usr-admin-1',\n"
        "      email: adminEmail,\n"
        "      passwordHash: bcrypt.hashSync(adminPassword, salt),\n"
        "      name: 'System Administrator',\n"
        "      role: 'admin',\n"
        "      phone: '+1 (555) 900-0001',\n"
        "      walletBalanceUSD: 0,\n"
        "      walletBalanceNGN: 0,\n"
        "      savedAddresses: [],\n"
        "      createdAt: now,\n"
        "      updatedAt: now\n"
        "    }\n"
        "  ];",
        "  const adminEmail = (CONFIG.ADMIN_EMAIL || '').toLowerCase().trim();\n"
        "  const adminPassword = (CONFIG.ADMIN_PASSWORD || '').trim();\n"
        "\n"
        "  // Seed admin only when env credentials are present — never invent passwords.\n"
        "  const users: User[] = [];\n"
        "  if (adminEmail && adminPassword) {\n"
        "    users.push({\n"
        "      id: 'usr-admin-1',\n"
        "      email: adminEmail,\n"
        "      passwordHash: bcrypt.hashSync(adminPassword, salt),\n"
        "      name: 'System Administrator',\n"
        "      role: 'admin',\n"
        "      phone: '',\n"
        "      walletBalanceUSD: 0,\n"
        "      walletBalanceNGN: 0,\n"
        "      savedAddresses: [],\n"
        "      createdAt: now,\n"
        "      updatedAt: now\n"
        "    });\n"
        "  }",
        'index-seed',
    )

    must_replace(
        'server/db/index.ts',
        "    const salt = bcrypt.genSaltSync(10);\n"
        "    const adminEmail = CONFIG.ADMIN_EMAIL;\n"
        "    const adminPassword = CONFIG.ADMIN_PASSWORD;\n"
        "    const adminUser = dbCache.users.find((u) => u.role === 'admin' || u.id === 'usr-admin-1');\n"
        "    if (adminUser) {\n"
        "      adminUser.email = adminEmail;\n"
        "      adminUser.passwordHash = bcrypt.hashSync(adminPassword, salt);\n"
        '      console.log("Database hot-sync loaded. Active Admin email is set to: " + adminEmail);\n'
        "    }",
        "    const adminEmail = (CONFIG.ADMIN_EMAIL || '').toLowerCase().trim();\n"
        "    const adminPassword = (CONFIG.ADMIN_PASSWORD || '').trim();\n"
        "    const adminUser = dbCache.users.find((u) => u.role === 'admin' || u.id === 'usr-admin-1');\n"
        "    // Only update admin credentials when both env values are set — never overwrite with empty/default secrets.\n"
        "    if (adminUser && adminEmail && adminPassword) {\n"
        "      const salt = bcrypt.genSaltSync(10);\n"
        "      adminUser.email = adminEmail;\n"
        "      adminUser.passwordHash = bcrypt.hashSync(adminPassword, salt);\n"
        '      console.log("Database hot-sync loaded. Active Admin email is set to: " + adminEmail);\n'
        "    }",
        'index-hot-sync',
    )

    must_replace(
        'server/db/index.ts',
        "        // Dynamic Admin Environment synchronization on every DB boot\n"
        "        const adminEmail = CONFIG.ADMIN_EMAIL;\n"
        "        const adminPassword = CONFIG.ADMIN_PASSWORD;\n"
        "        const adminUser = dbCache!.users.find((u) => u.role === 'admin' || u.id === 'usr-admin-1');\n"
        "        if (adminUser) {\n"
        "          adminUser.email = adminEmail;\n"
        "          adminUser.passwordHash = bcrypt.hashSync(adminPassword, salt);\n"
        '          console.log("Database cold-boot loaded. Active Admin email is set to: " + adminEmail);\n'
        "        }",
        "        // Dynamic Admin Environment synchronization on every DB boot (env only — no default passwords)\n"
        "        const adminEmail = (CONFIG.ADMIN_EMAIL || '').toLowerCase().trim();\n"
        "        const adminPassword = (CONFIG.ADMIN_PASSWORD || '').trim();\n"
        "        const adminUser = dbCache!.users.find((u) => u.role === 'admin' || u.id === 'usr-admin-1');\n"
        "        if (adminUser && adminEmail && adminPassword) {\n"
        "          adminUser.email = adminEmail;\n"
        "          adminUser.passwordHash = bcrypt.hashSync(adminPassword, salt);\n"
        '          console.log("Database cold-boot loaded. Active Admin email is set to: " + adminEmail);\n'
        "        }",
        'index-cold-boot',
    )

    for sp in ['scripts/live-audit.ts', 'scripts/live-audit.js']:
        p = Path(sp)
        if not p.exists():
            continue
        text = p.read_text()
        old = "const JWT_SECRET = process.env.JWT_SECRET || 'veyrang-jwt-secret-key-production-2026';"
        if old in text:
            p.write_text(text.replace(
                old,
                "const JWT_SECRET = (process.env.JWT_SECRET || '').trim();\n"
                "if (!JWT_SECRET) {\n"
                "  console.error('JWT_SECRET is required');\n"
                "  process.exit(1);\n"
                "}",
                1,
            ))
            print(f'{sp}: patched')
        else:
            print(f'{sp}: already clean or different')

    bad = False
    for path in Path('.').rglob('*'):
        if path.suffix not in {'.ts', '.tsx', '.js'} or 'node_modules' in str(path):
            continue
        try:
            t = path.read_text()
        except Exception:
            continue
        if "|| 'Admin123!'" in t or 'veyrang-jwt-secret' in t:
            print('STILL BAD', path)
            bad = True
    if bad:
        return 2
    print('ALL CLEAN')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
