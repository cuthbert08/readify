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
    const user: User | null = await kv.get(`user-by-id:${session.userId}`);
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
    pipeline.set(`user:${user.email}`, updatedUser);
    pipeline.set(`user-by-id:${user.id}`, updatedUser);
    await pipeline.exec();

    // Re-create the session to ensure it's fresh, although not strictly necessary for password change
    await createSession(user.id, user.isAdmin);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Failed to change password:', message);
    return { success: false, message };
  }
}
