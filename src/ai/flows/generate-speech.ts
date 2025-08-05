'use server';

/**
 * @fileOverview An text-to-speech AI agent using OpenAI.
 * This flow generates audio from text.
 *
 * - generateSpeech - A function that handles the text-to-speech process.
 */
import { ai } from '@/ai/genkit';
import { GenerateSpeechInputSchema, GenerateSpeechOutputSchema } from '@/ai/schemas';
import { z } from 'genkit';

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

    const { media } = await ai.generate({
      model: 'openai/tts-1',
      prompt: input.text,
      config: {
        voice: input.voice,
        speed: input.speakingRate || 1.0,
      },
      output: {
        format: 'url'
      }
    });

    if (!media?.url) {
        throw new Error('No media URL returned from OpenAI. Check OpenAI API response.');
    }

    try {
        const audioResponse = await fetch(media.url);
        if (!audioResponse.ok) {
            const errorBody = await audioResponse.text();
            throw new Error(`Failed to fetch audio from OpenAI URL: ${audioResponse.statusText} (Status: ${audioResponse.status}) - ${errorBody}`);
        }

        const audioBuffer = await audioResponse.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString('base64');
        const audioDataUri = `data:audio/mp3;base64,${base64Audio}`;

        const result: z.infer<typeof GenerateSpeechOutputSchema> = {
            audioDataUri: audioDataUri,
        };

        return result;

    } catch (fetchError: any) {
        console.error("Error fetching or processing audio from OpenAI URL:", fetchError);
        throw new Error(`Could not process audio: ${fetchError.message}`);
    }
  }
);
