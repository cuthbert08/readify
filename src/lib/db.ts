'use server';

import { kv } from '@vercel/kv';
import { getSession } from './session';
import { randomUUID } from 'crypto';

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

// Function to save or update a document's metadata
export async function saveDocument(docData: {
  id?: string;
  fileName: string;
  pdfUrl: string;
  currentPage: number;
  totalPages: number;
  audioUrl?: string | null;
  zoomLevel?: number;
}): Promise<Document> {
  const session = await getSession();
  if (!session?.userId) {
    throw new Error('Authentication required.');
  }
  const userId = session.userId;

  let docId = docData.id;

  if (docId) {
    // Update existing document
    const existingDoc = await kv.get<Document>(`doc:${docId}`);
    if (!existingDoc || existingDoc.userId !== userId) {
      throw new Error('Document not found or access denied.');
    }
    const updatedDoc: Document = {
      ...existingDoc,
      ...docData,
      audioUrl: docData.audioUrl || existingDoc.audioUrl,
      zoomLevel: docData.zoomLevel || existingDoc.zoomLevel,
      currentPage: docData.currentPage || existingDoc.currentPage,
    };
    await kv.set(`doc:${docId}`, updatedDoc);
    return updatedDoc;

  } else {
    // Create new document
    docId = randomUUID();
    const newDoc: Document = {
      id: docId,
      userId,
      fileName: docData.fileName,
      pdfUrl: docData.pdfUrl,
      audioUrl: docData.audioUrl || null,
      currentPage: docData.currentPage,
      totalPages: docData.totalPages,
      zoomLevel: docData.zoomLevel || 1,
      createdAt: Date.now(),
    };
    await kv.set(`doc:${docId}`, newDoc);
    
    // Add document ID to user's list of documents
    const userDocListKey = `user:${userId}:docs`;
    await kv.lpush(userDocListKey, docId);

    return newDoc;
  }
}

// Function to get all documents for the current user
export async function getDocuments(): Promise<Document[]> {
  const session = await getSession();
  if (!session?.userId) {
    return [];
  }
  const userId = session.userId;
  const userDocListKey = `user:${userId}:docs`;

  const docIds = await kv.lrange(userDocListKey, 0, -1);
  if (docIds.length === 0) {
    return [];
  }

  const docs = await kv.mget<Document[]>(...docIds.map(id => `doc:${id}`));

  return docs.filter(doc => doc !== null).sort((a,b) => b.createdAt - a.createdAt);
}


// --- Admin Functions ---

async function
isAdmin() {
    const session = await getSession();
    if (!session?.isAdmin) {
        throw new Error('Unauthorized');
    }
}

export async function getAllUsers(): Promise<User[]> {
    await isAdmin();
    const userKeys = await kv.keys('user-by-id:*');
    if (userKeys.length === 0) return [];
    const users = await kv.mget<User[]>(...userKeys);
    return users.filter(u => u !== null).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAllDocuments(): Promise<Document[]> {
    await isAdmin();
    const docKeys = await kv.keys('doc:*');
    if (docKeys.length === 0) return [];
    const docs = await kv.mget<Document[]>(...docKeys);
    return docs.filter(d => d !== null).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getUserDocCount(userId: string): Promise<number> {
    await isAdmin();
    return await kv.llen(`user:${userId}:docs`);
}

export async function deleteUser(userId: string) {
    await isAdmin();
    
    const user = await kv.get<User>(`user-by-id:${userId}`);
    if (!user) throw new Error('User not found');

    const docIds = await kv.lrange(`user:${user.id}:docs`, 0, -1);
    
    const pipeline = kv.pipeline();
    // Delete all documents
    if(docIds.length > 0) {
      docIds.forEach(id => pipeline.del(`doc:${id}`));
    }
    // Delete user's doc list
    pipeline.del(`user:${user.id}:docs`);
    // Delete user objects
    pipeline.del(`user-by-id:${userId}`);
    pipeline.del(`user:${user.email}`);

    await pipeline.exec();
}
