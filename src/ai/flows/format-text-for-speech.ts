
'use server';

/**
 * @fileOverview An AI agent for formatting text for optimal text-to-speech (TTS) conversion.
 *
 * - formatTextForSpeech: Pre-processes text to make it sound more natural when read aloud.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const FormatTextForSpeechInputSchema = z.object({
  rawText: z.string().describe('The raw text to be formatted for speech.'),
});

const FormatTextForSpeechOutputSchema = z.object({
  formattedText: z.string().describe('The text, optimized for speech synthesis.'),
});

export async function formatTextForSpeech(
  input: z.infer<typeof FormatTextForSpeechInputSchema>
): Promise<z.infer<typeof FormatTextForSpeechOutputSchema>> {
  return formatTextForSpeechFlow(input);
}

const formatTextForSpeechPrompt = ai.definePrompt({
  name: 'formatTextForSpeechPrompt',
  input: { schema: FormatTextForSpeechInputSchema },
  output: { schema: FormatTextForSpeechOutputSchema },
  prompt: `You are an expert text formatter for a text-to-speech (TTS) engine.
Your task is to convert the given raw text into a clean, naturally-flowing version that is easy to read aloud.

Follow these rules:
1.  **Remove Artifacts**: Delete any repetitive headers, footers, page numbers, and irrelevant characters (like '>>>' from code blocks).
2.  **Code Formatting**: Convert code blocks into a readable format. For example, "const x = 10;" should be read as "const x equals 10 semicolon". Do not spell out every symbol unless necessary for clarity.
3.  **Mathematical Formatting**: Convert mathematical equations (like LaTeX) into descriptive English. For example, "\\int x^2 dx" should become "the integral of x squared dx".
4.  **Currency Formatting**: Expand currency symbols into words. For example, "$500" should become "five hundred dollars" and "€1,000" should become "one thousand euros".
5.  **General Flow**: Ensure the final text is grammatically correct and flows well for a listener. Preserve paragraph structure.

Raw Text:
---
{{{rawText}}}
---
`,
});

const formatTextForSpeechFlow = ai.defineFlow(
  {
    name: 'formatTextForSpeechFlow',
    inputSchema: FormatTextForSpeechInputSchema,
    outputSchema: FormatTextForSpeechOutputSchema,
  },
  async (input) => {
    const { output } = await formatTextForSpeechPrompt(input);
    return output!;
  }
);
