'use server';

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

    // The first user to sign up is an admin, or if their email matches the ADMIN_EMAIL env var
    const userKeys = await kv.keys('user:*');
    const isFirstUser = userKeys.length === 0;
    const isAdmin = isFirstUser || email === process.env.ADMIN_EMAIL;

    const user = {
      id: userId,
      email,
      password: hashedPassword,
      isAdmin,
      createdAt: Date.now(),
    };
    
    // kv.set automatically stringifies objects
    await kv.set(`user:${email}`, user);
    
    const userById = {id: userId, email, isAdmin, createdAt: user.createdAt};

    // Also store user by ID for easier retrieval
    await kv.set(`user-by-id:${userId}`, userById);

    return NextResponse.json({ message: 'User created successfully' }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'An error occurred' }, { status: 500 });
  }
}
