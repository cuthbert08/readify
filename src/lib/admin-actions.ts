
'use server';

import { kv } from '@vercel/kv';
import { getSession } from './session';

export interface Document {
  id: string;
  userId: string;
  fileName: string;
  pdfUrl: string;
  audioUrl: string | null;
  currentPage: number;
  totalPages: number;
  zoomLevel: number;
  createdAt: number;
}

export interface User {
  id: string;
  email: string;
  isAdmin: boolean;
  createdAt: number;
}

async function checkAdmin() {
  const session = await getSession();
  if (!session?.isAdmin) {
    throw new Error('Unauthorized: Admin access required.');
  }
}

// Helper to safely parse KV values which might be objects or strings
function parseKvObject<T>(item: T | string | null): T | null {
    if (item === null) return null;
    if (typeof item === 'string') {
        try {
            return JSON.parse(item);
        } catch (e) {
            console.error("Failed to parse KV item", item);
            return null;
        }
    }
    return item;
}

export async function getAllUsers(): Promise<User[]> {
  await checkAdmin();
  const userKeys = await kv.keys('user-by-id:*');
  if (userKeys.length === 0) return [];

  const usersRaw = await kv.mget<(User | string)[]>(...userKeys);

  return usersRaw
    .map(parseKvObject)
    .filter((u): u is User => u !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAllDocuments(): Promise<Document[]> {
  await checkAdmin();
  const docKeys = await kv.keys('doc:*');
  if (docKeys.length === 0) return [];
  
  const docsRaw = await kv.mget<(Document | string)[]>(...docKeys);
  
  return docsRaw
    .map(parseKvObject)
    .filter((d): d is Document => d !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}


export async function deleteUser(userId: string) {
  await checkAdmin();
  
  const userRaw = await kv.get(`user-by-id:${userId}`);
  if (!userRaw) throw new Error('User not found');
  const user = parseKvObject<User>(userRaw);

  if (!user) throw new Error('User data is corrupted');
  if (user.isAdmin) throw new Error('Cannot delete an admin user.');

  const docIds = await kv.lrange(`user:${userId}:docs`, 0, -1);
  const pipeline = kv.pipeline();
  
  if (docIds.length > 0) {
    const docKeysToDelete = docIds.map(id => `doc:${id}`);
    // @ts-ignore
    pipeline.del(...docKeysToDelete);
  }
  
  pipeline.del(`user:${userId}:docs`);
  pipeline.del(`user-by-id:${userId}`);
  pipeline.del(`user:${user.email}`);

  await pipeline.exec();
}
