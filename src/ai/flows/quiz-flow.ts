'use server';

/**
 * @fileOverview An AI agent for generating quizzes from a document.
 *
 * - generateQuiz - A function that creates quiz questions.
 * - GenerateQuizInput - The input type for the generateQuiz function.
 * - GenerateQuizOutput - The return type for the generateQuiz function.
 */

import {ai} from '@/ai/genkit';
import { GenerateQuizInputSchema, GenerateQuizOutputSchema, type GenerateQuizInput, type GenerateQuizOutput } from '@/ai/schemas/quiz';

// This line explicitly re-exports the type so it can be imported by other files
export type { GenerateQuizOutput };

export async function generateQuiz(input: GenerateQuizInput): Promise<GenerateQuizOutput> {
  return generateQuizFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateQuizPrompt',
  input: {schema: GenerateQuizInputSchema},
  output: {schema: GenerateQuizOutputSchema},
  prompt: `You are an expert educator. Your task is to read the following document and create a quiz to test a user's understanding of the material.
  Generate a mix of multiple-choice and true/false questions. For each question, provide the correct answer and a brief explanation.

  Document Text:
  ---
  {{{documentText}}}
  ---
  `,
});

const generateQuizFlow = ai.defineFlow(
  {
    name: 'generateQuizFlow',
    inputSchema: GenerateQuizInputSchema,
    outputSchema: GenerateQuizOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);