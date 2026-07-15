import type Database from 'better-sqlite3';

export interface GraphNode {
  symbol: string;
  file_path: string | null;
  kind: string;
}

export function graphWalk(db: Database.Database, symbol: string, depth = 1): GraphNode[] {
  const visited = new Set<string>();
  const results: GraphNode[] = [];
  const queue = [{ symbol, depth: 0 }];

  const stmt = db.prepare(`
    SELECT s.name, s.file_path, s.kind
    FROM edges e
    JOIN symbols s ON s.name = e.to_symbol_name
    WHERE e.from_symbol_id IN (
      SELECT id FROM symbols WHERE name = ?
    ) AND e.kind IN ('calls', 'imports')
    LIMIT 50
  `);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.symbol)) continue;
    visited.add(current.symbol);

    const rows = stmt.all(current.symbol) as {
      name: string;
      file_path: string | null;
      kind: string;
    }[];
    for (const row of rows) {
      results.push({ symbol: row.name, file_path: row.file_path, kind: row.kind });
      if (current.depth < depth) {
        queue.push({ symbol: row.name, depth: current.depth + 1 });
      }
    }
  }

  return results;
}
