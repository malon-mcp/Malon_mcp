import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { initParser, parseFileContent, detectLanguage, getSupportedLanguages, isLanguageSupported } from '../../../dist/index/parser.js';
import fs from 'node:fs';
import path from 'node:path';

const FIXTURES_DIR = path.resolve('test/fixtures');

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
}

before(async () => {
  await initParser();
});

describe('parser', () => {
  describe('detectLanguage', () => {
    test('detects TypeScript from .ts', () => {
      assert.equal(detectLanguage('/path/to/file.ts'), 'typescript');
    });

    test('detects TypeScript from .tsx', () => {
      assert.equal(detectLanguage('/path/to/file.tsx'), 'typescript');
    });

    test('detects JavaScript from .js', () => {
      assert.equal(detectLanguage('/path/to/file.js'), 'javascript');
    });

    test('detects JavaScript from .jsx', () => {
      assert.equal(detectLanguage('/path/to/file.jsx'), 'javascript');
    });

    test('detects JavaScript from .mjs', () => {
      assert.equal(detectLanguage('/path/to/file.mjs'), 'javascript');
    });

    test('detects JavaScript from .cjs', () => {
      assert.equal(detectLanguage('/path/to/file.cjs'), 'javascript');
    });

    test('detects Python from .py', () => {
      assert.equal(detectLanguage('/path/to/file.py'), 'python');
    });

    test('returns null for unsupported extensions', () => {
      assert.equal(detectLanguage('/path/to/file.rb'), null);
    });

    test('returns null for unsupported extensions .go', () => {
      assert.equal(detectLanguage('/path/to/file.go'), null);
    });
  });

  describe('getSupportedLanguages', () => {
    test('returns all supported extensions', () => {
      const langs = getSupportedLanguages();
      assert.ok(langs.includes('.ts'));
      assert.ok(langs.includes('.js'));
      assert.ok(langs.includes('.py'));
    });
  });

  describe('isLanguageSupported', () => {
    test('returns true for .ts', () => {
      assert.equal(isLanguageSupported('/path/to/file.ts'), true);
    });

    test('returns false for .rb', () => {
      assert.equal(isLanguageSupported('/path/to/file.rb'), false);
    });
  });

  describe('parseFileContent', () => {
    test('returns null for unsupported file type', () => {
      const result = parseFileContent('/path/to/file.rb', 'content');
      assert.equal(result, null);
    });

    test('parses sample.ts and extracts symbols', () => {
      const code = readFixture('sample.ts.txt');
      const result = parseFileContent(path.join(FIXTURES_DIR, 'sample.ts'), code);
      assert.ok(result);

      const symbols = result.symbols;
      const edges = result.edges;

      assert.equal(symbols.length, 8);

      const interfaceSym = symbols.find(s => s.name === 'User');
      assert.ok(interfaceSym);
      assert.equal(interfaceSym.kind, 'interface');
      assert.equal(interfaceSym.start_line, 1);
      assert.equal(interfaceSym.end_line, 4);

      const functionSym = symbols.find(s => s.name === 'greet' && s.kind === 'function');
      assert.ok(functionSym);
      assert.equal(functionSym.kind, 'function');
      assert.equal(functionSym.start_line, 6);
      assert.equal(functionSym.end_line, 8);

      const classSym = symbols.find(s => s.name === 'Greeter');
      assert.ok(classSym);
      assert.equal(classSym.kind, 'class');

      const constructorSym = symbols.find(s => s.name === 'constructor');
      assert.ok(constructorSym);
      assert.equal(constructorSym.kind, 'method');

      const methodSym = symbols.find(s => s.name === 'greet' && s.kind === 'method');
      assert.ok(methodSym);

      const typeAliasSym = symbols.find(s => s.name === 'Result');
      assert.ok(typeAliasSym);
      assert.equal(typeAliasSym.kind, 'type_alias');

      const constSym = symbols.find(s => s.name === 'PI');
      assert.ok(constSym);
      assert.equal(constSym.kind, 'const');

      const internalSym = symbols.find(s => s.name === 'internalHelper');
      assert.ok(internalSym);
      assert.equal(internalSym.kind, 'function');

      assert.equal(edges.length, 0);
    });

    test('parses sample-imports.ts and extracts imports', () => {
      const code = readFixture('sample-imports.ts.txt');
      const result = parseFileContent(path.join(FIXTURES_DIR, 'sample-imports.ts'), code);
      assert.ok(result);

      const symbols = result.symbols;
      const edges = result.edges;

      assert.ok(symbols.some(s => s.name === 'run' && s.kind === 'function'));

      assert.ok(edges.length > 0);
      assert.ok(edges.some(e => e.to_symbol_name === './sample.js'));
      assert.ok(edges.some(e => e.to_symbol_name === 'node:fs'));
      assert.ok(edges.some(e => e.to_symbol_name === 'greet'));
      assert.ok(edges.some(e => e.to_symbol_name === 'User'));
    });

    test('parses empty file gracefully', () => {
      const result = parseFileContent('/path/to/empty.ts', '');
      assert.ok(result);
      assert.equal(result.symbols.length, 0);
      assert.equal(result.edges.length, 0);
    });

    test('parses file with syntax errors gracefully', () => {
      const code = 'this is not valid typescript @@@';
      const result = parseFileContent('/path/to/broken.ts', code);
      assert.ok(result);
      assert.ok(Array.isArray(result.symbols));
      assert.ok(Array.isArray(result.edges));
    });
  });
});
