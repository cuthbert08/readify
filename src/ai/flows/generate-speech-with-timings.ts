
'use server';

/**
 * @fileOverview An advanced text-to-speech AI agent using OpenAI.
 * This flow generates audio and provides precise word-level timing information.
 *
 * - generateSpeechWithTimings - A function that handles the text-to-speech process.
 */
import { ai } from '@/ai/genkit';
import { GenerateSpeechWithTimingsInputSchema, GenerateSpeechWithTimingsOutputSchema } from '@/ai/schemas';
import { z } from 'genkit';

export const generateSpeechWithTimingsFlow = ai.defineFlow(
  {
    name: 'generateSpeechWithTimingsFlow',
    inputSchema: GenerateSpeechWithTimingsInputSchema,
    outputSchema: GenerateSpeechWithTimingsOutputSchema,
  },
  async (input) => {
    
    if (!input.text || !input.text.trim()) {
        throw new Error("Input text cannot be empty.");
    }

    // Generate speech from the text using OpenAI, requesting word-level timestamps
    const { media, content, finishReason } = await ai.generate({
      model: 'openai/tts-1-hd',
      prompt: input.text,
      config: {
        voice: input.voice,
        speed: input.speakingRate || 1.0,
        response_format: 'mp3',
        extra_body: {
            timestamp_granularities: ["word"]
        }
      },
      output: {
        format: 'url'
      }
    });

    if (finishReason !== 'stop' || !media?.url || !content) {
        throw new Error('No media URL returned from OpenAI. Check OpenAI API response.');
    }

    const timingData = content.find(part => part.data?.words)?.data;
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

        const result: z.infer<typeof GenerateSpeechWithTimingsOutputSchema> = {
            audioDataUri: audioDataUri,
            words: timingData.words,
        };

        return result;

    } catch (fetchError: any) {
        console.error("Error fetching or processing audio from OpenAI URL:", fetchError);
        throw new Error(`Could not process audio: ${fetchError.message}`);
    }
  }
);
