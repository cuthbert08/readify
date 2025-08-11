import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getSession } from '@/lib/session';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  const session = await getSession();
  // Allow uploads even if username is not set yet (e.g., during initial document processing)
  if (!session?.userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const originalFilename = request.headers.get('x-vercel-filename');
  if (!originalFilename) {
    return NextResponse.json(
      { message: 'Filename is missing' },
      { status: 400 }
    );
  }
  
  if (!request.body) {
    return NextResponse.json(
      { message: 'Request body is missing' },
      { status: 400 }
    );
  }
  
  // Use a unique identifier for the user folder, which is the userId.
  const userIdentifier = session.userId;
  const docId = request.headers.get('x-doc-id') || randomUUID();
  const blobName = `readify/${userIdentifier}/${docId}-${originalFilename}`;

  try {
    const blob = await put(blobName, request.body, {
      access: 'public',
      addRandomSuffix: false,
    });

    return NextResponse.json(blob);

  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { message: 'Error uploading file' },
      { status: 500 }
    );
  }
}
