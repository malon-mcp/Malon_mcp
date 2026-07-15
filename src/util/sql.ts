import type { Statement, Database as DatabaseType } from 'better-sqlite3';

export interface SqlQuery {
  text: string;
  params: unknown[];
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlQuery {
  const text: string[] = [];
  const params: unknown[] = [];
  for (let i = 0; i < strings.length; i++) {
    text.push(strings[i] ?? '');
    if (i < values.length) {
      text.push('?');
      params.push(values[i]);
    }
  }
  return { text: text.join(''), params };
}

export function query<T = unknown>(
  db: DatabaseType,
  sqlQuery: SqlQuery,
  ...extraParams: unknown[]
): T[] {
  const allParams = [...sqlQuery.params, ...extraParams];
  const stmt: Statement = db.prepare(sqlQuery.text);
  const rows = stmt.all(...allParams) as T[];
  return rows;
}

export function queryOne<T = unknown>(
  db: DatabaseType,
  sqlQuery: SqlQuery,
  ...extraParams: unknown[]
): T | undefined {
  const allParams = [...sqlQuery.params, ...extraParams];
  const stmt: Statement = db.prepare(sqlQuery.text);
  return stmt.get(...allParams) as T | undefined;
}

export function execute(
  db: DatabaseType,
  sqlQuery: SqlQuery,
  ...extraParams: unknown[]
): { changes: number; lastInsertRowid: number | bigint } {
  const allParams = [...sqlQuery.params, ...extraParams];
  const stmt: Statement = db.prepare(sqlQuery.text);
  const info = stmt.run(...allParams);
  return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
}

export function transaction<T>(db: DatabaseType, fn: () => T): T {
  const txn = db.transaction(fn);
  return txn();
}
