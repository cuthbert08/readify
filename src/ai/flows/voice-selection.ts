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
    { name: 'text-to-speech/en-US-Standard-A', displayName: 'Standard A', gender: 'Female' },
    { name: 'text-to-speech/en-US-Standard-B', displayName: 'Standard B', gender: 'Male' },
    { name: 'text-to-speech/en-US-Standard-C', displayName: 'Standard C', gender: 'Female' },
    { name: 'text-to-speech/en-US-Standard-D', displayName: 'Standard D', gender: 'Male' },
    { name: 'text-to-speech/en-US-Standard-E', displayName: 'Standard E', gender: 'Female' },
    { name: 'text-to-speech/en-US-Standard-F', displayName: 'Standard F', gender: 'Female' },
    { name: 'text-to-speech/en-US-Standard-G', displayName: 'Standard G', gender: 'Female' },
    { name: 'text-to-speech/en-US-Standard-H', displayName: 'Standard H', gender: 'Female' },
    { name: 'text-to-speech/en-US-Standard-I', displayName: 'Standard I', gender: 'Male' },
    { name: 'text-to-speech/en-US-Standard-J', displayName: 'Standard J', gender: 'Male' },
];

export async function getAvailableVoices(): Promise<AvailableVoicesOutput> {
  return availableVoices;
}
