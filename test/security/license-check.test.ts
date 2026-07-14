import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('no GPL or AGPL dependencies in the runtime tree — static check', async () => {
  const pkg = JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const suspectDeps = new Map<string, string>();

  for (const [name, _ver] of Object.entries(deps)) {
    try {
      const depPkg = JSON.parse(
        await readFile(resolve(ROOT, 'node_modules', name, 'package.json'), 'utf8'),
      );
      const license = (depPkg.license ?? depPkg.licenses ?? '').toString().toLowerCase();
      if (license.includes('gpl') || license.includes('agpl')) {
        suspectDeps.set(name, license);
      }
    } catch {
      // Skip missing node_modules (devDeps not installed)
    }
  }

  if (suspectDeps.size > 0) {
    console.log('GPL/AGPL dependencies found:', Object.fromEntries(suspectDeps));
  }
  assert.equal(
    suspectDeps.size,
    0,
    `GPL/AGPL dependencies detected: ${[...suspectDeps.keys()].join(', ')}`,
  );
});
