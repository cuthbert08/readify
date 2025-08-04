'use server';

/**
 * @fileOverview Implements a Genkit flow for voice selection in a text-to-speech application.
 *
 * Exports:
 *   - `getAvailableVoices`: Retrieves a list of available voices.
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

// OpenAI TTS-1 voices
const availableVoices = [
  { name: 'alloy', lang: 'en-US' },
  { name: 'echo', lang: 'en-US' },
  { name: 'fable', lang: 'en-US' },
  { name: 'onyx', lang: 'en-US' },
  { name: 'nova', lang: 'en-US' },
  { name: 'shimmer', lang: 'en-US' },
  { name: 'Default', lang: 'en-US' }, // Placeholder for default browser voice if needed elsewhere
];

export async function getAvailableVoices(): Promise<AvailableVoicesOutput> {
  return availableVoices.filter(v => v.name !== 'Default');
}
