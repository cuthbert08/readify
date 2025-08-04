'use server';
/**
 * @fileOverview A text-to-speech AI agent using OpenAI.
 *
 * - generateSpeech - A function that handles the text-to-speech process.
 * - GenerateSpeechInput - The input type for the generateSpeech function.
 * - GenerateSpeechOutput - The return type for the generateSpeech function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { openAI } from 'genkitx-openai';

const GenerateSpeechInputSchema = z.object({
  text: z.string().describe('The text to be converted to speech.'),
  voice: z.string().describe('The voice to use for the speech synthesis.'),
  speakingRate: z.number().min(0.25).max(3.0).optional().describe('The speaking rate, where 1.0 is the normal speed.'),
});
export type GenerateSpeechInput = z.infer<typeof GenerateSpeechInputSchema>;

const GenerateSpeechOutputSchema = z.object({
  audioDataUri: z.string().describe("A data URI of the generated audio file. Expected format: 'data:audio/mp3;base64,<encoded_data>'."),
});
export type GenerateSpeechOutput = z.infer<typeof GenerateSpeechOutputSchema>;


const ttsFlow = ai.defineFlow(
  {
    name: 'ttsFlow',
    inputSchema: GenerateSpeechInputSchema,
    outputSchema: GenerateSpeechOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
      model: openAI.model('tts-1'),
      prompt: input.text,
      config: {
        voice: input.voice as any,
        speed: input.speakingRate,
        response_format: 'mp3', // OpenAI TTS returns MP3
      },
      output: {
        format: 'url' // Get the Base64 data URI
      }
    });

    if (!media) {
      throw new Error('no media returned');
    }

    return {
      audioDataUri: media.url,
    };
  }
);


export async function generateSpeech(input: GenerateSpeechInput): Promise<GenerateSpeechOutput> {
  return ttsFlow(input);
}

export async function previewSpeech(input: Omit<GenerateSpeechInput, 'text' | 'speakingRate'>): Promise<GenerateSpeechOutput> {
  return ttsFlow({
    ...input,
    text: "Hello! This is a preview of my voice.",
    speakingRate: 1.0,
  });
}
