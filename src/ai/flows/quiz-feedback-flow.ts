
'use server';

/**
 * @fileOverview An AI agent for generating personalized feedback after a quiz.
 *
 * - generateQuizFeedback - Creates personalized suggestions based on failed questions.
 */

import { ai } from '@/ai/genkit';
import { QuizFeedbackInputSchema, QuizFeedbackOutputSchema, type QuizFeedbackInput } from '@/ai/schemas/quiz';

export async function generateQuizFeedback(input: QuizFeedbackInput): Promise<QuizFeedbackOutputSchema> {
  return generateQuizFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateQuizFeedbackPrompt',
  input: { schema: QuizFeedbackInputSchema },
  output: { schema: QuizFeedbackOutputSchema },
  prompt: `You are an expert tutor. A student has just completed a quiz based on the provided document and answered some questions incorrectly.
Your task is to provide personalized feedback and suggest topics for them to review.

1.  Analyze the list of failed questions.
2.  Identify the core concepts or topics the user is struggling with based on these questions and the original document text.
3.  Generate a concise, encouraging, and helpful list of suggestions.
4.  Format the response as Markdown.

Original Document Text:
---
{{{documentText}}}
---

Failed Questions:
---
{{#each failedQuestions}}
- Question: "{{question}}"
  - User's Answer: "{{userAnswer}}"
  - Correct Answer: "{{correctAnswer}}"
---
{{/each}}
`,
});

const generateQuizFeedbackFlow = ai.defineFlow(
  {
    name: 'generateQuizFeedbackFlow',
    inputSchema: QuizFeedbackInputSchema,
    outputSchema: QuizFeedbackOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
