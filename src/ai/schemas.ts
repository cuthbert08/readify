import { z } from 'genkit';

const validVoices = z.enum(['text-to-speech-en-US-Standard-A', 'text-to-speech-en-US-Standard-B', 'text-to-speech-en-US-Standard-C', 'text-to-speech-en-US-Standard-D', 'text-to-speech-en-US-Standard-E', 'text-to-speech-en-US-Standard-F', 'text-to-speech-en-US-Standard-G', 'text-to-speech-en-US-Standard-H', 'text-to-speech-en-US-Standard-I', 'text-to-speech-en-US-Standard-J']);

// Schema for generating full speech from document text
export const GenerateSpeechInputSchema = z.object({
  text: z.string().describe('The text to be converted to speech.'),
  voice: z.string().describe('The voice to use for the speech synthesis.'),
  speakingRate: z.number().min(0.25).max(4.0).optional().describe('The speaking rate, where 1.0 is the normal speed.'),
});
export type GenerateSpeechInput = z.infer<typeof GenerateSpeechInputSchema>;

const sentenceSchema = z.object({
    text: z.string(),
    startTime: z.number(),
    endTime: z.number(),
});

export const GenerateSpeechOutputSchema = z.object({
  audioDataUri: z.string().describe("A data URI of the generated audio file. Expected format: 'data:audio/wav;base64,<encoded_data>'."),
  sentences: z.array(sentenceSchema).describe("An array of sentences with their start and end times in the audio."),
});
export type GenerateSpeechOutput = z.infer<typeof GenerateSpeechOutputSchema>;
export type Sentence = z.infer<typeof sentenceSchema>;


// Schema for previewing a selected voice
export const PreviewSpeechInputSchema = z.object({
    voice: z.string().describe('The voice to use for the speech synthesis.'),
});
export type PreviewSpeechInput = z.infer<typeof PreviewSpeechInputSchema>;

export const PreviewSpeechOutputSchema = z.object({
    audioDataUri: z.string().describe("A data URI of the generated audio file. Expected format: 'data:audio/mp3;base64,<encoded_data>'."),
});
export type PreviewSpeechOutput = z.infer<typeof PreviewSpeechOutputSchema>;
