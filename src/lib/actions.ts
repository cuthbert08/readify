'use server';

import { kv } from '@vercel/kv';
import { revalidatePath } from 'next/cache';
import { getSession, createSession } from './session';
import type { User } from './db';

export async function setUsername(username: string): Promise<{ success: boolean; message?: string }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, message: 'Authentication required.' };
  }

  // Validate username format again on the server
  if (!/^[a-z0-9_.]+$/.test(username) || username.length < 3 || username.length > 20) {
    return { success: false, message: 'Invalid username format.' };
  }

  try {
    const user: User | null = await kv.get(`readify:user:id:${session.userId}`);
    if (!user) {
      return { success: false, message: 'User not found.' };
    }
    if (user.username) {
      return { success: false, message: 'Username is already set and cannot be changed.' };
    }

    // Check for username uniqueness
    const existingUserByUsername: User | null = await kv.get(`readify:user:username:${username}`);
    if (existingUserByUsername) {
      return { success: false, message: 'Username is already taken.' };
    }

    const updatedUser: User = { ...user, username };

    const pipeline = kv.pipeline();
    pipeline.set(`readify:user:id:${user.id}`, updatedUser);
    pipeline.set(`readify:user:email:${user.email}`, updatedUser);
    pipeline.set(`readify:user:username:${username}`, updatedUser);
    await pipeline.exec();
    
    // Re-create session with the new username
    await createSession(user.id, user.isAdmin, user.username);
    
    revalidatePath('/read');

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('Failed to set username:', message);
    return { success: false, message };
  }
}
