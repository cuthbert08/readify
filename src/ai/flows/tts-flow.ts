'use server';
/**
 * @fileOverview A text-to-speech AI agent.
 *
 * - generateSpeech - A function that handles the text-to-speech process.
 * - GenerateSpeechInput - The input type for the generateSpeech function.
 * - GenerateSpeechOutput - The return type for the generateSpeech function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
// import { openAI } from '@genkit-ai/openai';

const GenerateSpeechInputSchema = z.object({
  text: z.string().describe('The text to be converted to speech.'),
  voice: z.string().describe('The voice to use for the speech synthesis.'),
});
export type GenerateSpeechInput = z.infer<typeof GenerateSpeechInputSchema>;

const GenerateSpeechOutputSchema = z.object({
  audioDataUri: z.string().describe("A data URI of the generated audio file. Expected format: 'data:audio/mpeg;base64,<encoded_data>'."),
});
export type GenerateSpeechOutput = z.infer<typeof GenerateSpeechOutputSchema>;

export async function generateSpeech(input: GenerateSpeechInput): Promise<GenerateSpeechOutput> {
  // Since the OpenAI plugin is causing issues, we'll return an empty response for now.
  // This allows the rest of the application to function.
  console.warn("OpenAI TTS is currently disabled due to a package installation issue.");
  return { audioDataUri: '' };
  // return ttsFlow(input);
}

/*
const ttsFlow = ai.defineFlow(
  {
    name: 'ttsFlow',
    inputSchema: GenerateSpeechInputSchema,
    outputSchema: GenerateSpeechOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
      model: openAI.tts1(),
      prompt: input.text,
      config: {
        voice: input.voice as any, // alloy, echo, fable, onyx, nova, and shimmer
      },
    });

    if (!media) {
      throw new Error('no media returned');
    }
    
    return {
      audioDataUri: media.url,
    };
  }
);
*/
