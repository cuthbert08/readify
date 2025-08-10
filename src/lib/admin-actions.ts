
'use server';
import 'dotenv/config';

import { kv } from '@vercel/kv';
import { getSession } from './session';
import type { User as DbUser } from './db';
import { randomUUID } from 'crypto';
import { deleteDocument as dbDeleteDocument } from './db';
import { sendWelcomeEmail } from './email';

export interface Document {
  id: string;
  userId: string;
  fileName: string;
  pdfUrl: string;
  audioUrl: string | null;
  zoomLevel: number;
  createdAt: string; 
}

export interface DocumentWithAuthorEmail extends Document {
    ownerEmail: string;
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
  const userKeys = await kv.keys('readify:user:id:*');
  if (userKeys.length === 0) return [];
  
  if(!userKeys.length) return [];
  const users = await kv.mget<User[]>(...userKeys);

  return users
    .filter((u): u is User => u !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getAllDocuments(): Promise<DocumentWithAuthorEmail[]> {
    await checkAdmin();

    const users = await getAllUsers();
    const userEmailMap = new Map(users.map(u => [u.id, u.email]));

    const allUserKeys = await kv.keys('readify:user:id:*');
    if (allUserKeys.length === 0) {
        return [];
    }

    const userIds = allUserKeys.map(key => key.replace('readify:user:id:', ''));
    
    if (userIds.length === 0) {
        return [];
    }
    
    const pipeline = kv.pipeline();
    userIds.forEach(userId => pipeline.lrange(`readify:user:${userId}:docs`, 0, -1));
    const allDocIdLists = await pipeline.exec() as string[][];
    
    const allDocIds = allDocIdLists.flat();

    const uniqueDocIds = [...new Set(allDocIds.filter(id => id))];

    if (uniqueDocIds.length === 0) {
        return [];
    }
    
    const docKeys = uniqueDocIds.map(id => `readify:doc:${id}`);
    const allDocs = await kv.mget<Document[]>(...docKeys);
    
    const validDocs = allDocs.filter((d): d is Document => d !== null);

    const docsWithAuthorEmail = validDocs.map(doc => ({
        ...doc,
        ownerEmail: userEmailMap.get(doc.userId) || 'Unknown User'
    }));

    return docsWithAuthorEmail.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}


export async function deleteUser(userId: string): Promise<{ success: boolean; message?: string }> {
  await checkAdmin();
  
  try {
    const user: User | null = await kv.get(`readify:user:id:${userId}`);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isAdmin) {
      throw new Error('Cannot delete an admin user.');
    }

    const pipeline = kv.pipeline();

    const docListKey = `readify:user:${userId}:docs`;
    const docIds: string[] = await kv.lrange(docListKey, 0, -1);
    
    if (docIds.length > 0) {
      const validDocIds = docIds.filter(id => id);
      if (validDocIds.length > 0) {
        const docKeysToDelete = validDocIds.map(id => `readify:doc:${id}`);
        // @ts-ignore
        pipeline.del(...docKeysToDelete);
      }
    }
    
    pipeline.del(docListKey);
    pipeline.del(`readify:user:id:${userId}`);
    if (user.username) {
        pipeline.del(`readify:user:username:${user.username}`);
    }
    pipeline.del(`readify:user:email:${user.email}`);

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
    role: 'Admin' | 'User';
}): Promise<{ success: boolean, message?: string }> {
    await checkAdmin();

    try {
        const { name, email, role } = userData;

        const existingUserByEmail: User | null = await kv.get(`readify:user:email:${email}`);
        if (existingUserByEmail) {
            return { success: false, message: 'User with this email already exists.' };
        }
        
        const setupToken = randomUUID();
        const setupTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const userId = randomUUID();
        const newUser: User = {
            id: userId,
            name,
            email,
            username: null,
            password: '', // Password will be set by the user
            isAdmin: role === 'Admin',
            createdAt: new Date().toISOString(),
            setupToken,
            setupTokenExpiry: setupTokenExpiry.toISOString(),
        };

        const pipeline = kv.pipeline();
        pipeline.set(`readify:user:email:${email}`, newUser);
        pipeline.set(`readify:user:id:${userId}`, newUser);
        await pipeline.exec();
        
        const setupLink = `${process.env.NEXT_PUBLIC_APP_URL}/setup-account/${setupToken}`;
        await sendWelcomeEmail(email, name, setupLink);

        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Failed to create user:', message);
        return { success: false, message };
    }
}


export async function deleteDocumentAsAdmin(docId: string): Promise<{ success: boolean; message?: string }> {
    await checkAdmin();
    try {
        const result = await dbDeleteDocument(docId);
        return result;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Failed to delete document as admin:', message);
        return { success: false, message };
    }
}
