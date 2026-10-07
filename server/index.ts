import path from 'path';

// Filter legacy DEP0169 url.parse deprecation warnings in Node 22
process.on('warning', (warning: any) => {
  if (warning.name === 'DeprecationWarning' && (warning.code === 'DEP0169' || warning.message?.includes('url.parse'))) {
    return;
  }
  console.warn(warning);
});
import express from 'express';
import { CONFIG } from './config.ts';
import { createServerApp } from './app.ts';

const app = createServerApp();
const PORT = CONFIG.PORT;
const distPath = path.resolve(process.cwd(), 'dist');

// Serve compiled static assets in production
app.use(express.static(distPath));

// Fallback to index.html for SPA client routing, ignoring system files or non-existent assets with extensions
app.get('*', (req, res) => {
  const ext = path.extname(req.path);
  const isHidden = req.path.split('/').some(part => part.startsWith('.'));
  
  if (isHidden || ext) {
    return res.status(404).json({
      success: false,
      error: `Resource ${req.path} not found.`
    });
  }
  
  res.sendFile(path.resolve(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Veyrang production server running on http://0.0.0.0:${PORT}`);
});
