
import { z } from 'genkit';

export const GenerateQuizInputSchema = z.object({
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

// Schemas for Personalized Feedback
export const QuizFeedbackInputSchema = z.object({
    documentText: z.string().describe('The full text content of the original document.'),
    failedQuestions: z.array(z.object({
        question: z.string(),
        userAnswer: z.string(),
        correctAnswer: z.string(),
    })).describe('An array of questions the user answered incorrectly.'),
});
export type QuizFeedbackInput = z.infer<typeof QuizFeedbackInputSchema>;

export const QuizFeedbackOutputSchema = z.object({
    feedback: z.string().describe('Personalized feedback and suggestions for the user, formatted as Markdown.'),
});
export type QuizFeedbackOutput = z.infer<typeof QuizFeedbackOutputSchema>;
