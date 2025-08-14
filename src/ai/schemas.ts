
import { z } from 'genkit';

const SpeechMarkSchema = z.object({
  time: z.number(),
  type: z.enum(['sentence', 'word']),
  start: z.number(),
  end: z.number(),
  value: z.string(),
});
export type SpeechMark = z.infer<typeof SpeechMarkSchema>;


export const GenerateSpeechInputSchema = z.object({
  text: z.string().describe('The text to be converted to speech.'),
  voice: z.string().describe('The identifier for the voice to use for the speech synthesis (e.g., "openai/alloy", "google/en-US-News-M").'),
  speakingRate: z.number().min(0.25).max(4.0).optional().describe('The speaking rate, where 1.0 is the normal speed.'),
});
export type GenerateSpeechInput = z.infer<typeof GenerateSpeechInputSchema>;

export const GenerateSpeechOutputSchema = z.object({
  audioDataUris: z.array(z.string()).describe("An array of data URIs for the generated audio chunks. Each format: 'data:audio/mp3;base64,<encoded_data>'."),
  speechMarks: z.array(SpeechMarkSchema).optional().describe('An array of speech mark objects for sentence and word-level timing.'),
});
export type GenerateSpeechOutput = z.infer<typeof GenerateSpeechOutputSchema>;


// Schema for previewing a selected voice
export const PreviewSpeechInputSchema = z.object({
    voice: z.string().describe('The voice identifier to preview (e.g., "openai/alloy", "google/en-US-News-M").'),
});
export type PreviewSpeechInput = z.infer<typeof PreviewSpeechInputSchema>;

export const PreviewSpeechOutputSchema = z.object({
    audioDataUri: z.string().describe("A data URI of the generated audio file. Expected format: 'data:audio/mp3;base64,<encoded_data>'."),
});
export type PreviewSpeechOutput = z.infer<typeof PreviewSpeechOutputSchema>;
