import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_EXPIRES_IN = '30d';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET é obrigatório (ver .env.example). Nunca use um valor padrão em produção.');
  }
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface SessionTokenPayload {
  userId: string;
}

export function signSessionToken(userId: string): string {
  return jwt.sign({ userId } as SessionTokenPayload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as SessionTokenPayload;
  } catch {
    return null;
  }
}
