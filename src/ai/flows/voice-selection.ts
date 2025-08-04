'use server';

/**
 * @fileOverview Implements a Genkit flow for voice selection in a text-to-speech application.
 *
 * Exports:
 *   - `getAvailableVoices`: Retrieves a list of available voices from OpenAI.
 *   - `AvailableVoicesOutput`: The output type for available voices.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AvailableVoicesOutputSchema = z.array(
  z.object({
    name: z.string(),
    gender: z.string(),
  })
);
export type AvailableVoicesOutput = z.infer<typeof AvailableVoicesOutputSchema>;

const availableVoices = [
  { name: 'alloy', gender: 'male' },
  { name: 'echo', gender: 'male' },
  { name: 'fable', gender: 'male' },
  { name: 'onyx', gender: 'male' },
  { name: 'nova', gender: 'female' },
  { name: 'shimmer', gender: 'female' },
];

export async function getAvailableVoices(): Promise<AvailableVoicesOutput> {
  return availableVoices;
}
