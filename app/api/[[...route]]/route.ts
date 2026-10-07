import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return Response.json({
    ok: true,
    message: 'API is running',
    path: req.nextUrl.pathname
  });
}

export async function POST(req: NextRequest) {
  return Response.json({
    ok: true,
    message: 'POST request received'
  });
}

export async function PUT(req: NextRequest) {
  return Response.json({
    ok: true,
    message: 'PUT request received'
  });
}

export async function DELETE(req: NextRequest) {
  return Response.json({
    ok: true,
    message: 'DELETE request received'
  });
}

export async function PATCH(req: NextRequest) {
  return Response.json({
    ok: true,
    message: 'PATCH request received'
  });
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
