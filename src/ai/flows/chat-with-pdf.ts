'use server';

/**
 * @fileOverview An AI agent for answering questions about a PDF document.
 *
 * - chatWithPdf - A function that handles the Q&A process.
 * - ChatWithPdfInput - The input type for the chatWithPdf function.
 * - ChatWithPdfOutput - The return type for the chatWithPdf function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChatWithPdfInputSchema = z.object({
  pdfText: z.string().describe('The text content of the PDF document.'),
  question: z.string().describe('The user\'s question about the document.'),
});
export type ChatWithPdfInput = z.infer<typeof ChatWithPdfInputSchema>;

const ChatWithPdfOutputSchema = z.object({
  answer: z.string().describe('The answer to the user\'s question, based on the document content.'),
});
export type ChatWithPdfOutput = z.infer<typeof ChatWithPdfOutputSchema>;

export async function chatWithPdf(input: ChatWithPdfInput): Promise<ChatWithPdfOutput> {
  return chatWithPdfFlow(input);
}

const prompt = ai.definePrompt({
  name: 'chatWithPdfPrompt',
  input: {schema: ChatWithPdfInputSchema},
  output: {schema: ChatWithPdfOutputSchema},
  prompt: `You are a helpful assistant. Your task is to answer questions about the provided document.
  Base your answers *only* on the content of the text below. If the answer cannot be found in the text, say "I'm sorry, I can't find the answer to that in this document."

  Document Text:
  ---
  {{{pdfText}}}
  ---

  Question:
  {{{question}}}
  `,
});

const chatWithPdfFlow = ai.defineFlow(
  {
    name: 'chatWithPdfFlow',
    inputSchema: ChatWithPdfInputSchema,
    outputSchema: ChatWithPdfOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
