'use server';

/**
 * @fileOverview An AI agent for explaining selected text.
 *
 * - explainText - A function that provides an explanation for a given text snippet.
 * - ExplainTextInput - The input type for the explainText function.
 * - ExplainTextOutput - The return type for the explainText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExplainTextInputSchema = z.object({
  text: z.string().describe('The text to be explained.'),
  context: z.string().optional().describe('The surrounding text for context.'),
});
export type ExplainTextInput = z.infer<typeof ExplainTextInputSchema>;

const ExplainTextOutputSchema = z.object({
  explanation: z.string().describe('A simple explanation of the provided text.'),
});
export type ExplainTextOutput = z.infer<typeof ExplainTextOutputSchema>;

export async function explainText(input: ExplainTextInput): Promise<ExplainTextOutput> {
  return explainTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'explainTextPrompt',
  input: {schema: ExplainTextInputSchema},
  output: {schema: ExplainTextOutputSchema},
  prompt: `You are a helpful assistant who is an expert at simplifying complex topics.
  A user has selected a piece of text and wants an explanation.
  Provide a clear, concise, and easy-to-understand explanation of the following text.
  If the user provides surrounding text for context, use it to tailor your explanation.

  Text to Explain:
  ---
  {{{text}}}
  ---
  
  Surrounding Context (if any):
  ---
  {{{context}}}
  ---
  `,
});

const explainTextFlow = ai.defineFlow(
  {
    name: 'explainTextFlow',
    inputSchema: ExplainTextInputSchema,
    outputSchema: ExplainTextOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
