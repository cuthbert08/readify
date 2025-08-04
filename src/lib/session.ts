import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import type { User } from './db';

const secretKey = process.env.JWT_SECRET || 'your-secret-key-for-development';
const key = new TextEncoder().encode(secretKey);

export interface SessionPayload {
    userId: string;
    email: string;
    name: string;
    isAdmin: boolean;
    expires: Date;
}

export async function encrypt(payload: SessionPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(key);
}

export async function decrypt(input: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify<SessionPayload>(input, key, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (e: any) {
    console.error('JWT Decryption Error:', e?.code || e?.message);
    return null;
  }
}

export async function getSession() {
  const sessionCookie = cookies().get('session')?.value;
  if (!sessionCookie) return null;
  
  const session = await decrypt(sessionCookie);
  if (!session) return null;

  // Add user's name to the session data from the database
  const user: User | null = await (await import('./db')).kv.get(`user-by-id:${session.userId}`);
  return {
    ...session,
    name: user?.name || session.email,
  };
}

export async function updateSession(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')?.value;
  if (!sessionCookie) return;

  const parsed = await decrypt(sessionCookie);
  if (!parsed) return;

  parsed.expires = new Date(Date.now() + 24 * 60 * 60 * 1000); 
  const res = NextResponse.next();
  res.cookies.set({
    name: 'session',
    value: await encrypt(parsed),
    httpOnly: true,
    expires: parsed.expires,
  });
  return res;
}
