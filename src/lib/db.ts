
'use server';

import { kv } from '@vercel/kv';
import { getSession, type SessionPayload } from './session';
import { randomUUID } from 'crypto';
import type { Sentence } from '@/ai/schemas';

export interface Document {
  id: string;
  userId: string;
  fileName: string;
  pdfUrl: string;
  audioUrl: string | null;
  sentences: Sentence[] | null;
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
  sentences?: Sentence[] | null;
  zoomLevel?: number;
}): Promise<Document> {
  const session = await getSession();
  if (!session?.userId) {
    throw new Error('Authentication required.');
  }
  const userId = session.userId;

  let docId = docData.id;

  if (docId) {
    const existingDocRaw = await kv.get(`doc:${docId}`);
    if (!existingDocRaw) {
        throw new Error('Document not found.');
    }
    const existingDoc = existingDocRaw as Document;
    
    if (existingDoc.userId !== userId) {
      throw new Error('Access denied.');
    }
    const updatedDoc: Document = {
      ...existingDoc,
      ...docData,
      audioUrl: docData.audioUrl !== undefined ? docData.audioUrl : existingDoc.audioUrl,
      sentences: docData.sentences !== undefined ? docData.sentences : existingDoc.sentences,
      zoomLevel: docData.zoomLevel !== undefined ? docData.zoomLevel : existingDoc.zoomLevel,
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
      sentences: docData.sentences || null,
      zoomLevel: docData.zoomLevel || 1,
      createdAt: new Date().toISOString(),
    };
    await kv.set(`doc:${docId}`, newDoc);
    
    const userDocListKey = `user:${userId}:docs`;
    await kv.lpush(userDocListKey, docId);

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

  const docs = await kv.mget<Document[]>(...docIds.map(id => `doc:${id}`));

  return docs
    .filter((doc): doc is Document => doc !== null)
    .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

    