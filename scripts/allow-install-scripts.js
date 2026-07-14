// Allow-list for packages that require install scripts (native builds).
// Run after `npm install` to re-enable scripts for trusted packages.
// Usage: node scripts/allow-install-scripts.js <install-dir>

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ALLOW_LIST = [
  'better-sqlite3', // native build (C++ addon via node-gyp)
];

const installDir = resolve(process.argv[2] ?? process.cwd());
const pkgPath = resolve(installDir, 'node_modules');

for (const pkg of ALLOW_LIST) {
  const pkgDir = resolve(pkgPath, pkg);
  if (!existsSync(pkgDir)) continue;
  const pkgJson = JSON.parse(readFileSync(resolve(pkgDir, 'package.json'), 'utf8'));
  if (pkgJson.scripts?.install || pkgJson.scripts?.postinstall || pkgJson.scripts?.preinstall) {
    console.log(`Allowing install scripts for: ${pkg}`);
    execFileSync('npm', ['rebuild', pkg], { cwd: installDir, stdio: 'inherit' });
  }
}
