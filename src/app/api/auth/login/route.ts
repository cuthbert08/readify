
'use server';

import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { createSession } from '@/lib/session';
import type { User } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const user: User | null = await kv.get(`user:${email}`);

    if (!user) {
      console.log(`Login attempt failed: User not found for email ${email}`);
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const passwordsMatch = await bcrypt.compare(password, user.password);

    if (!passwordsMatch) {
      console.log(`Login attempt failed: Password mismatch for email ${email}`);
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    await createSession(user.id, user.isAdmin);

    const redirectUrl = user.isAdmin ? '/admin' : '/read';
    console.log(`Login successful for ${email}, redirecting to ${redirectUrl}`);
    return NextResponse.json({ success: true, redirectUrl });

  } catch (error) {
    console.error('Login API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
