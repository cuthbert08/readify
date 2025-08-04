'use server';
/**
 * @fileOverview A text-to-speech AI agent for previewing voices.
 *
 * - previewSpeech - A function that handles the voice preview generation.
 */

import { ai } from '@/ai/genkit';
import { openAI } from 'genkitx-openai';
import { PreviewSpeechInputSchema, PreviewSpeechOutputSchema } from '@/ai/schemas';

export const previewSpeech = ai.defineFlow(
  {
    name: 'previewSpeech',
    inputSchema: PreviewSpeechInputSchema,
    outputSchema: PreviewSpeechOutputSchema,
  },
  async (input) => {
    
    const { media } = await ai.generate({
      model: 'openai/tts-1',
      prompt: "Hello! This is a preview of my voice.",
      config: {
        voice: input.voice,
        speed: 1.0,
        response_format: 'mp3',
      },
      output: {
        format: 'url'
      }
    });

    if (!media || !media.url) {
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

        return {
            audioDataUri: audioDataUri,
        };
    } catch (fetchError: any) {
        console.error("Error fetching or processing audio from OpenAI URL:", fetchError);
        throw new Error(`Could not process audio: ${fetchError.message}`);
    }
  }
);
