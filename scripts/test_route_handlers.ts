import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/[[...route]]/route';

async function testRouteHandlers() {
  console.log('--- Testing Next.js Route Handler (/api/health) ---');
  const req1 = new NextRequest('http://localhost:3000/api/health');
  const res1 = await GET(req1);
  const json1 = await res1.json();
  console.log('/api/health status:', res1.status, json1);
  if (res1.status !== 200 || json1.status !== 'ok') {
    throw new Error('Health check failed');
  }

  console.log('\n--- Testing Next.js Route Handler (/api/health/d1) ---');
  const req2 = new NextRequest('http://localhost:3000/api/health/d1');
  const res2 = await GET(req2);
  const json2 = await res2.json();
  console.log('/api/health/d1 status:', res2.status, 'connected:', json2.connected, 'latency:', json2.latencyMs);
  if (res2.status !== 200 || !json2.connected) {
    throw new Error('D1 health check failed');
  }

  console.log('\n--- Testing Next.js Route Handler (/api/storage/status) ---');
  const req3 = new NextRequest('http://localhost:3000/api/storage/status');
  const res3 = await GET(req3);
  const json3 = await res3.json();
  console.log('/api/storage/status status:', res3.status, json3);
  if (res3.status !== 200 || !json3.success) {
    throw new Error('Storage status check failed');
  }

  console.log('\n--- Testing Next.js Route Handler (/api/restaurants) ---');
  const req4 = new NextRequest('http://localhost:3000/api/restaurants');
  const res4 = await GET(req4);
  const json4 = await res4.json();
  console.log('/api/restaurants status:', res4.status, 'restaurants count:', json4.data?.length);
  if (res4.status !== 200 || !Array.isArray(json4.data) || json4.data.length === 0) {
    throw new Error('Restaurants fetch failed');
  }

  console.log('\n--- Testing Next.js Route Handler (/api/settings) ---');
  const req5 = new NextRequest('http://localhost:3000/api/settings');
  const res5 = await GET(req5);
  const json5 = await res5.json();
  console.log('/api/settings status:', res5.status, 'has settings:', !!json5.data);
  if (res5.status !== 200 || !json5.success) {
    throw new Error('Settings fetch failed');
  }

  console.log('\n✅ ALL API ROUTE TESTS PASSED SUCCESSFULLY!');
}

testRouteHandlers().catch((err) => {
  console.error('Route handler test failed:', err);
  process.exit(1);
});
