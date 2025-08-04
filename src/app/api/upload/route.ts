import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { getSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { filename } = await request.json();
  const blobName = `${session.userId}/${filename}`;

  // The Vercel Blob SDK needs the request body as a readable stream
  // when used in a Node.js environment. We'll pass `request.body` directly.
  if (!request.body) {
    return NextResponse.json(
      { message: 'Request body is missing' },
      { status: 400 }
    );
  }

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
