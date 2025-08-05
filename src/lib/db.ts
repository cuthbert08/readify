
'use server';

import { kv } from '@vercel/kv';
import { getSession, type SessionPayload } from './session';
import { randomUUID } from 'crypto';

export interface Document {
  id: string;
  userId: string;
  fileName: string;
  pdfUrl: string;
  audioUrl: string | null;
  zoomLevel: number;
  createdAt: string; 
}

export interface User {
    id: string;
    name: string;
    email: string;
    password: string; // This is the hashed password
    isAdmin: boolean;
    createdAt: string; 
}

export interface UserSession extends SessionPayload {
    name: string;
    email: string;
}

export async function getUserSession(): Promise<UserSession | null> {
  const session = await getSession();
  if (session?.userId) {
    const user: User | null = await kv.get(`user-by-id:${session.userId}`);
    if (user) {
        return {
            ...session,
            name: user.name,
            email: user.email,
        };
    }
  }
  return null;
}


export async function saveDocument(docData: {
  id?: string;
  fileName: string;
  pdfUrl: string;
  audioUrl?: string | null;
  zoomLevel?: number;
}): Promise<Document> {
  const session = await getSession();
  if (!session?.userId) {
    throw new Error('Authentication required.');
  }
  const userId = session.userId;

  let docId = docData.id;
  const userDocListKey = `user:${userId}:docs`;

  if (docId) {
    const existingDocRaw: Document | null = await kv.get(`doc:${docId}`);
    if (!existingDocRaw) {
        throw new Error('Document not found.');
    }
    
    if (!session.isAdmin && existingDocRaw.userId !== userId) {
      throw new Error('Access denied.');
    }
    const updatedDoc: Document = {
      ...existingDocRaw,
      ...docData,
      audioUrl: docData.audioUrl !== undefined ? docData.audioUrl : existingDocRaw.audioUrl,
      zoomLevel: docData.zoomLevel !== undefined ? docData.zoomLevel : existingDocRaw.zoomLevel,
    };
    await kv.set(`doc:${docId}`, updatedDoc);
    return updatedDoc;

  } else {
    docId = randomUUID();
    const newDoc: Document = {
      id: docId,
      userId,
      fileName: docData.fileName,
      pdfUrl: docData.pdfUrl,
      audioUrl: docData.audioUrl || null,
      zoomLevel: docData.zoomLevel || 1,
      createdAt: new Date().toISOString(),
    };
    
    const pipeline = kv.pipeline();
    pipeline.set(`doc:${docId}`, newDoc);
    pipeline.lpush(userDocListKey, docId);
    await pipeline.exec();

    return newDoc;
  }
}

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

  const validDocIds = docIds.filter(id => id);
  if (validDocIds.length === 0) {
    return [];
  }

  const docKeys = validDocIds.map(id => `doc:${id}`);
  const docs = await kv.mget<Document[]>(...docKeys);

  return docs
    .filter((doc): doc is Document => doc !== null)
    .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
