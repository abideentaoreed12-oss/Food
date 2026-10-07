import { NextRequest } from 'next/server';
import { createServerApp } from '../../../server/app.ts';
import { Readable } from 'node:stream';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const expressApp = createServerApp();

async function handle(req: NextRequest): Promise<Response> {
  return new Promise(async (resolve, reject) => {
    try {
      const url = new URL(req.url);
      const socket = new Socket();
      
      const bodyBuffer = req.body ? Buffer.from(await req.arrayBuffer()) : null;
      
      const stream = new Readable({
        read() {
          if (bodyBuffer) {
            this.push(bodyBuffer);
          }
          this.push(null);
        }
      });

      const incoming = Object.assign(stream, {
        url: url.pathname + url.search,
        method: req.method,
        headers: Object.fromEntries(req.headers.entries()),
        socket,
        connection: socket,
        httpVersion: '1.1',
        httpVersionMajor: 1,
        httpVersionMinor: 1,
      }) as unknown as IncomingMessage;

      const resHeaders = new Headers();
      const chunks: Buffer[] = [];
      let statusCode = 200;

      const outgoing = new ServerResponse(incoming);

      outgoing.writeHead = function (code: number, ...args: any[]) {
        statusCode = code;
        const headers = typeof args[0] === 'object' ? args[0] : args[1];
        if (headers) {
          for (const [key, val] of Object.entries(headers)) {
            if (Array.isArray(val)) {
              val.forEach(v => resHeaders.append(key, String(v)));
            } else if (val !== undefined) {
              resHeaders.set(key, String(val));
            }
          }
        }
        return outgoing;
      };

      outgoing.setHeader = function (name: string, value: any) {
        if (Array.isArray(value)) {
          value.forEach(v => resHeaders.append(name, String(v)));
        } else if (value !== undefined) {
          resHeaders.set(name, String(value));
        }
        return outgoing;
      };

      outgoing.getHeader = function (name: string) {
        return resHeaders.get(name) ?? undefined;
      };

      outgoing.write = function (chunk: any) {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return true;
      };

      outgoing.end = function (chunk?: any) {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const finalBuffer = Buffer.concat(chunks);
        resolve(new Response(finalBuffer, {
          status: statusCode,
          headers: resHeaders,
        }));
        return outgoing;
      };

      (expressApp as any)(incoming, outgoing);
    } catch (err) {
      reject(err);
    }
  });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
export async function PUT(req: NextRequest) { return handle(req); }
export async function DELETE(req: NextRequest) { return handle(req); }
export async function PATCH(req: NextRequest) { return handle(req); }
export async function OPTIONS(req: NextRequest) { return handle(req); }
export async function HEAD(req: NextRequest) { return handle(req); }
