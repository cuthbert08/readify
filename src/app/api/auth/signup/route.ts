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
    
    const adminExists = await kv.get('admin_user_exists');

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = randomUUID();

    // The first user to sign up is an admin, or if their email matches the ADMIN_EMAIL env var
    const isAdmin = !adminExists || email === process.env.ADMIN_EMAIL;

    const user = {
      id: userId,
      email,
      password: hashedPassword,
      isAdmin,
      createdAt: new Date().toISOString(),
    };
    
    const userById = {id: userId, email, isAdmin, createdAt: user.createdAt};
    
    const pipeline = kv.pipeline();
    pipeline.set(`user:${email}`, user);
    pipeline.set(`user-by-id:${userId}`, userById);
    if(isAdmin) {
      pipeline.set('admin_user_exists', true);
    }
    await pipeline.exec();


    return NextResponse.json({ message: 'User created successfully' }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'An error occurred' }, { status: 500 });
  }
}
