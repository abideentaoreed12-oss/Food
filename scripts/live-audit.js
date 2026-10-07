import http from 'http';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'veyrang-jwt-secret-key-production-2026';

const adminToken = jwt.sign(
  {
    id: 'usr-admin-1',
    email: process.env.ADMIN_EMAIL || 'admin@veyrang.com',
    role: 'admin',
    name: 'Platform Super Admin',
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const routesToAudit = [
  // Health & System Platform
  { method: 'GET', path: '/api' },
  { method: 'GET', path: '/api/health' },
  { method: 'GET', path: '/api/d1/status' },
  { method: 'GET', path: '/api/storage/status' },

  // Settings & Financial Configuration
  { method: 'GET', path: '/api/settings' },
  { method: 'GET', path: '/api/settings/zones' },
  { method: 'GET', path: '/api/settings/promos' },

  // Restaurants & Dynamic Distance Engine
  { method: 'GET', path: '/api/restaurants' },
  { method: 'GET', path: '/api/restaurants/rest-1' },
  { method: 'POST', path: '/api/restaurants/calculate-distance', body: { restaurantId: 'rest-1', userAddress: '14 Admiralty Way, Lekki Phase 1, Lagos' } },

  // Auth & Session
  { method: 'GET', path: '/api/auth/debug-admin' },
  { method: 'GET', path: '/api/auth/me', needsAuth: true },
  { method: 'GET', path: '/api/auth/addresses', needsAuth: true },

  // Reviews
  { method: 'GET', path: '/api/reviews/restaurant/rest-1' },

  // Admin Management Endpoints
  { method: 'GET', path: '/api/admin/overview', needsAuth: true },
  { method: 'GET', path: '/api/admin/menu', needsAuth: true },
  { method: 'GET', path: '/api/admin/categories', needsAuth: true },
  { method: 'GET', path: '/api/admin/addons', needsAuth: true },
  { method: 'GET', path: '/api/admin/orders', needsAuth: true },
  { method: 'GET', path: '/api/admin/users', needsAuth: true },
  { method: 'GET', path: '/api/admin/restaurants', needsAuth: true },
  { method: 'GET', path: '/api/admin/drivers', needsAuth: true },
  { method: 'GET', path: '/api/admin/delivery-zones', needsAuth: true },
  { method: 'GET', path: '/api/admin/promos', needsAuth: true },
  { method: 'GET', path: '/api/admin/reviews', needsAuth: true },
  { method: 'GET', path: '/api/admin/support', needsAuth: true },
  { method: 'GET', path: '/api/admin/transactions', needsAuth: true },
  { method: 'GET', path: '/api/admin/audit-logs', needsAuth: true },

  // Orders
  { method: 'GET', path: '/api/orders/my-orders', needsAuth: true },
];

function makeRequest(test) {
  return new Promise((resolve) => {
    const postData = test.body ? JSON.stringify(test.body) : null;
    const headers = {};

    if (postData) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(postData));
    }

    if (test.needsAuth) {
      headers['Authorization'] = `Bearer ${adminToken}`;
      headers['Cookie'] = `veyrang_token=${adminToken}`;
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: test.path,
        method: test.method,
        headers
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode || 500, bodyText: body.substring(0, 150) });
        });
      }
    );

    req.on('error', (err) => resolve({ status: 500, bodyText: err.message }));
    if (postData) req.write(postData);
    req.end();
  });
}

async function runAudit() {
  console.log('==================================================================================================');
  console.log('                   VEYRANG FULL-STACK EXHAUSTIVE LIVE ROUTE AUDIT REPORT                          ');
  console.log('==================================================================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  for (const route of routesToAudit) {
    const res = await makeRequest(route);
    const isSuccess = res.status >= 200 && res.status < 400;
    if (isSuccess) passedCount++;
    else failedCount++;

    const statusStr = isSuccess ? `✅ PASS (${res.status})` : `❌ FAIL (${res.status})`;
    const cleanBody = res.bodyText.replace(/[\r\n]+/g, ' ').trim();
    console.log(`[${route.method.padEnd(6)}] ${route.path.padEnd(36)} -> ${statusStr.padEnd(14)} | ${cleanBody}`);
  }

  console.log('\n==================================================================================================');
  console.log(`TOTAL ENDPOINTS AUDITED: ${routesToAudit.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log('==================================================================================================');
}

runAudit();
