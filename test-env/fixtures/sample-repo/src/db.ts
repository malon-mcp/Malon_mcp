export interface User {
  id: string;
  name: string;
  email: string;
}

const users: User[] = [];

export function createUser(name: string, email: string): User {
  const user: User = { id: crypto.randomUUID(), name, email };
  users.push(user);
  return user;
}

export function findUserByEmail(email: string): User | undefined {
  return users.find((u) => u.email === email);
}

export function getAllUsers(): User[] {
  return [...users];
}
