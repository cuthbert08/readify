'use server';

/**
 * @fileOverview An AI agent for generating quizzes from a document.
 *
 * - generateQuiz - A function that creates quiz questions.
 * - GenerateQuizInput - The input type for the generateQuiz function.
 * - GenerateQuizOutput - The return type for the generateQuiz function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateQuizInputSchema = z.object({
  documentText: z.string().describe('The full text content of the document.'),
});
export type GenerateQuizInput = z.infer<typeof GenerateQuizInputSchema>;

export const QuizQuestionSchema = z.object({
    question: z.string().describe("The quiz question."),
    type: z.enum(['multiple-choice', 'true-false']).describe("The type of question."),
    options: z.array(z.string()).optional().describe("A list of possible answers for multiple-choice questions."),
    answer: z.string().describe("The correct answer."),
    explanation: z.string().describe("A brief explanation for why the answer is correct.")
});

export const GenerateQuizOutputSchema = z.object({
  quiz: z.array(QuizQuestionSchema).describe('A list of quiz questions with answers and explanations.'),
});
export type GenerateQuizOutput = z.infer<typeof GenerateQuizOutputSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

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
