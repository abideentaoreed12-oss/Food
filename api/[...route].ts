import { createServerApp } from '../server/app.ts';

let cachedApp: any = null;

function getApp() {
  if (!cachedApp) {
    cachedApp = createServerApp();
  }
  return cachedApp;
}

export default function handler(req: any, res: any) {
  try {
    const app = getApp();
    return app(req, res);
  } catch (err: any) {
    console.error('Serverless Handler Error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'An internal serverless error occurred.'
      });
    }
  }
}
