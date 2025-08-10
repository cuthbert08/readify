
'use server';

/**
 * @fileOverview An text-to-speech AI agent using OpenAI.
 * This flow generates audio from text, supporting long inputs by splitting them into chunks.
 * It returns an array of audio data URIs to be concatenated on the client.
 *
 * - generateSpeech - A function that handles the text-to-speech process.
 */
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

        // Find the last sentence-ending punctuation
        const sentenceEnders = ['.', '?', '!', '\n'];
        for (const p of sentenceEnders) {
            const pos = chunk.lastIndexOf(p);
            if (pos > lastSentenceEnd) {
                lastSentenceEnd = pos;
            }
        }

        if (lastSentenceEnd !== -1) {
            // Split at the end of the sentence
            chunk = remainingText.substring(0, lastSentenceEnd + 1);
        }

        chunks.push(chunk);
        remainingText = remainingText.substring(chunk.length);
    }

    return chunks.filter(chunk => chunk.trim().length > 0);
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

    console.log('--- Starting speech generation flow ---');

    // Step 1: Format the text for better speech quality
    console.log('Formatting text for speech...');
    const { formattedText } = await formatTextForSpeech({ rawText: input.text });

    const textChunks = splitText(formattedText, 4000);
    const audioDataUris: string[] = [];

    try {
        console.log(`Generated ${textChunks.length} text chunks from formatted text.`);
        
        // Generate audio for each chunk in parallel
        const audioGenerationPromises = textChunks.map(async (chunk, index) => {
            const { media } = await ai.generate({
                model: 'openai/tts-1',
                prompt: chunk,
                config: {
                    voice: input.voice,
                    speed: input.speakingRate || 1.0,
                },
                output: { format: 'url' }
            });

            if (!media?.url) {
                throw new Error(`OpenAI failed to return audio for chunk ${index}.`);
            }
            
            // Instead of saving to a file, fetch and convert to a data URI directly
            const audioResponse = await fetch(media.url);
            if (!audioResponse.ok) {
                throw new Error(`Failed to fetch audio from OpenAI URL for chunk ${index}. Status: ${audioResponse.status}`);
            }
            const audioBuffer = await audioResponse.arrayBuffer();
            const base64Audio = Buffer.from(audioBuffer).toString('base64');
            return `data:audio/mp3;base64,${base64Audio}`;
        });

        const generatedUris = await Promise.all(audioGenerationPromises);
        audioDataUris.push(...generatedUris);

        console.log(`Generated ${audioDataUris.length} audio data URIs.`);
        
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
