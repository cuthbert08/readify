import { z } from 'genkit';

const validVoices = z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']);

// Schema for generating full speech from document text
export const GenerateSpeechInputSchema = z.object({
  text: z.string().describe('The text to be converted to speech.'),
  voice: validVoices.describe('The voice to use for the speech synthesis.'),
  speakingRate: z.number().min(0.25).max(3.0).optional().describe('The speaking rate, where 1.0 is the normal speed.'),
});
export type GenerateSpeechInput = z.infer<typeof GenerateSpeechInputSchema>;

export const GenerateSpeechOutputSchema = z.object({
  audioDataUri: z.string().describe("A data URI of the generated audio file. Expected format: 'data:audio/mp3;base64,<encoded_data>'."),
});
export type GenerateSpeechOutput = z.infer<typeof GenerateSpeechOutputSchema>;


// Schema for previewing a selected voice
export const PreviewSpeechInputSchema = z.object({
    voice: validVoices.describe('The voice to use for the speech synthesis.'),
    apiKey: z.string().optional().describe('An optional OpenAI API key to use for this specific request.'),
});
export type PreviewSpeechInput = z.infer<typeof PreviewSpeechInputSchema>;

export const PreviewSpeechOutputSchema = z.object({
    audioDataUri: z.string().describe("A data URI of the generated audio file. Expected format: 'data:audio/mp3;base64,<encoded_data>'."),
});
export type PreviewSpeechOutput = z.infer<typeof PreviewSpeechOutputSchema>;
