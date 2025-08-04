'use server';

/**
 * @fileOverview A text-to-speech AI agent using OpenAI.
 * This flow is now simplified to only handle audio generation.
 * Sentence timing estimation is handled on the client-side.
 *
 * - generateSpeech - A function that handles the text-to-speech process.
 */
import { ai } from '@/ai/genkit';
import { GenerateSpeechInputSchema, GenerateSpeechOutputSchema } from '@/ai/schemas';

export const generateSpeech = ai.defineFlow(
  {
    name: 'generateSpeech',
    inputSchema: GenerateSpeechInputSchema,
    outputSchema: GenerateSpeechOutputSchema,
  },
  async (input) => {
    
    // Generate speech from the text using OpenAI
    const { media: audioMedia } = await ai.generate({
      model: 'openai/tts-1',
      prompt: input.text,
      config: {
        voice: input.voice,
        speed: input.speakingRate || 1.0,
        response_format: 'wav',
      },
      output: {
        format: 'url'
      }
    });

    if (!audioMedia || !audioMedia.url) {
        throw new Error('No media URL returned from OpenAI. Check OpenAI API response.');
    }

    try {
        const audioResponse = await fetch(audioMedia.url);
        if (!audioResponse.ok) {
            const errorBody = await audioResponse.text();
            throw new Error(`Failed to fetch audio from OpenAI URL: ${audioResponse.statusText} (Status: ${audioResponse.status}) - ${errorBody}`);
        }

        const audioBuffer = await audioResponse.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString('base64');
        const audioDataUri = `data:audio/wav;base64,${base64Audio}`;

        return {
            audioDataUri: audioDataUri,
        };

    } catch (fetchError: any) {
        console.error("Error fetching or processing audio from OpenAI URL:", fetchError);
        throw new Error(`Could not process audio: ${fetchError.message}`);
    }
  }
);
