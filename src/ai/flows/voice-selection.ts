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
    displayName: z.string(),
    gender: z.string(),
  })
);
export type AvailableVoicesOutput = z.infer<typeof AvailableVoicesOutputSchema>;

const availableVoices = [
    { name: 'alloy', displayName: 'Alloy', gender: 'Neutral' },
    { name: 'echo', displayName: 'Echo', gender: 'Male' },
    { name: 'fable', displayName: 'Fable', gender: 'Male' },
    { name: 'onyx', displayName: 'Onyx', gender: 'Male' },
    { name: 'nova', displayName: 'Nova', gender: 'Female' },
    { name: 'shimmer', displayName: 'Shimmer', gender: 'Female' },
];

export async function getAvailableVoices(): Promise<AvailableVoicesOutput> {
  return availableVoices;
}
