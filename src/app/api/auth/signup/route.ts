import { kv } from '@vercel/kv';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
    }

    const existingUser = await kv.get(`user:${email}`);
    if (existingUser) {
      return NextResponse.json({ message: 'User already exists' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = randomUUID();

    const user = {
      id: userId,
      email,
      password: hashedPassword,
    };

    await kv.set(`user:${email}`, JSON.stringify(user));

    return NextResponse.json({ message: 'User created successfully' }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'An error occurred' }, { status: 500 });
  }
}
