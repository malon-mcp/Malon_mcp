import { Parser, Language, Query } from 'web-tree-sitter';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { logger } from '../util/log.js';

const _require = createRequire(import.meta.url);

export interface ParsedSymbol {
  name: string;
  kind: 'function' | 'class' | 'method' | 'const' | 'interface' | 'type_alias';
  start_line: number;
  end_line: number;
  signature: string;
  body_hash: string;
}

export interface ImportEdge {
  from_symbol_name: string;
  to_symbol_name: string;
  to_file_path: string | null;
  kind: 'imports' | 'calls';
}

export interface ParseResult {
  symbols: ParsedSymbol[];
  edges: ImportEdge[];
}

type LanguageName = 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java';

const EXTENSION_MAP: Record<string, LanguageName> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
};

const WASM_MODULE_MAP: Record<LanguageName, string> = {
  typescript: 'tree-sitter-typescript',
  javascript: 'tree-sitter-javascript',
  python: 'tree-sitter-python',
  go: 'tree-sitter-go',
  rust: 'tree-sitter-rust',
  java: 'tree-sitter-java',
};

const WASM_FILE_MAP: Record<LanguageName, string> = {
  typescript: 'tree-sitter-typescript.wasm',
  javascript: 'tree-sitter-javascript.wasm',
  python: 'tree-sitter-python.wasm',
  go: 'tree-sitter-go.wasm',
  rust: 'tree-sitter-rust.wasm',
  java: 'tree-sitter-java.wasm',
};

let initialized = false;
const languageCache = new Map<LanguageName, Language>();

export async function initParser(): Promise<void> {
  if (initialized) return;

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const wasmDir = path.resolve(currentDir, '..', '..', 'node_modules', 'web-tree-sitter');
  await Parser.init({
    locateFile(_relativePath: string, _baseDir: string) {
      return path.join(wasmDir, _relativePath);
    },
  });

  for (const lang of Object.keys(WASM_MODULE_MAP) as LanguageName[]) {
    try {
      const moduleName = WASM_MODULE_MAP[lang];
      const wasmName = WASM_FILE_MAP[lang];
      const pkgDir = path.dirname(_require.resolve(`${moduleName}/package.json`));
      const wasmPath = path.join(pkgDir, wasmName);
      if (!fs.existsSync(wasmPath)) {
        logger.warn({ language: lang, path: wasmPath }, 'parser_wasm_not_found');
        continue;
      }
      const wasmBuffer = fs.readFileSync(wasmPath);
      const langObj = await Language.load(wasmBuffer);
      languageCache.set(lang, langObj);
      logger.info({ language: lang }, 'parser_language_loaded');
    } catch (err) {
      logger.warn({ language: lang, err: String(err) }, 'parser_language_load_failed');
    }
  }

  initialized = true;
}

export function detectLanguage(filePath: string): LanguageName | null {
  const ext = path.extname(filePath).toLowerCase();
  const lang = EXTENSION_MAP[ext];
  if (!lang || !languageCache.has(lang)) return null;
  return lang;
}

function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function extractSignature(text: string): string {
  const firstLine = text.split('\n')[0] ?? '';
  return firstLine.length > 200 ? firstLine.slice(0, 197) + '…' : firstLine;
}

function inferKind(nodeType: string, _lang?: LanguageName): ParsedSymbol['kind'] {
  switch (nodeType) {
    case 'function_declaration':
    case 'function_definition':
    case 'function_item':
    case 'function_signature_item':
      return 'function';
    case 'class_declaration':
    case 'class_definition':
    case 'struct_item':
    case 'enum_item':
    case 'enum_declaration':
    case 'record_declaration':
      return 'class';
    case 'method_definition':
    case 'method_declaration':
    case 'constructor_declaration':
    case 'compact_constructor_declaration':
      return 'method';
    case 'interface_declaration':
    case 'trait_item':
    case 'annotation_type_declaration':
      return 'interface';
    case 'type_alias_declaration':
    case 'type_alias':
    case 'type_item':
    case 'associated_type':
      return 'type_alias';
    case 'lexical_declaration':
    case 'variable_declaration':
    case 'variable_declarator':
    case 'const_spec':
    case 'var_spec':
    case 'const_item':
    case 'static_item':
    case 'field_declaration':
    case 'constant_declaration':
    case 'local_variable_declaration':
    case 'const_declaration':
    case 'var_declaration':
      return 'const';
    default:
      return 'function';
  }
}

export function parseFileContent(filePath: string, sourceCode: string): ParseResult | null {
  const lang = detectLanguage(filePath);
  if (!lang) return null;

  const language = languageCache.get(lang);
  if (!language) return null;

  try {
    const parser = new Parser();
    parser.setLanguage(language);
    const tree = parser.parse(sourceCode);
    if (!tree) {
      logger.warn({ filePath }, 'parse_returned_null');
      parser.delete();
      return { symbols: [], edges: [] };
    }
    const rootNode = tree.rootNode;

    const symbols: ParsedSymbol[] = [];
    const edges: ImportEdge[] = [];

    let symbolQuery: Query | null = null;
    let importQuery: Query | null = null;

    switch (lang) {
      case 'typescript':
        symbolQuery = new Query(
          language,
          [
            '(function_declaration name: (identifier) @name) @node',
            '(class_declaration name: (_) @name) @node',
            '(interface_declaration name: (type_identifier) @name) @node',
            '(type_alias_declaration name: (type_identifier) @name) @node',
            '(method_definition name: (property_identifier) @name) @node',
            '(lexical_declaration (variable_declarator name: (identifier) @name) @node)',
          ].join('\n'),
        );
        importQuery = new Query(
          language,
          [
            '(import_statement source: (string) @source)',
            '(import_specifier name: (identifier) @import_name)',
          ].join('\n'),
        );
        break;
      case 'javascript':
        symbolQuery = new Query(
          language,
          [
            '(function_declaration name: (identifier) @name) @node',
            '(class_declaration name: (_) @name) @node',
            '(method_definition name: (property_identifier) @name) @node',
            '(lexical_declaration (variable_declarator name: (identifier) @name) @node)',
          ].join('\n'),
        );
        importQuery = new Query(
          language,
          [
            '(import_statement source: (string) @source)',
            '(import_specifier name: (identifier) @import_name)',
          ].join('\n'),
        );
        break;
      case 'go':
        symbolQuery = new Query(
          language,
          [
            '(function_declaration name: (identifier) @name) @node',
            '(method_declaration name: (field_identifier) @name) @node',
            '(type_declaration (type_spec name: (type_identifier) @name (struct_type)) @node) @kind.class',
            '(type_declaration (type_spec name: (type_identifier) @name (interface_type)) @node) @kind.interface',
            '(type_alias name: (type_identifier) @name) @node',
            '(const_declaration (const_spec name: (identifier) @name)) @node',
            '(var_declaration (var_spec name: (identifier) @name)) @node',
          ].join('\n'),
        );
        importQuery = new Query(
          language,
          ['(import_spec path: (interpreted_string_literal) @source)'].join('\n'),
        );
        break;
      case 'rust':
        symbolQuery = new Query(
          language,
          [
            '(function_item name: (identifier) @name) @node',
            '(struct_item name: (type_identifier) @name) @node',
            '(enum_item name: (type_identifier) @name) @node',
            '(trait_item name: (type_identifier) @name) @node',
            '(const_item name: (identifier) @name) @node',
            '(static_item name: (identifier) @name) @node',
            '(type_item name: (type_identifier) @name) @node',
            '(associated_type name: (type_identifier) @name) @node',
          ].join('\n'),
        );
        importQuery = new Query(
          language,
          [
            '(use_declaration (scoped_identifier path: (_) @source name: (identifier) @import_name))',
            '(use_declaration (use_as_clause path: (_) @source alias: (identifier) @import_name))',
          ].join('\n'),
        );
        break;
      case 'java':
        symbolQuery = new Query(
          language,
          [
            '(method_declaration name: (identifier) @name) @node',
            '(constructor_declaration name: (identifier) @name) @node',
            '(class_declaration name: (identifier) @name) @node',
            '(interface_declaration name: (identifier) @name) @node',
            '(enum_declaration name: (identifier) @name) @node',
            '(record_declaration name: (identifier) @name) @node',
            '(annotation_type_declaration name: (identifier) @name) @node',
            '(field_declaration (variable_declarator name: (identifier) @name)) @node',
            '(constant_declaration (variable_declarator name: (identifier) @name)) @node',
          ].join('\n'),
        );
        importQuery = new Query(
          language,
          ['(import_declaration (scoped_identifier) @source)'].join('\n'),
        );
        break;
      case 'python': {
        const queryStr = [
          '(function_definition name: (identifier) @name) @node',
          '(class_definition name: (identifier) @name) @node',
        ].join('\n');
        symbolQuery = new Query(language, queryStr);
        importQuery = new Query(
          language,
          [
            '(import_statement name: (dotted_name) @import_name)',
            '(import_from_statement name: (dotted_name) @import_name)',
          ].join('\n'),
        );
        break;
      }
    }

    if (symbolQuery) {
      const matches = symbolQuery.matches(rootNode);

      for (const match of matches) {
        const nameCap = match.captures.find((c) => c.name === 'name');
        if (!nameCap) continue;
        const name = sourceCode.slice(nameCap.node.startIndex, nameCap.node.endIndex);

        let kind: ParsedSymbol['kind'] | undefined;

        const kindClass = match.captures.find((c) => c.name === 'kind.class');
        if (kindClass) {
          kind = 'class';
        }
        const kindInterface = match.captures.find((c) => c.name === 'kind.interface');
        if (kindInterface) {
          kind = 'interface';
        }

        const nodeCap = match.captures.find((c) => c.name === 'node');
        const symNode = nodeCap?.node ?? nameCap.node;

        const nodeText = sourceCode.slice(symNode.startIndex, symNode.endIndex);

        symbols.push({
          name,
          kind: kind ?? inferKind(symNode.type, lang),
          start_line: symNode.startPosition.row + 1,
          end_line: symNode.endPosition.row + 1,
          signature: extractSignature(nodeText),
          body_hash: simpleHash(nodeText),
        });
      }
    }

    if (importQuery) {
      const importMatches = importQuery.matches(rootNode);
      for (const match of importMatches) {
        const sourceCap = match.captures.find((c) => c.name === 'source');
        if (sourceCap) {
          const source = sourceCode
            .slice(sourceCap.node.startIndex, sourceCap.node.endIndex)
            .replace(/['"]/g, '');
          edges.push({
            from_symbol_name: '',
            to_symbol_name: source,
            to_file_path: null,
            kind: 'imports',
          });
        }
        const importNameCap = match.captures.find((c) => c.name === 'import_name');
        if (importNameCap) {
          const importName = sourceCode.slice(
            importNameCap.node.startIndex,
            importNameCap.node.endIndex,
          );
          edges.push({
            from_symbol_name: '',
            to_symbol_name: importName,
            to_file_path: null,
            kind: 'imports',
          });
        }
      }
    }

    parser.delete();
    return { symbols, edges };
  } catch (err) {
    logger.warn({ filePath, lang, err }, 'parse_file_failed');
    return { symbols: [], edges: [] };
  }
}

export function getSupportedExtensions(): string[] {
  return Object.keys(EXTENSION_MAP);
}

export const SUPPORTED_EXTENSIONS: ReadonlySet<string> = new Set(Object.keys(EXTENSION_MAP));

export function getSupportedLanguages(): string[] {
  return Object.keys(EXTENSION_MAP);
}

export function isLanguageSupported(filePath: string): boolean {
  return detectLanguage(filePath) !== null;
}
