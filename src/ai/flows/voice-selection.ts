'use server';

/**
 * @fileOverview Implements a Genkit flow for voice selection in a text-to-speech application.
 *
 * Exports:
 *   - `getAvailableVoices`: Retrieves a list of available voices.
 *   - `setPreferredVoice`: Sets the user's preferred voice.
 *   - `getPreferredVoice`: Retrieves the user's preferred voice.
 *   - `AvailableVoicesOutput`: The output type for available voices.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AvailableVoicesOutputSchema = z.array(
  z.object({
    name: z.string(),
    lang: z.string(),
  })
);
export type AvailableVoicesOutput = z.infer<typeof AvailableVoicesOutputSchema>;

const PreferredVoiceInputSchema = z.string();
export type PreferredVoiceInput = z.infer<typeof PreferredVoiceInputSchema>;

// Placeholder for voice list (replace with actual implementation)
const availableVoices = [
  {name: 'Algenib', lang: 'en-US'},
  {name: 'Achernar', lang: 'en-GB'},
  {name: 'Default', lang: 'en-US'},
];

export async function getAvailableVoices(): Promise<AvailableVoicesOutput> {
  return availableVoices;
}

// Placeholder for storing preferred voice (replace with actual implementation)
let preferredVoice: string | null = null;

export async function setPreferredVoice(voice: PreferredVoiceInput): Promise<void> {
  preferredVoice = voice;
}

export async function getPreferredVoice(): Promise<string | null> {
  return preferredVoice;
}
