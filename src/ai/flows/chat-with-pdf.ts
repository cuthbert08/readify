
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
  chatHistory: z.array(z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
  })).optional().describe('The history of the conversation so far.'),
});
export type ChatWithPdfInput = z.infer<typeof ChatWithPdfInputSchema>;

const ChatWithPdfOutputSchema = z.object({
  answer: z.string().describe('The answer to the user\'s question, formatted in Markdown.'),
});
export type ChatWithPdfOutput = z.infer<typeof ChatWithPdfOutputSchema>;

export async function chatWithPdf(input: ChatWithPdfInput): Promise<ChatWithPdfOutput> {
  return chatWithPdfFlow(input);
}

const prompt = ai.definePrompt({
  name: 'chatWithPdfPrompt',
  input: {schema: ChatWithPdfInputSchema},
  output: {schema: ChatWithPdfOutputSchema},
  prompt: `You are a helpful and knowledgeable assistant. Your primary task is to answer questions based on the provided document content.
Your secondary task is to use your general knowledge if the document does not contain the answer.

Follow these rules:
1.  **Prioritize Document**: Base your answers *only* on the content of the text below.
2.  **Use General Knowledge**: If the answer cannot be found in the text, use your own knowledge to answer, but you *must* state that the information is not from the document. For example, start your response with "Based on my general knowledge..."
3.  **Format Responses**: Format your answers using Markdown. Use code blocks for code snippets and proper formatting for mathematical equations.
4.  **Acknowledge History**: Use the provided chat history to understand the context of the conversation.

  Chat History:
  ---
  {{#if chatHistory}}
    {{#each chatHistory}}
        **{{role}}**: {{content}}
    {{/each}}
  {{else}}
    No chat history yet.
  {{/if}}
  ---

  Document Text:
  ---
  {{{pdfText}}}
  ---

  New Question:
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
