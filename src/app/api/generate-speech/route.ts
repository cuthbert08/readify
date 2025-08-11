// app/api/generate-speech/route.ts
import { NextResponse } from 'next/server';
import { generateSpeech } from '@/ai/flows/generate-speech';
import { GenerateSpeechInputSchema } from '@/ai/schemas';

export async function POST(req: Request) {
  const signal = req.signal;
  try {
    const json = await req.json();
    const input = GenerateSpeechInputSchema.parse(json);
    
    // Pass the signal to the flow execution context
    const result = await generateSpeech(input, { signal });

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('API Error:', error);
    // Ensure that even in case of an error, a proper JSON response is sent.
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate speech';
    if (error.name === 'AbortError') {
        return NextResponse.json({ error: 'Request cancelled' }, { status: 499 });
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
