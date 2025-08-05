
'use server';

import { kv } from '@vercel/kv';
import { getSession } from './session';
import type { User as DbUser } from './db';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';

export interface Document {
  id: string;
  userId: string;
  fileName: string;
  pdfUrl: string;
  audioUrl: string | null;
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
    const allDocs: Document[] = [];
    const BATCH_SIZE = 100; // How many documents to fetch at a time

    // Use a cursor to iterate over all user document lists without fetching all keys at once
    let cursor = 0;
    do {
        const [nextCursor, keys] = await kv.scan(cursor, { match: 'user:*:docs' });
        cursor = nextCursor;

        let allDocIds: string[] = [];
        for (const key of keys) {
            const docIds = await kv.lrange(key, 0, -1);
            allDocIds.push(...docIds);
        }

        const uniqueDocIds = [...new Set(allDocIds.filter(id => id))];

        // Fetch document data in batches
        for (let i = 0; i < uniqueDocIds.length; i += BATCH_SIZE) {
            const batchIds = uniqueDocIds.slice(i, i + BATCH_SIZE);
            const docKeys = batchIds.map(id => `doc:${id}`);
            if (docKeys.length > 0) {
                const docsBatch = await kv.mget<Document[]>(...docKeys);
                const validDocs = docsBatch.filter((d): d is Document => d !== null && d.id !== undefined && d.fileName !== undefined);
                allDocs.push(...validDocs);
            }
        }

    } while (cursor !== 0);

    return allDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
      if (validDocIds.length > 0) {
        const docKeysToDelete = validDocIds.map(id => `doc:${id}`);
        // @ts-ignore
        pipeline.del(...docKeysToDelete);
      }
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
