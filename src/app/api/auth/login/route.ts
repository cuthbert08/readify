'use server';

import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { encrypt } from '@/lib/session';
import type { User } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // 1. Find the user by email
    const user: User | null = await kv.get(`user:${email}`);

    if (!user) {
      console.log(`Login attempt failed: User not found for email ${email}`);
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    // 2. Compare the provided password with the stored hash
    const passwordsMatch = await bcrypt.compare(password, user.password);

    if (!passwordsMatch) {
      console.log(`Login attempt failed: Password mismatch for email ${email}`);
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    // 3. Create the session
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const session = await encrypt({
      userId: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
      expires,
    });

    // 4. Set the session cookie
    cookies().set('session', session, {
      expires,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    console.log(`Login successful for ${email}, isAdmin: ${user.isAdmin}`);
    return NextResponse.json({ success: true, isAdmin: user.isAdmin }, { status: 200 });

  } catch (error) {
    console.error('Login API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
