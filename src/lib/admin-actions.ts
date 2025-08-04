
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
  createdAt: string; // Changed to string (ISO format)
}

export interface User {
  id: string;
  email: string;
  isAdmin: boolean;
  createdAt: string; // Changed to string (ISO format)
}

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

  const users = await kv.mget<User[]>(...userKeys);

  return users
    .filter((u): u is User => u !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getAllDocuments(): Promise<Document[]> {
    await checkAdmin();
    const docKeys = await kv.keys('doc:*');
    if (docKeys.length === 0) return [];
    
    const docs = await kv.mget<Document[]>(...docKeys);
    
    return docs
      .filter((d): d is Document => d !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}


export async function deleteUser(userId: string): Promise<{ success: boolean; message?: string }> {
  await checkAdmin();
  
  try {
    const user = await kv.get<User>(`user-by-id:${userId}`);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isAdmin) {
      throw new Error('Cannot delete an admin user.');
    }

    // Start a pipeline for atomic operations
    const pipeline = kv.pipeline();

    // Find and delete all documents associated with the user
    const docListKey = `user:${userId}:docs`;
    const docIds = await kv.lrange(docListKey, 0, -1);
    
    if (docIds.length > 0) {
      const docKeysToDelete = docIds.map(id => `doc:${id}`);
      // @ts-ignore
      pipeline.del(...docKeysToDelete);
    }
    
    // Delete the user's document list
    pipeline.del(docListKey);
    // Delete the user record by ID
    pipeline.del(`user-by-id:${userId}`);
    // Delete the user record by email
    pipeline.del(`user:${user.email}`);

    // Execute all commands in the pipeline
    await pipeline.exec();

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Failed to delete user:', message);
    return { success: false, message };
  }
}
