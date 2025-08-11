
// app/api/generate-speech/route.ts
import { NextResponse } from 'next/server';
import { generateSpeech } from '@/ai/flows/generate-speech';
import { GenerateSpeechInputSchema } from '@/ai/schemas';
import { run } from '@genkit-ai/next';

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { text, voice, speakingRate } = GenerateSpeechInputSchema.parse(json);
    
    // The `run` function from `@genkit-ai/next` automatically handles streaming responses
    // and correctly manages the request lifecycle, including cancellation.
    return run(generateSpeech, { text, voice, speakingRate });

  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate speech';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
