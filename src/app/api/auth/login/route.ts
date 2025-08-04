import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { encrypt } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const user: any = await kv.get(`user:${email}`);

    if (!user) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const passwordsMatch = await bcrypt.compare(password, user.password);

    if (!passwordsMatch) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const session = await encrypt({ userId: user.id, email: user.email, expires });

    cookies().set('session', session, { expires, httpOnly: true });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'An error occurred' }, { status: 500 });
  }
}
