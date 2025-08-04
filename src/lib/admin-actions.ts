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

export async function getAllUsers(): Promise<User[]> {
  await checkAdmin();
  const userKeys = await kv.keys('user-by-id:*');
  if (userKeys.length === 0) return [];
  const users = await kv.mget<User[]>(...userKeys);
  return users.filter((u): u is User => u !== null).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAllDocuments(): Promise<Document[]> {
  await checkAdmin();
  const docKeys = await kv.keys('doc:*');
  if (docKeys.length === 0) return [];
  const docs = await kv.mget<Document[]>(...docKeys);
  return docs.filter((d): d is Document => d !== null).sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteUser(userId: string) {
  await checkAdmin();
  const user = await kv.get<User>(`user-by-id:${userId}`);
  if (!user) throw new Error('User not found');
  if (user.isAdmin) throw new Error('Cannot delete an admin user.');

  const docIds = await kv.lrange(`user:${userId}:docs`, 0, -1);
  const pipeline = kv.pipeline();
  
  if (docIds.length > 0) {
    docIds.forEach(id => pipeline.del(`doc:${id}`));
  }
  
  pipeline.del(`user:${userId}:docs`);
  pipeline.del(`user-by-id:${userId}`);
  pipeline.del(`user:${user.email}`);

  await pipeline.exec();
}
