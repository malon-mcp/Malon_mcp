import { findUserByEmail, createUser, getAllUsers } from './db.js';
import { validateToken } from './auth.js';

export function handleLogin(email: string, token: string): { ok: boolean; error?: string } {
  if (!validateToken(token)) {
    return { ok: false, error: 'Invalid token' };
  }
  const user = findUserByEmail(email);
  if (!user) {
    return { ok: false, error: 'User not found' };
  }
  return { ok: true };
}

export function handleSignup(name: string, email: string): { ok: boolean; userId?: string } {
  const existing = findUserByEmail(email);
  if (existing) {
    return { ok: false };
  }
  const user = createUser(name, email);
  return { ok: true, userId: user.id };
}

export function listUsers(): { users: import('./db.js').User[] } {
  return { users: getAllUsers() };
}
