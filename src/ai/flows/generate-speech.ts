
'use server';

/**
 * @fileOverview An text-to-speech AI agent using multiple providers.
 * This flow generates audio from text, supporting long inputs by splitting them into chunks.
 * It returns an array of audio data URIs to be concatenated on the client.
 *
 * - generateSpeech - A function that handles the text-to-speech process.
 */
import 'dotenv/config';
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { GenerateSpeechInputSchema, GenerateSpeechOutputSchema } from '@/ai/schemas';
import { formatTextForSpeech } from './format-text-for-speech';
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
    writer.on('data', (d) => bufs.push(d));
    writer.on('end', () => resolve(Buffer.concat(bufs).toString('base64')));
    writer.write(pcmData);
    writer.end();
  });
}

// Function to split text into chunks without breaking sentences
function splitText(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let remainingText = text;

    while (remainingText.length > 0) {
        if (remainingText.length <= maxLength) {
            chunks.push(remainingText);
            break;
        }

        let chunk = remainingText.substring(0, maxLength);
        let lastSentenceEnd = -1;

        const sentenceEnders = ['.', '?', '!', '\n'];
        for (const p of sentenceEnders) {
            const pos = chunk.lastIndexOf(p);
            if (pos > lastSentenceEnd) {
                lastSentenceEnd = pos;
            }
        }

        if (lastSentenceEnd !== -1) {
            chunk = remainingText.substring(0, lastSentenceEnd + 1);
        }

        chunks.push(chunk);
        remainingText = remainingText.substring(chunk.length);
    }

    return chunks.filter(chunk => chunk.trim().length > 0);
}

async function generateOpenAI(textChunks: string[], voice: string, speed: number) {
    const audioGenerationPromises = textChunks.map(async (chunk) => {
        const { media } = await ai.generate({
            model: 'openai/tts-1',
            prompt: chunk,
            config: { voice: voice as any, speed },
            output: { format: 'url' }
        });
        if (!media?.url) throw new Error('OpenAI failed to return audio.');
        
        const audioResponse = await fetch(media.url);
        if (!audioResponse.ok) throw new Error('Failed to fetch audio from OpenAI URL.');
        const audioBuffer = await audioResponse.arrayBuffer();
        return `data:audio/mp3;base64,${Buffer.from(audioBuffer).toString('base64')}`;
    });
    return Promise.all(audioGenerationPromises);
}

async function generateGoogle(textChunks: string[], voice: string, speed: number) {
    const audioGenerationPromises = textChunks.map(async (chunk) => {
        const { media } = await ai.generate({
            model: googleAI.model('gemini-2.5-flash-preview-tts'),
            prompt: chunk,
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
                    speed,
                },
            },
        });
        if (!media?.url) throw new Error('Google failed to return audio.');
        
        const audioBuffer = Buffer.from(media.url.substring(media.url.indexOf(',') + 1), 'base64');
        const wavBase64 = await toWav(audioBuffer);
        return `data:audio/wav;base64,${wavBase64}`;
    });
    return Promise.all(audioGenerationPromises);
}

async function generateAmazon(textChunks: string[], voice: string, speed: number) {
    const pollyUrl = process.env.AMAZON_POLLY_API_URL;
    if (!pollyUrl) throw new Error('Amazon Polly API URL is not configured.');

    const audioGenerationPromises = textChunks.map(async (chunk) => {
        const response = await fetch(pollyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: chunk,
                voiceId: voice,
            }),
        });
        if (!response.ok) throw new Error(`Failed to get audio from Amazon Polly: ${response.statusText}`);
        const { audio } = await response.json();
        if (!audio) throw new Error('Amazon Polly response did not include audio data.');
        return `data:audio/mp3;base64,${audio}`;
    });
    return Promise.all(audioGenerationPromises);
}

export const generateSpeech = ai.defineFlow(
  {
    name: 'generateSpeech',
    inputSchema: GenerateSpeechInputSchema,
    outputSchema: GenerateSpeechOutputSchema,
  },
  async (input) => {
    
    if (!input.text || !input.text.trim()) {
        throw new Error("Input text cannot be empty.");
    }
    
    try {
        console.log('--- Starting speech generation flow ---');

        const { formattedText } = await formatTextForSpeech({ rawText: input.text });
        
        // Amazon Polly & Google have a limit of ~3000 chars. Let's use 2500 to be safe.
        // OpenAI limits are higher, so this is a safe value for all.
        const textChunks = splitText(formattedText, 2500);
        console.log(`Generated ${textChunks.length} text chunks.`);
        
        const [provider, voiceName] = input.voice.split('/');
        const speakingRate = input.speakingRate || 1.0;
        let audioDataUris: string[] = [];

        switch (provider) {
            case 'openai':
                audioDataUris = await generateOpenAI(textChunks, voiceName, speakingRate);
                break;
            case 'google':
                audioDataUris = await generateGoogle(textChunks, voiceName, speakingRate);
                break;
            case 'amazon':
                audioDataUris = await generateAmazon(textChunks, voiceName, speakingRate);
                break;
            default:
                throw new Error(`Unsupported voice provider: ${provider}`);
        }

        if (audioDataUris.length === 0) {
            throw new Error("No audio was generated.");
        }

        return { audioDataUris };

    } catch (error: any) {
        console.error("Error in generateSpeech flow:", error);
        throw new Error(`Failed to generate speech: ${error.message}`);
    }
  }
);
