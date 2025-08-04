'use server';

import { kv } from '@vercel/kv';
import { getSession } from './session';
import { randomUUID } from 'crypto';

export interface Document {
  id: string;
  userId: string;
  fileName: string;
  pdfUrl: string;
  currentPage: number;
  totalPages: number;
  createdAt: number;
}

// Function to save or update a document's metadata
export async function saveDocument(docData: {
  id?: string;
  fileName: string;
  pdfUrl: string;
  currentPage: number;
  totalPages: number;
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
      currentPage: docData.currentPage,
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
      currentPage: docData.currentPage,
      totalPages: docData.totalPages,
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
