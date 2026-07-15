import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

const TEMPLATES: ((idx: number) => string)[] = [
  (i) => `import { dep_${i}_a } from './mod_${i}_a.js';
import { dep_${i}_b } from './mod_${i}_b.js';

export function handler_${i}(): string {
  return dep_${i}_a() + dep_${i}_b();
}

export function validator_${i}(input: string): boolean {
  return input.length > 0 && input.startsWith('pfx');
}

export class Manager_${i} {
  private items: string[] = [];
  add(item: string): void { this.items.push(item); }
  count(): number { return this.items.length; }
  clear(): void { this.items = []; }
}
`,
  (i) => `export interface Data_${i} {
  id: string;
  name: string;
  value: number;
  tags: string[];
  active: boolean;
  createdAt: string;
}

export function validate_${i}(data: Data_${i}): boolean {
  return data.id.length > 0 && data.value >= 0;
}

export function create_${i}(name: string): Data_${i} {
  return { id: \`id_\${crypto.randomUUID()}\`, name, value: 0, tags: [], active: true, createdAt: new Date().toISOString() };
}
`,
  (i) => `export function transform_${i}(input: string): string {
  return input.trim().toLowerCase().replace(/\\s+/g, '-');
}

export function parse_${i}(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of raw.split('\\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length > 0) result[key.trim()] = rest.join('=').trim();
  }
  return result;
}

export function merge_${i}(a: Record<string, string>, b: Record<string, string>): Record<string, string> {
  return { ...a, ...b };
}
`,
  (i) => `export interface Config_${i} {
  enabled: boolean;
  endpoint: string;
  timeout: number;
  retries: number;
}

export const DEFAULT_CONFIG_${i}: Config_${i} = {
  enabled: true,
  endpoint: 'https://api.example.com/endpoint_${i}',
  timeout: 5000,
  retries: 3,
};

export function loadConfig_${i}(overrides?: Partial<Config_${i}>): Config_${i} {
  return { ...DEFAULT_CONFIG_${i}, ...overrides };
}
`,
  (i) => `export function format_${i}(input: string): string {
  return \`[\${input}]\`;
}

export function extract_${i}(data: string, pattern: RegExp): string[] {
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(data)) !== null) matches.push(m[1] ?? '');
  return matches;
}

export function summarize_${i}(items: number[]): { sum: number; avg: number; max: number } {
  const sum = items.reduce((a, b) => a + b, 0);
  return { sum, avg: items.length > 0 ? sum / items.length : 0, max: Math.max(...items) };
}
`,
];

export async function generateBenchFixture(
  baseDir: string,
  fileCount = 60,
): Promise<{ srcDir: string; files: string[] }> {
  const srcDir = path.join(baseDir, 'src');
  await mkdir(srcDir, { recursive: true });

  const files: string[] = [];

  for (let i = 0; i < fileCount; i++) {
    const idx = i + 1;
    const fileName = `mod_${idx}.ts`;
    const template = TEMPLATES[i % TEMPLATES.length];

    const importLines: string[] = [];
    if (i > 0 && i % 5 === 0) {
      const depIdx = i - 4;
      importLines.push(`import { handler_${depIdx} } from './mod_${depIdx}.js';`);
    }
    if (i > 1 && i % 7 === 0) {
      const depIdx = i - 6;
      importLines.push(`import { validate_${depIdx} } from './mod_${depIdx}.js';`);
    }

    let content = template(idx);
    if (importLines.length > 0) {
      content = importLines.join('\n') + '\n' + content;
    }

    const filePath = path.join(srcDir, fileName);
    await writeFile(filePath, content);
    files.push(fileName);
  }

  return { srcDir, files };
}

if (process.argv[1]?.includes('generate-bench-fixture')) {
  const targetDir = process.argv[2] || path.join(tmpdir(), 'malon-bench-fixture');
  const count = parseInt(process.argv[3] || '60', 10);
  const result = await generateBenchFixture(targetDir, count);
  console.log(`Generated ${result.files.length} files in ${result.srcDir}`);
  process.stdout.write(targetDir);
}
