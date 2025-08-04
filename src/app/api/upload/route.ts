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

  try {
    // The Vercel Blob SDK now returns a different object structure.
    // We need to request a presigned URL for the client to upload to.
    const blob = await put(blobName, '', {
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
