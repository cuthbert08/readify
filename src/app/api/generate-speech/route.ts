// app/api/generate-speech/route.ts
import { NextResponse } from 'next/server';
import { generateSpeech } from '@/ai/flows/generate-speech';
import { GenerateSpeechInputSchema } from '@/ai/schemas';

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { text, voice, speakingRate } = GenerateSpeechInputSchema.parse(json);
    
    const result = await generateSpeech({ text, voice, speakingRate });

    return NextResponse.json(result);
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate speech';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
