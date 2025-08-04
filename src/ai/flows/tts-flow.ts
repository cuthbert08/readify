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

const validVoices = z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']);

const GenerateSpeechInputSchema = z.object({
  text: z.string().describe('The text to be converted to speech.'),
  voice: validVoices.describe('The voice to use for the speech synthesis.'),
  speakingRate: z.number().min(0.25).max(3.0).optional().describe('The speaking rate, where 1.0 is the normal speed.'),
});
export type GenerateSpeechInput = z.infer<typeof GenerateSpeechInputSchema>;


const PreviewSpeechInputSchema = z.object({
    voice: validVoices.describe('The voice to use for the speech synthesis.'),
});
export type PreviewSpeechInput = z.infer<typeof PreviewSpeechInputSchema>;


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
        voice: input.voice,
        speed: input.speakingRate || 1.0,
      },
      output: {
        format: 'url' // Get the Base64 data URI
      }
    });

    if (!media || !media.url) {
        throw new Error('No media URL returned from OpenAI. Check OpenAI API response.');
    }

    // The URL from OpenAI is temporary. We must fetch it and convert to a data URI.
    try {
        const audioResponse = await fetch(media.url);
        if (!audioResponse.ok) {
            throw new Error(`Failed to fetch audio from OpenAI URL: ${audioResponse.statusText} (Status: ${audioResponse.status})`);
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


export async function generateSpeech(input: GenerateSpeechInput): Promise<GenerateSpeechOutput> {
  return ttsFlow(input);
}

export async function previewSpeech(input: PreviewSpeechInput): Promise<GenerateSpeechOutput> {
    return ttsFlow({
        text: "Hello! This is a preview of my voice.",
        voice: input.voice,
        speakingRate: 1.0
    })
}
