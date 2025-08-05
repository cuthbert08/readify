// app/api/generate-speech/route.ts
import { NextResponse } from 'next/server';
import { generateSpeech } from '@/ai/flows/generate-speech';
import { GenerateSpeechInputSchema } from '@/ai/schemas';

export async function POST(req: Request) {
  try {
    const { text, voice, speakingRate } = GenerateSpeechInputSchema.parse(await req.json());
    
    const result = await generateSpeech({ text, voice, speakingRate });

    return NextResponse.json(result);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to generate speech' }, { status: 500 });
  }
}