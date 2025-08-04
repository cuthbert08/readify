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

const availableVoices = [
  { name: 'Algenib', lang: 'en-US' },
  { name: 'Achernar', lang: 'en-US' },
  { name: 'Enif', lang: 'en-US' },
  { name: 'Hadar', lang: 'en-US' },
  { name: 'Izar', lang: 'en-US' },
  { name: 'Keid', lang: 'en-US' },
  { name: 'Default', lang: 'en-US' },
];

export async function getAvailableVoices(): Promise<AvailableVoicesOutput> {
  return availableVoices.filter(v => v.name !== 'Default');
}
