'use server';

import { kv } from '@vercel/kv';
import { getSession, createSession } from './session';
import type { User } from './db';
import bcrypt from 'bcrypt';

export async function changeUserPassword(data: {
  currentPassword?: string;
  newPassword?: string;
}): Promise<{ success: boolean; message?: string }> {
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, message: 'Authentication required.' };
  }

  if (!data.currentPassword || !data.newPassword) {
      return { success: false, message: 'All fields are required.'}
  }

  try {
    const user: User | null = await kv.get(`readify:user:id:${session.userId}`);
    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    const passwordsMatch = await bcrypt.compare(data.currentPassword, user.password);
    if (!passwordsMatch) {
      return { success: false, message: 'Incorrect current password.' };
    }

    const newHashedPassword = await bcrypt.hash(data.newPassword, 10);
    
    const updatedUser: User = {
        ...user,
        password: newHashedPassword,
    };

    const pipeline = kv.pipeline();
    pipeline.set(`readify:user:email:${user.email}`, updatedUser);
    pipeline.set(`readify:user:id:${user.id}`, updatedUser);
    if(user.username) {
        pipeline.set(`readify:user:username:${user.username}`, updatedUser);
    }
    await pipeline.exec();

    await createSession(user.id, user.isAdmin, user.username);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Failed to change password:', message);
    return { success: false, message };
  }
}
