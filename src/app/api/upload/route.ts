import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getSession } from '@/lib/session';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  const session = await getSession();
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
  
  const blobName = `${session.userId}/${randomUUID()}-${originalFilename}`;

  try {
    const blob = await put(blobName, request.body, {
      access: 'public',
      addRandomSuffix: false, // We've added a UUID, so this isn't needed
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
