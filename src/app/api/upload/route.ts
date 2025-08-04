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
    const blob = await put(blobName, '', {
      access: 'public',
      addRandomSuffix: false,
    });
    
    // The SDK returns a presigned URL for upload, but we can construct the final URL directly.
    // This seems to be a nuance of how @vercel/blob works.
    const finalUrl = `https://${new URL(blob.url).hostname}/${blob.pathname}`;

    return NextResponse.json({ url: finalUrl, postUrl: blob.url });

  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { message: 'Error uploading file' },
      { status: 500 }
    );
  }
}
