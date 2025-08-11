
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
import { GenerateSpeechInputSchema, GenerateSpeechOutputSchema, GenerateSpeechInput } from '@/ai/schemas';
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

        // Prioritize splitting at sentence-ending punctuation.
        const sentenceEnders = ['.', '?', '!', '\n'];
        for (const p of sentenceEnders) {
            const pos = chunk.lastIndexOf(p);
            // Ensure the punctuation is not part of a larger structure like "e.g."
            if (pos > -1 && (remainingText[pos + 1] === ' ' || remainingText[pos + 1] === '\n' || pos === chunk.length - 1)) {
                lastSentenceEnd = Math.max(lastSentenceEnd, pos);
            }
        }

        // If a sentence end is found, split there. Otherwise, split at the last space to avoid breaking words.
        let splitIndex;
        if (lastSentenceEnd !== -1) {
            splitIndex = lastSentenceEnd + 1;
        } else {
            const lastSpace = chunk.lastIndexOf(' ');
            splitIndex = lastSpace !== -1 ? lastSpace : maxLength; // Fallback to hard split if no space
        }
        
        chunk = remainingText.substring(0, splitIndex);
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

// Helper to introduce a delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateAmazon(textChunks: string[], voice: string, speed: number) {
    const pollyUrl = process.env.AMAZON_POLLY_API_URL;
    if (!pollyUrl) throw new Error('Amazon Polly API URL is not configured.');

    const audioUris: string[] = [];

    // Process chunks sequentially with a small delay to avoid overwhelming the API
    for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i];
        console.log(`[Amazon Polly] Processing chunk ${i + 1}/${textChunks.length}, length: ${chunk.length}`);

        const response = await fetch(pollyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: chunk,
                voiceId: voice,
                speakingRate: speed,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to get audio from Amazon Polly: ${errorBody}`);
        }

        const { audio } = await response.json();
        if (!audio) {
            throw new Error('Amazon Polly response did not include audio data.');
        }

        audioUris.push(`data:audio/mp3;base64,${audio}`);

        // Add a small delay between requests to avoid rate limiting issues
        if (i < textChunks.length - 1) {
            await sleep(200); 
        }
    }

    return audioUris;
}

// This function can be directly called from client components as a Server Action.
export async function generateSpeech(
  input: GenerateSpeechInput
): Promise<GenerateSpeechOutputSchema> {
    
    if (!input.text || !input.text.trim()) {
        throw new Error("Input text cannot be empty.");
    }

    try {
        console.log('--- Starting speech generation ---');

        const { formattedText } = await formatTextForSpeech({ rawText: input.text });
        
        // Use a safer character limit for Polly. OpenAI's is 4096.
        const textChunks = splitText(formattedText, 2800);
        console.log(`Generated ${textChunks.length} text chunks.`);
        
        const [provider, voiceName] = input.voice.split('/');
        const speakingRate = input.speakingRate || 1.0;
        let audioDataUris: string[] = [];

        switch (provider) {
            case 'openai':
                audioDataUris = await generateOpenAI(textChunks, voiceName, speakingRate);
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
        console.error("Error in generateSpeech action:", error);
        // Re-throw the error so the client can catch it.
        throw new Error(`Failed to generate speech: ${error.message}`);
    }
}
