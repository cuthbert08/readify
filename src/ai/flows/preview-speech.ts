
'use server';
/**
 * @fileOverview A text-to-speech AI agent for previewing voices from multiple providers.
 *
 * - previewSpeech - A function that handles the voice preview generation.
 */
import 'dotenv/config';
import { ai } from '@/ai/genkit';
import { PreviewSpeechInputSchema, PreviewSpeechOutputSchema } from '@/ai/schemas';
import { googleAI } from '@genkit-ai/googleai';
import wav from 'wav';

async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    let bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

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

async function handleGooglePreview(voice: string) {
    const { media } = await ai.generate({
        model: googleAI.model('gemini-2.5-flash-preview-tts'),
        prompt: 'Hello! This is a preview of my voice.',
        config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
            },
        },
    });

    if (!media?.url) throw new Error('No media URL returned from Google.');
    
    const audioBuffer = Buffer.from(media.url.substring(media.url.indexOf(',') + 1), 'base64');
    const wavBase64 = await toWav(audioBuffer);
    return `data:audio/wav;base64,${wavBase64}`;
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

    if (!response.ok) throw new Error('Failed to get audio from Amazon Polly.');
    const { audioUrl } = await response.json();
    // Return the full data URI, not just the URL from Polly.
    // The schema expects a data URI, but Polly returns a pre-signed URL.
    // We can just use the URL directly as the source for the audio element.
    return audioUrl;
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
            case 'google':
                audioDataUri = await handleGooglePreview(voiceName);
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
