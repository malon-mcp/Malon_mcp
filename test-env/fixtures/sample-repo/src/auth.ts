export function validateToken(token: string): boolean {
  return token.length > 0 && token.startsWith('eyJ');
}

export function verifyJwt(token: string): { sub: string } {
  return { sub: 'user_123' };
}

export function generateApiKey(userId: string): string {
  const prefix = 'mal_';
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}${userId}_${random}`;
}
