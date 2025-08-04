'use server';

/**
 * @fileOverview An advanced text-to-speech AI agent using OpenAI.
 * This flow generates audio and provides precise word-level timing information.
 *
 * - generateSpeechWithTimings - A function that handles the text-to-speech process.
 */
import { ai } from '@/ai/genkit';
import { GenerateSpeechWithTimingsInputSchema, GenerateSpeechWithTimingsOutputSchema } from '@/ai/schemas';

export const generateSpeechWithTimings = ai.defineFlow(
  {
    name: 'generateSpeechWithTimings',
    inputSchema: GenerateSpeechWithTimingsInputSchema,
    outputSchema: GenerateSpeechWithTimingsOutputSchema,
  },
  async (input) => {
    
    if (!input.text || !input.text.trim()) {
        throw new Error("Input text cannot be empty.");
    }

    // Generate speech from the text using OpenAI, requesting word-level timestamps
    const { media, content } = await ai.generate({
      model: 'openai/tts-1-hd',
      prompt: input.text,
      config: {
        voice: input.voice,
        speed: input.speakingRate || 1.0,
        response_format: 'json', // Request JSON to get timing info
      },
      output: {
        format: 'url'
      }
    });

    if (!media || !media.url) {
        throw new Error('No media URL returned from OpenAI. Check OpenAI API response.');
    }

    // The 'content' part should contain the timing information
    const timingData = content[0]?.data;
    if (!timingData || !timingData.words) {
      throw new Error('Word timing information was not returned from the API.');
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

        return {
            audioDataUri: audioDataUri,
            words: timingData.words,
        };

    } catch (fetchError: any) {
        console.error("Error fetching or processing audio from OpenAI URL:", fetchError);
        throw new Error(`Could not process audio: ${fetchError.message}`);
    }
  }
);
