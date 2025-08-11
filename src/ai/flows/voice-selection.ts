
'use server';

/**
 * @fileOverview Implements a Genkit flow for voice selection in a text-to-speech application.
 *
 * Exports:
 *   - `getAvailableVoices`: Retrieves a list of available voices.
 *   - `AvailableVoice`: The type for an available voice.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const AvailableVoiceSchema = z.object({
  name: z.string().describe('The unique identifier for the voice, including provider.'),
  displayName: z.string().describe('The user-facing name for the voice.'),
  gender: z.string().describe('The gender of the voice.'),
  provider: z.enum(['openai', 'google', 'amazon']).describe('The TTS provider for the voice.'),
});
export type AvailableVoice = z.infer<typeof AvailableVoiceSchema>;

const availableVoices: AvailableVoice[] = [
    // OpenAI
    { name: 'openai/alloy', displayName: 'Alloy', gender: 'Neutral', provider: 'openai' },
    { name: 'openai/echo', displayName: 'Echo', gender: 'Male', provider: 'openai' },
    { name: 'openai/fable', displayName: 'Fable', gender: 'Male', provider: 'openai' },
    { name: 'openai/onyx', displayName: 'Onyx', gender: 'Male', provider: 'openai' },
    { name: 'openai/nova', displayName: 'Nova', gender: 'Female', provider: 'openai' },
    { name: 'openai/shimmer', displayName: 'Shimmer', gender: 'Female', provider: 'openai' },
    // Google
    { name: 'google/en-US-News-M', displayName: 'News-M (US)', gender: 'Male', provider: 'google' },
    { name: 'google/en-US-News-L', displayName: 'News-L (US)', gender: 'Female', provider: 'google' },
    { name: 'google/en-GB-News-G', displayName: 'News-G (UK)', gender: 'Female', provider: 'google' },
    { name: 'google/en-GB-Standard-A', displayName: 'Standard-A (UK)', gender: 'Female', provider: 'google' },
    { name: 'google/en-AU-Polyglot-1', displayName: 'Polyglot-1 (AU)', gender: 'Male', provider: 'google' },
    // Amazon Polly
    { name: 'amazon/Matthew', displayName: 'Matthew (US)', gender: 'Male', provider: 'amazon' },
    { name: 'amazon/Joanna', displayName: 'Joanna (US)', gender: 'Female', provider: 'amazon' },
    { name: 'amazon/Amy', displayName: 'Amy (UK)', gender: 'Female', provider: 'amazon' },
    { name: 'amazon/Brian', displayName: 'Brian (UK)', gender: 'Male', provider: 'amazon' },
    { name: 'amazon/Russell', displayName: 'Russell (AU)', gender: 'Male', provider: 'amazon' },
];

export async function getAvailableVoices(): Promise<AvailableVoice[]> {
  return availableVoices;
}
