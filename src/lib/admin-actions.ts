
'use server';

import { kv } from '@vercel/kv';
import { getSession } from './session';
import type { User as DbUser } from './db';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import type { WordTimestamp } from '@/ai/schemas';


export interface Document {
  id: string;
  userId: string;
  fileName: string;
  pdfUrl: string;
  audioUrl: string | null;
  words: WordTimestamp[] | null;
  zoomLevel: number;
  createdAt: string; 
}

// Re-export User type from db to ensure consistency
export type User = DbUser;


async function checkAdmin() {
  const session = await getSession();
  if (!session?.isAdmin) {
    throw new Error('Unauthorized: Admin access required.');
  }
}

export async function getAllUsers(): Promise<User[]> {
  await checkAdmin();
  const userKeys = await kv.keys('user-by-id:*');
  if (userKeys.length === 0) return [];
  
  if(!userKeys.length) return [];
  const users = await kv.mget<User[]>(...userKeys);

  return users
    .filter((u): u is User => u !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getAllDocuments(): Promise<Document[]> {
    await checkAdmin();
    const userDocListKeys = await kv.keys('user:*:docs');
    if (userDocListKeys.length === 0) return [];

    const allDocIdArrays = await kv.mget<string[]>(...userDocListKeys);
    const allDocIds = allDocIdArrays.flat().filter(id => id); 

    if (allDocIds.length === 0) return [];
    
    const uniqueDocIds = [...new Set(allDocIds)];
    const docKeys = uniqueDocIds.map(id => `doc:${id}`);

    if (docKeys.length === 0) return [];
    
    const docs = await kv.mget<Document[]>(...docKeys);
    
    return docs
      .filter((d): d is Document => d !== null && d.id !== undefined && d.fileName !== undefined)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}


export async function deleteUser(userId: string): Promise<{ success: boolean; message?: string }> {
  await checkAdmin();
  
  try {
    const user: User | null = await kv.get(`user-by-id:${userId}`);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isAdmin) {
      throw new Error('Cannot delete an admin user.');
    }

    const pipeline = kv.pipeline();

    const docListKey = `user:${userId}:docs`;
    const docIds: string[] = await kv.lrange(docListKey, 0, -1);
    
    if (docIds.length > 0) {
      const validDocIds = docIds.filter(id => id);
      const docKeysToDelete = validDocIds.map(id => `doc:${id}`);
      // @ts-ignore
      pipeline.del(...docKeysToDelete);
    }
    
    pipeline.del(docListKey);
    pipeline.del(`user-by-id:${userId}`);
    pipeline.del(`user:${user.email}`);

    await pipeline.exec();

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Failed to delete user:', message);
    return { success: false, message };
  }
}

export async function createUser(userData: {
    name: string;
    email: string;
    password: string;
    role: 'Admin' | 'User';
}): Promise<{ success: boolean, message?: string }> {
    await checkAdmin();

    try {
        const { name, email, password, role } = userData;

        const existingUser: User | null = await kv.get(`user:${email}`);
        if (existingUser) {
            return { success: false, message: 'User with this email already exists.' };
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userId = randomUUID();
        const newUser: User = {
            id: userId,
            name,
            email,
            password: hashedPassword,
            isAdmin: role === 'Admin',
            createdAt: new Date().toISOString(),
        };

        const pipeline = kv.pipeline();
        pipeline.set(`user:${email}`, newUser);
        pipeline.set(`user-by-id:${userId}`, newUser);
        await pipeline.exec();

        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Failed to create user:', message);
        return { success: false, message };
    }
}
