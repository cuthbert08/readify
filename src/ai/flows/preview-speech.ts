
'use server';
/**
 * @fileOverview A text-to-speech AI agent for previewing voices from multiple providers.
 *
 * - previewSpeech - A function that handles the voice preview generation.
 */
import 'dotenv/config';
import { ai } from '@/ai/genkit';
import { PreviewSpeechInputSchema, PreviewSpeechOutputSchema } from '@/ai/schemas';

async function handleOpenAIPreview(voice: string) {
    const { media } = await ai.generate({
      model: 'openai/tts-1',
      prompt: "Hello! This is a preview of my voice.",
      config: { voice: voice as any },
      output: { format: 'url' }
    });

    if (!media || !media.url) {
        throw new Error('No media URL returned from OpenAI.');
    }
    const audioResponse = await fetch(media.url);
    if (!audioResponse.ok) throw new Error('Failed to fetch audio from OpenAI URL.');
    
    const audioBuffer = await audioResponse.arrayBuffer();
    return `data:audio/mp3;base64,${Buffer.from(audioBuffer).toString('base64')}`;
}

async function handleAmazonPreview(voice: string) {
    const pollyUrl = process.env.AMAZON_POLLY_API_URL;
    if (!pollyUrl) throw new Error('Amazon Polly API URL is not configured.');
    
    const response = await fetch(pollyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: 'Hello! This is a preview of my voice.',
            voiceId: voice,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Amazon Polly Lambda Error (Preview):", errorBody);
        throw new Error(`Failed to get audio from Amazon Polly: ${errorBody}`);
    }
    
    const { audioChunks } = await response.json();
    if (!audioChunks || !Array.isArray(audioChunks) || audioChunks.length === 0) {
        throw new Error('Amazon Polly response did not include audio data.');
    }

    // For a preview, we only need the first chunk.
    return `data:audio/mp3;base64,${audioChunks[0]}`;
}


export const previewSpeech = ai.defineFlow(
  {
    name: 'previewSpeech',
    inputSchema: PreviewSpeechInputSchema,
    outputSchema: PreviewSpeechOutputSchema,
  },
  async (input) => {
    
    const [provider, voiceName] = input.voice.split('/');
    let audioDataUri = '';
    
    try {
        switch (provider) {
            case 'openai':
                audioDataUri = await handleOpenAIPreview(voiceName);
                break;
            case 'amazon':
                audioDataUri = await handleAmazonPreview(voiceName);
                break;
            default:
                throw new Error(`Unsupported voice provider: ${provider}`);
        }
        
        return { audioDataUri };
    } catch (error) {
        console.error("Error in previewSpeech flow:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        throw new Error(`Could not process voice preview: ${message}`);
    }
  }
);
