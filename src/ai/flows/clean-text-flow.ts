'use server';

/**
 * @fileOverview An AI agent for cleaning up extracted PDF text.
 *
 * - cleanPdfText - A function that removes headers, footers, and other artifacts.
 * - CleanPdfTextInput - The input type for the cleanPdfText function.
 * - CleanPdfTextOutput - The return type for the cleanPdfText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CleanPdfTextInputSchema = z.object({
  rawText: z.string().describe('The raw text extracted from a PDF, including potential headers, footers, and page numbers.'),
});
export type CleanPdfTextInput = z.infer<typeof CleanPdfTextInputSchema>;

const CleanPdfTextOutputSchema = z.object({
  cleanedText: z.string().describe('The core content of the document, with headers, footers, and page numbers removed.'),
});
export type CleanPdfTextOutput = z.infer<typeof CleanPdfTextOutputSchema>;

export async function cleanPdfText(input: CleanPdfTextInput): Promise<CleanPdfTextOutput> {
  return cleanPdfTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'cleanPdfTextPrompt',
  input: {schema: CleanPdfTextInputSchema},
  output: {schema: CleanPdfTextOutputSchema},
  prompt: `You are an expert document processor. Your task is to clean up raw text extracted from a PDF.
  Analyze the following text and remove any content that appears to be a repetitive header, footer, or page number.
  Preserve the main body of the text, ensuring paragraphs and formatting are respected as much as possible.
  Return only the cleaned, primary content of the document.

  Raw Document Text:
  ---
  {{{rawText}}}
  ---
  `,
});

const cleanPdfTextFlow = ai.defineFlow(
  {
    name: 'cleanPdfTextFlow',
    inputSchema: CleanPdfTextInputSchema,
    outputSchema: CleanPdfTextOutputSchema,
  },
  async input => {
    // Use a more powerful model specifically for this complex task.
    const {output} = await prompt(input, { model: 'googleai/gemini-pro' });
    return output!;
  }
);
