export type ContentStability = 'stable' | 'dynamic';

export interface ContextItem {
  key: string;
  content: string;
  stability: ContentStability;
  priority: number;
}

export interface OrderedContext {
  items: ContextItem[];
  totalLength: number;
}

export function orderContext(items: ContextItem[]): OrderedContext {
  const sorted = [...items].sort((a, b) => {
    const aScore = a.stability === 'stable' ? a.priority : 1000 + a.priority;
    const bScore = b.stability === 'stable' ? b.priority : 1000 + b.priority;
    return aScore - bScore;
  });

  const totalLength = sorted.reduce((sum, item) => sum + item.content.length, 0);

  return { items: sorted, totalLength };
}

export function buildContextString(items: ContextItem[]): string {
  const ordered = orderContext(items);
  return ordered.items.map((item) => item.content).join('\n');
}

export function createStableItem(key: string, content: string, priority = 0): ContextItem {
  return { key, content, stability: 'stable', priority };
}

export function createDynamicItem(key: string, content: string, priority = 0): ContextItem {
  return { key, content, stability: 'dynamic', priority };
}
