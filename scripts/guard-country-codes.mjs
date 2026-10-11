#!/usr/bin/env node
/**
 * Protects the signup country-code catalogue from accidental deletion.
 * --check: fail CI if the file/import/export is missing.
 * --restore: restore the known-good tracked file if it was deleted or emptied.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const file = 'src/data/countryCodes.ts';
const importer = 'src/components/common/CountryCodePicker.tsx';
const knownGoodCommit = '3e31f0051cbe30143b233c996cd5932092446633';
const mode = process.argv.includes('--restore') ? 'restore' : 'check';

function readOrNull(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}
function validSource(content) {
  return typeof content === 'string' &&
    content.length > 1000 &&
    /export\s+interface\s+CountryCodeItem\b/.test(content) &&
    /export\s+const\s+ALL_COUNTRY_CODES\s*:\s*CountryCodeItem\[\]\s*=/.test(content) &&
    /iso:\s*'NG'/.test(content) &&
    /code:\s*'\+234'/.test(content);
}

let source = readOrNull(file);
if (!validSource(source) && mode === 'restore') {
  source = execFileSync('git', ['show', `${knownGoodCommit}:${file}`], { encoding: 'utf8' });
  if (!validSource(source)) throw new Error(`Pinned country-code source is invalid at ${knownGoodCommit}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source, 'utf8');
  console.log(`Restored ${file} from known-good commit ${knownGoodCommit}`);
}
if (!validSource(source)) {
  console.error(`ERROR: ${file} is missing or invalid. Do not delete this file: CountryCodePicker imports ALL_COUNTRY_CODES from it.`);
  process.exit(1);
}
const picker = readOrNull(importer);
if (!picker || !/from\s+['"]\.\.\/\.\.\/data\/countryCodes['"]/.test(picker) || !/ALL_COUNTRY_CODES/.test(picker)) {
  console.error(`ERROR: ${importer} must keep its import of ALL_COUNTRY_CODES from ../../data/countryCodes.`);
  process.exit(1);
}
console.log(`Country-code integrity check passed (${file})`);
