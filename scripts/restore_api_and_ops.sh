#!/usr/bin/env bash
set -euo pipefail
curl -fsSL "https://raw.githubusercontent.com/abideentaoreed12-oss/Food/c73179e/src/services/api.ts" -o src/services/api.ts
python3 - <<'PY'
from pathlib import Path
p = Path('src/services/api.ts')
t = p.read_text()
assert len(t) > 1000, 'api.ts restore failed'
if 'assignCourier' not in t:
    old = """    updateOrderStatus: async (orderId: string, status: OrderStatus, note?: string) =>
      request(`/api/admin/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),
    refundOrder:"""
    new = """    updateOrderStatus: async (orderId: string, status: OrderStatus, note?: string) =>
      request(`/api/admin/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),
    assignCourier: async (orderId: string, courierId: string) =>
      request(`/api/admin/orders/${encodeURIComponent(orderId)}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ courierId }),
      }),
    refundOrder:"""
    if old not in t:
        raise SystemExit('assignCourier pattern missing')
    p.write_text(t.replace(old, new))
print('api.ts bytes', p.stat().st_size)
PY
python3 scripts/apply_restaurant_ops.py || true
echo OK
