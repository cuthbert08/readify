
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
import { GenerateSpeechInputSchema, GenerateSpeechOutputSchema } from '@/ai/schemas';
import { formatTextForSpeech } from './format-text-for-speech';

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

        if (lastSentenceEnd !== -1 && chunk.length > lastSentenceEnd) {
            chunk = remainingText.substring(0, lastSentenceEnd + 1);
        }

        chunks.push(chunk);
        remainingText = remainingText.substring(chunk.length);
    }

    return chunks.filter(chunk => chunk.trim().length > 0);
}

async function generateOpenAI(textChunks: string[], voice: string, speed: number, signal?: AbortSignal) {
    const audioGenerationPromises = textChunks.map(async (chunk) => {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const { media } = await ai.generate({
            model: 'openai/tts-1',
            prompt: chunk,
            config: { voice: voice as any, speed },
            output: { format: 'url' }
        });
        if (!media?.url) throw new Error('OpenAI failed to return audio.');
        
        const audioResponse = await fetch(media.url, { signal });
        if (!audioResponse.ok) throw new Error('Failed to fetch audio from OpenAI URL.');
        const audioBuffer = await audioResponse.arrayBuffer();
        return `data:audio/mp3;base64,${Buffer.from(audioBuffer).toString('base64')}`;
    });
    return Promise.all(audioGenerationPromises);
}

async function generateAmazon(textChunks: string[], voice: string, signal?: AbortSignal) {
    const pollyUrl = process.env.AMAZON_POLLY_API_URL;
    if (!pollyUrl) throw new Error('Amazon Polly API URL is not configured.');

    const audioGenerationPromises = textChunks.map(async (chunk) => {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const response = await fetch(pollyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: chunk,
                voiceId: voice,
            }),
            signal: signal,
        });
        if (!response.ok) throw new Error(`Failed to get audio from Amazon Polly: ${await response.text()}`);
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
  async (input, { onCancel, signal }) => {
    
    if (!input.text || !input.text.trim()) {
        throw new Error("Input text cannot be empty.");
    }
    
    onCancel(() => {
        console.log("GenerateSpeech flow is being cancelled.");
    });

    try {
        console.log('--- Starting speech generation flow ---');

        const { formattedText } = await formatTextForSpeech({ rawText: input.text });
        
        // Let's use 2500 to be safe for all providers.
        const textChunks = splitText(formattedText, 2500);
        console.log(`Generated ${textChunks.length} text chunks.`);
        
        const [provider, voiceName] = input.voice.split('/');
        const speakingRate = input.speakingRate || 1.0;
        let audioDataUris: string[] = [];

        switch (provider) {
            case 'openai':
                audioDataUris = await generateOpenAI(textChunks, voiceName, speakingRate, signal);
                break;
            case 'amazon':
                audioDataUris = await generateAmazon(textChunks, voiceName, signal);
                break;
            default:
                throw new Error(`Unsupported voice provider: ${provider}`);
        }

        if (signal.aborted) {
            throw new DOMException('Flow was cancelled', 'AbortError');
        }

        if (audioDataUris.length === 0) {
            throw new Error("No audio was generated.");
        }

        return { audioDataUris };

    } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log("GenerateSpeech flow was cancelled.");
          // Return an empty array or handle as needed for cancellation.
          return { audioDataUris: [] };
        }
        console.error("Error in generateSpeech flow:", error);
        throw new Error(`Failed to generate speech: ${error.message}`);
    }
  }
);
