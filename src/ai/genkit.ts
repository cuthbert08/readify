import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
// import {openAI} from '@genkit-ai/openai';

export const ai = genkit({
  plugins: [
    googleAI(),
    // openAI({
    //     apiKey: process.env.OPENAI_API_KEY,
    // })
  ],
  model: 'googleai/gemini-2.0-flash',
});
