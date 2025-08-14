
'use server';

import { kv } from '@vercel/kv';
import { del as deleteBlob } from '@vercel/blob';
import { getSession, type SessionPayload } from './session';
import { randomUUID } from 'crypto';
import type { SpeechMark } from '@/ai/schemas';


export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface QuizAttempt {
    questions: any[]; // Store the questions for review
    answers: Record<number, string>;
    score: number;
    suggestions: string;
    completedAt: string;
}

export interface Document {
  id: string | null; 
  userId: string;
  fileName: string;
  pdfUrl: string;
  textContent: string; // Add this field to store cleaned text
  audioUrl: string | null;
  speechMarks?: SpeechMark[] | null;
  zoomLevel: number;
  createdAt: string;
  chatHistory?: ChatMessage[];
  quizAttempt?: QuizAttempt | null;
}

export interface User {
    id: string;
    name: string;
    email: string;
    username: string | null; // Can be null for users who haven't set it yet
    password: string; // This is the hashed password
    isAdmin: boolean;
    createdAt: string;
    setupToken: string | null;
    setupTokenExpiry: string | null;
}

export interface UserSession extends SessionPayload {
    name: string;
    email: string;
}

// Helper function to get the correct key prefix
const getKeyPrefix = (isStaging: boolean) => (isStaging ? 'readify:staging' : 'readify');

export async function getUserSession(): Promise<UserSession | null> {
  const session = await getSession();
  if (session?.userId) {
    // User data is not staged, so we always fetch from production keys.
    const user: User | null = await kv.get(`readify:user:id:${session.userId}`);
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

export async function saveDocument(docData: Partial<Document>, isStaging: boolean = false): Promise<Document> {
  const session = await getSession();
  if (!session?.userId || !session.username) {
    throw new Error('Authentication and username required.');
  }
  const userId = session.userId;
  const prefix = getKeyPrefix(isStaging);

  let docId = docData.id;
  const userDocListKey = `${prefix}:user:${userId}:docs`;

  if (docId) {
    const docKey = `${prefix}:doc:${docId}`;
    const existingDocRaw: Document | null = await kv.get(docKey);
    if (!existingDocRaw) {
        throw new Error('Document not found.');
    }
    
    if (!session.isAdmin && existingDocRaw.userId !== userId) {
      throw new Error('Access denied.');
    }
    const updatedDoc: Document = {
      ...existingDocRaw,
      ...docData,
      id: docId, // Ensure id is set correctly
    };
    await kv.set(docKey, updatedDoc);
    return updatedDoc;

  } else {
    if (!docData.fileName || !docData.pdfUrl || !docData.textContent) {
      throw new Error("fileName, pdfUrl, and textContent are required for new documents.");
    }
    docId = randomUUID();
    const newDoc: Document = {
      id: docId,
      userId,
      fileName: docData.fileName,
      pdfUrl: docData.pdfUrl,
      textContent: docData.textContent,
      audioUrl: docData.audioUrl || null,
      speechMarks: docData.speechMarks || null,
      zoomLevel: docData.zoomLevel || 1,
      createdAt: new Date().toISOString(),
      chatHistory: [],
    };
    
    const docKey = `${prefix}:doc:${docId}`;
    const pipeline = kv.pipeline();
    pipeline.set(docKey, newDoc);
    pipeline.lpush(userDocListKey, docId);
    await pipeline.exec();

    return newDoc;
  }
}

export async function getDocuments(isStaging: boolean = false): Promise<Document[]> {
  const session = await getSession();
  if (!session?.userId) {
    return [];
  }
  const userId = session.userId;
  const prefix = getKeyPrefix(isStaging);
  const userDocListKey = `${prefix}:user:${userId}:docs`;

  const docIds = await kv.lrange<string[]>(userDocListKey, 0, -1);
  if (docIds.length === 0) {
    return [];
  }

  const validDocIds = docIds.filter(id => id);
  if (validDocIds.length === 0) {
    return [];
  }

  const docKeys = validDocIds.map(id => `${prefix}:doc:${id}`);
  const docs = await kv.mget<Document[]>(...docKeys);

  return docs
    .filter((doc): doc is Document => doc !== null)
    .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function deleteDocument(docId: string, isStaging: boolean = false): Promise<{ success: boolean, message?: string }> {
    const session = await getSession();
    if (!session?.userId) {
        throw new Error('Authentication required.');
    }
    const prefix = getKeyPrefix(isStaging);

    try {
        const docKey = `${prefix}:doc:${docId}`;
        const doc: Document | null = await kv.get(docKey);

        if (!doc) {
            return { success: true, message: 'Document already deleted.' };
        }

        if (doc.userId !== session.userId && !session.isAdmin) {
            throw new Error('You do not have permission to delete this document.');
        }

        // Delete files from Vercel Blob by passing the full URL
        const urlsToDelete = [doc.pdfUrl];
        if (doc.audioUrl) {
            urlsToDelete.push(doc.audioUrl);
        }
        
        if(urlsToDelete.length > 0) {
            await deleteBlob(urlsToDelete);
        }

        // Delete from KV
        const pipeline = kv.pipeline();
        pipeline.del(docKey);
        pipeline.lrem(`${prefix}:user:${doc.userId}:docs`, 1, docId);
        await pipeline.exec();
        
        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Failed to delete document:', message);
        return { success: false, message };
    }
}

export async function clearChatHistory(docId: string, isStaging: boolean = false): Promise<Document> {
    const session = await getSession();
    if (!session?.userId) {
        throw new Error('Authentication required.');
    }
    const prefix = getKeyPrefix(isStaging);
    const docKey = `${prefix}:doc:${docId}`;
    const doc: Document | null = await kv.get(docKey);

    if (!doc) {
        throw new Error('Document not found.');
    }

    if (doc.userId !== session.userId && !session.isAdmin) {
        throw new Error('You do not have permission to modify this document.');
    }

    const updatedDoc: Document = {
        ...doc,
        chatHistory: [],
    };

    await kv.set(docKey, updatedDoc);

    return updatedDoc;
}
