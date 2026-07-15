// Verify that install scripts haven't been accidentally re-enabled globally.
// This runs on `npm prepare` and checks that ignore-scripts is still set.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const npmrcPath = resolve(process.argv[2] ?? process.cwd(), '.npmrc');

try {
  const npmrc = readFileSync(npmrcPath, 'utf8');
  if (!/ignore-scripts=true/.test(npmrc)) {
    console.error(
      'WARNING: .npmrc does not contain ignore-scripts=true.\n' +
        'Install scripts are a supply-chain risk. Add the setting back.',
    );
    process.exit(1);
  }
  console.log('OK: .npmrc has ignore-scripts=true');
} catch {
  console.error('WARNING: .npmrc not found. Create one with ignore-scripts=true.');
  process.exit(1);
}
