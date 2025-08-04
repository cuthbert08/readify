'use server';

/**
 * @fileOverview An AI agent for creating a glossary from a document.
 *
 * - generateGlossary - A function that identifies key terms and defines them.
 * - GenerateGlossaryInput - The input type for the generateGlossary function.
 * - GenerateGlossaryOutput - The return type for the generateGlossary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateGlossaryInputSchema = z.object({
  documentText: z.string().describe('The full text content of the document.'),
});
export type GenerateGlossaryInput = z.infer<typeof GenerateGlossaryInputSchema>;

const GlossaryItemSchema = z.object({
    term: z.string().describe("The key term or phrase."),
    definition: z.string().describe("A concise definition of the term.")
});

const GenerateGlossaryOutputSchema = z.object({
  glossary: z.array(GlossaryItemSchema).describe('A list of key terms and their definitions from the document.'),
});
export type GenerateGlossaryOutput = z.infer<typeof GenerateGlossaryOutputSchema>;
export type GlossaryItem = z.infer<typeof GlossaryItemSchema>;

export async function generateGlossary(input: GenerateGlossaryInput): Promise<GenerateGlossaryOutput> {
  return generateGlossaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateGlossaryPrompt',
  input: {schema: GenerateGlossaryInputSchema},
  output: {schema: GenerateGlossaryOutputSchema},
  prompt: `You are an expert analyst. Your task is to read the following document and create a glossary of important terms.
  Identify key terms, concepts, and acronyms. For each item, provide a clear and concise definition based on its context within the document.

  Document Text:
  ---
  {{{documentText}}}
  ---
  `,
});

const generateGlossaryFlow = ai.defineFlow(
  {
    name: 'generateGlossaryFlow',
    inputSchema: GenerateGlossaryInputSchema,
    outputSchema: GenerateGlossaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
