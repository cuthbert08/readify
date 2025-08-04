import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { encrypt } from '@/lib/session';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    let user: any = await kv.get(`user:${email}`);

    // If user does not exist, and they are the admin, create them.
    if (!user && email === process.env.ADMIN_EMAIL) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = randomUUID();
        user = {
            id: userId,
            email,
            password: hashedPassword,
            isAdmin: true,
            createdAt: new Date().toISOString(),
        };
        const userById = {id: userId, email, isAdmin: true, createdAt: user.createdAt};
        
        const pipeline = kv.pipeline();
        pipeline.set(`user:${email}`, user);
        pipeline.set(`user-by-id:${userId}`, userById);
        await pipeline.exec();
    }

    if (!user) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const passwordsMatch = await bcrypt.compare(password, user.password);

    if (!passwordsMatch) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    
    // Explicitly check if the user's email is the admin email from env
    const isAdmin = user.email === process.env.ADMIN_EMAIL || user.isAdmin;

    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const session = await encrypt({ userId: user.id, email: user.email, expires, isAdmin });

    cookies().set('session', session, { 
        expires, 
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });

    return NextResponse.json({ success: true, isAdmin }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'An error occurred' }, { status: 500 });
  }
}
