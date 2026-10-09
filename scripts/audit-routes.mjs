#!/usr/bin/env node
/**
 * Read-only route inventory for Veyrang.
 * This reports source declarations, not proof of production availability.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const exists = (p) => fs.existsSync(path.join(root, p));
const walk = (dir) => {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.posix.join(dir, entry.name);
    return entry.isDirectory() ? walk(rel) : [rel];
  });
};
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const routePathFromFile = (file, base) => {
  let value = file.slice(base.length).replace(/\\/g, '/');
  value = value.replace(/(^|\/)route\.(ts|tsx|js|jsx)$/, '').replace(/(^|\/)page\.(ts|tsx|js|jsx)$/, '');
  value = value.replace(/\/\[\.\.\.([^\]]+)\]/g, '/:$1*');
  value = value.replace(/\[\[\.\.\.([^\]]+)\]\]/g, ':$1*?');
  value = value.replace(/\[([^\]]+)\]/g, ':$1');
  value = value.replace(/\/index$/, '');
  return value || '/';
};

const nextPages = walk('app').filter((p) => /(^|\/)page\.(tsx|ts|jsx|js)$/.test(p));
const nextApis = walk('app/api').filter((p) => /(^|\/)route\.(tsx|ts|jsx|js)$/.test(p));
const nextApiRows = nextApis.map((file) => {
  const source = read(file);
  const methods = [...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(/g)].map((m) => m[1]);
  return { file, path: '/api' + routePathFromFile(file, 'app/api'), methods: [...new Set(methods)] };
});

const expressApp = exists('server/app.ts') ? read('server/app.ts') : '';
const mounts = [...expressApp.matchAll(/apiRouter\.use\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)\s*\)/g)]
  .map((m) => ({ prefix: m[1], variable: m[2] }));
const importMap = new Map([...expressApp.matchAll(/import\s+(\w+)\s+from\s+['"]\.\/routes\/([^'"]+)['"]/g)].map((m) => [m[1], m[2]]));
const expressRows = [];
for (const file of walk('server/routes').filter((p) => /\.(ts|tsx|js|mjs)$/.test(p))) {
  const source = read(file);
  const variable = file.split('/').at(-1).replace(/\.(ts|tsx|js|mjs)$/, '');
  const prefix = mounts.find((mount) => importMap.get(mount.variable) === variable)?.prefix;
  const declarations = [...source.matchAll(/router\.(get|post|put|patch|delete|options|head)\s*\(\s*(['"])([^'"]+)\2/g)]
    .map((m) => ({ method: m[1].toUpperCase(), path: (prefix || '(unmounted)') + (m[3] === '/' ? '' : m[3]) }));
  for (const row of declarations) expressRows.push({ file, ...row, mounted: Boolean(prefix) });
}

const pageRows = nextPages.map((file) => ({ file, path: routePathFromFile(file, 'app') }));
console.log('VEY RANG ROUTE INVENTORY (source declarations only)');
console.log('===================================================');
console.log('Next.js pages: ' + pageRows.length);
for (const row of pageRows.sort((a, b) => a.path.localeCompare(b.path))) console.log('PAGE  ' + row.path.padEnd(34) + row.file);
console.log('\nNext.js API route files: ' + nextApiRows.length);
for (const row of nextApiRows.sort((a, b) => a.path.localeCompare(b.path))) {
  console.log('API   ' + row.path.padEnd(34) + (row.methods.join(', ') || 'NO EXPLICIT HTTP METHODS') + '  [' + row.file + ']');
}
console.log('\nExpress handler declarations: ' + expressRows.length);
for (const row of expressRows.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method))) {
  console.log('EXP   ' + row.method.padEnd(7) + row.path.padEnd(42) + (row.mounted ? '' : 'WARNING: mount not found') + '  [' + row.file + ']');
}
console.log('\nIMPORTANT: A source declaration is not proof of deployment or functionality.');
console.log('The standard package start script runs Next.js; Express handlers are not served by that process unless explicitly bridged or deployed separately.');
