import { z } from 'genkit';

const validVoices = z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']);

// Schema for generating full speech with word timings
export const WordTimestampSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
});
export type WordTimestamp = z.infer<typeof WordTimestampSchema>;

export const GenerateSpeechWithTimingsInputSchema = z.object({
  text: z.string().describe('The text to be converted to speech.'),
  voice: validVoices.describe('The voice to use for the speech synthesis.'),
  speakingRate: z.number().min(0.25).max(4.0).optional().describe('The speaking rate, where 1.0 is the normal speed.'),
});
export type GenerateSpeechWithTimingsInput = z.infer<typeof GenerateSpeechWithTimingsInputSchema>;

export const GenerateSpeechWithTimingsOutputSchema = z.object({
  audioDataUri: z.string().describe("A data URI of the generated audio file. Expected format: 'data:audio/mp3;base64,<encoded_data>'."),
  words: z.array(WordTimestampSchema).describe("An array of words with their start and end timestamps in the audio."),
});
export type GenerateSpeechWithTimingsOutput = z.infer<typeof GenerateSpeechWithTimingsOutputSchema>;


// Legacy schema for simple generation (used by synthesize tab)
export const GenerateSpeechInputSchema = z.object({
  text: z.string().describe('The text to be converted to speech.'),
  voice: validVoices.describe('The voice to use for the speech synthesis.'),
  speakingRate: z.number().min(0.25).max(4.0).optional().describe('The speaking rate, where 1.0 is the normal speed.'),
});
export type GenerateSpeechInput = z.infer<typeof GenerateSpeechInputSchema>;

export const GenerateSpeechOutputSchema = z.object({
  audioDataUri: z.string().describe("A data URI of the generated audio file. Expected format: 'data:audio/mp3;base64,<encoded_data>'."),
});
export type GenerateSpeechOutput = z.infer<typeof GenerateSpeechOutputSchema>;


// Schema for previewing a selected voice
export const PreviewSpeechInputSchema = z.object({
    voice: validVoices.describe('The voice to use for the speech synthesis.'),
});
export type PreviewSpeechInput = z.infer<typeof PreviewSpeechInputSchema>;

export const PreviewSpeechOutputSchema = z.object({
    audioDataUri: z.string().describe("A data URI of the generated audio file. Expected format: 'data:audio/mp3;base64,<encoded_data>'."),
});
export type PreviewSpeechOutput = z.infer<typeof PreviewSpeechOutputSchema>;
