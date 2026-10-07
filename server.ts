import path from 'path';
import express from 'express';
import { createServerApp } from './server/app.ts';
import { CONFIG } from './server/config.ts';

const app = createServerApp();
const PORT = CONFIG.PORT || 3000;

async function start() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const ext = path.extname(req.path);
      const isHidden = req.path.split('/').some((part) => part.startsWith('.'));
      if (isHidden || ext) {
        return res.status(404).json({ success: false, error: `Resource ${req.path} not found.` });
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    // In dev: mount vite.middlewares for rapid HMR while Express handles all API routes first
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Veyrang fullstack application server running on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start Veyrang server:', err);
  process.exit(1);
});
