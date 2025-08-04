import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {openai} from 'genkitx-openai';

export const ai = genkit({
  plugins: [
    googleAI(),
    openai()
  ],
  model: 'googleai/gemini-2.0-flash',
});
