import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { cookies } from 'next/headers';
import { encrypt } from '@/lib/session';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const isDesignatedAdmin = email === process.env.ADMIN_EMAIL;
    let user: any = await kv.get(`user:${email}`);

    if (isDesignatedAdmin) {
      if (!user) {
        // If the admin user does not exist, create them.
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
      } else {
         // If the user exists, ensure their isAdmin flag is true.
        if (!user.isAdmin) {
            user.isAdmin = true;
            await kv.set(`user:${email}`, user);
            const userById: any = await kv.get(`user-by-id:${user.id}`);
            if (userById) {
                userById.isAdmin = true;
                await kv.set(`user-by-id:${user.id}`, userById);
            }
        }
      }
    }

    if (!user) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const passwordsMatch = await bcrypt.compare(password, user.password);

    if (!passwordsMatch) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    
    // The final isAdmin status for the session is determined by the designated admin email.
    const isAdminForSession = user.email === process.env.ADMIN_EMAIL;

    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const session = await encrypt({ userId: user.id, email: user.email, expires, isAdmin: isAdminForSession });

    cookies().set('session', session, { 
        expires, 
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });

    return NextResponse.json({ success: true, isAdmin: isAdminForSession }, { status: 200 });
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
