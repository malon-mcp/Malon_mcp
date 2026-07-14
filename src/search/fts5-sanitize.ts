import { SanitizedFts5Error } from '../util/errors.js';

const FTS5_OPERATORS = /[()^*"':]/g;
const MAX_QUERY_LEN = 256;

export function sanitizeFts5Query(input: string): string {
  if (typeof input !== 'string') {
    throw new SanitizedFts5Error('Query must be a string', String(input));
  }
  if (input.length === 0) {
    throw new SanitizedFts5Error('Query must not be empty', input);
  }
  let q = input.normalize('NFKC');
  if (q.length > MAX_QUERY_LEN) {
    q = q.slice(0, MAX_QUERY_LEN);
  }
  q = q.replace(FTS5_OPERATORS, ' ');
  q = q.replace(/\b(NEAR|AND|OR|NOT)\b/gi, ' ');
  q = q.replace(/\s+/g, ' ').trim();
  if (q.length === 0) {
    throw new SanitizedFts5Error('Query contained only operators', input);
  }
  return q;
}
