
'use server';

import { kv } from '@vercel/kv';
import { revalidatePath } from 'next/cache';
import { getSession, createSession } from './session';
import type { User } from './db';
import bcrypt from 'bcrypt';
import { z } from 'zod';

const SetupAccountSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters.')
    .max(20, 'Username cannot be longer than 20 characters.')
    .regex(/^[a-z0-9_.]+$/, 'Username can only contain lowercase letters, numbers, underscores, and periods.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  token: z.string().uuid('Invalid token format.')
});

export async function setupAccount(formData: z.infer<typeof SetupAccountSchema>): Promise<{ success: boolean; message?: string }> {
    const validation = SetupAccountSchema.safeParse(formData);

    if(!validation.success) {
        return { success: false, message: validation.error.errors.map(e => e.message).join(', ') };
    }

    const { username, password, token } = validation.data;

    try {
        const userByTokenKey = `readify:user:setupToken:${token}`;
        const userByToken: User | null = await kv.get(userByTokenKey);

        if (!userByToken || !userByToken.setupTokenExpiry || new Date(userByToken.setupTokenExpiry) < new Date()) {
            if(userByToken) await kv.del(userByTokenKey);
            return { success: false, message: 'Invalid or expired setup link. Please ask an admin to resend the invitation.' };
        }
        
        const existingUserByUsername: User | null = await kv.get(`readify:user:username:${username}`);
        if (existingUserByUsername) {
            return { success: false, message: 'Username is already taken.' };
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const updatedUser: User = {
            ...userByToken,
            username,
            password: hashedPassword,
            setupToken: null, // Invalidate the token
            setupTokenExpiry: null,
        };
        
        const pipeline = kv.pipeline();
        pipeline.set(`readify:user:id:${updatedUser.id}`, updatedUser);
        pipeline.set(`readify:user:email:${updatedUser.email}`, updatedUser);
        pipeline.set(`readify:user:username:${username}`, updatedUser);
        pipeline.del(userByTokenKey); // Clean up the token key
        
        // Find the user by the old email key to update it, as we don't store user by token directly.
        // We'll need to get all users and find the one with the token.
        // Let's refine this logic. The token should point to the user id.
        
        // Let's adjust the user creation logic to store a token -> userId mapping.
        // For now, let's assume we can update the user.
        
        const userRecord: User | null = await kv.get(`readify:user:id:${userByToken.id}`);
        if(!userRecord) {
             return { success: false, message: 'Could not find original user record.' };
        }
        
        const finalUser: User = {
            ...userRecord,
            username,
            password: hashedPassword,
            setupToken: null,
            setupTokenExpiry: null
        };
        
        // Overwrite existing user records
        pipeline.set(`readify:user:id:${finalUser.id}`, finalUser);
        pipeline.set(`readify:user:email:${finalUser.email}`, finalUser);
        pipeline.set(`readify:user:username:${finalUser.username}`, finalUser);
        
        const oldTokenKey = `readify:user:setupToken:${token}`;
        const oldUser: User | null = await kv.get(oldTokenKey);
        if(oldUser) {
            pipeline.del(oldTokenKey); //This key should not exist.
        }
        const userToUpdate: User|null = await kv.get(`readify:user:id:${userByToken.id}`);
        if (userToUpdate && userToUpdate.setupToken === token) {
             const updated = {
                 ...userToUpdate,
                 username,
                 password: hashedPassword,
                 setupToken: null,
                 setupTokenExpiry: null,
             };
             pipeline.set(`readify:user:id:${userToUpdate.id}`, updated);
             pipeline.set(`readify:user:email:${userToUpdate.email}`, updated);
             pipeline.set(`readify:user:username:${username}`, updated);
        } else {
             return { success: false, message: 'Could not verify setup token.' };
        }


        await pipeline.exec();
        
        await createSession(finalUser.id, finalUser.isAdmin, finalUser.username);

        revalidatePath('/read');
        return { success: true };
    } catch(error) {
        const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
        console.error('Failed to set up account:', message);
        return { success: false, message };
    }
}


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
