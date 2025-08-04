'use server';
/**
 * @fileOverview A text-to-speech AI agent using Google Gemini.
 *
 * - generateSpeech - A function that handles the text-to-speech process.
 */
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { GenerateSpeechInputSchema, GenerateSpeechOutputSchema, type GenerateSpeechInput } from '@/ai/schemas';
import wav from 'wav';
import { z } from 'genkit';

// Define a new schema for the raw TTS output from Gemini
const GeminiTtsOutputSchema = z.object({
    media: z.object({
        contentType: z.string(),
        url: z.string(),
    }),
    timings: z.array(z.object({
        text: z.string(),
        startTimeSec: z.number(),
        endTimeSec: z.number(),
    })),
});

// Helper function to convert PCM data to WAV format
async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: Buffer[] = [];
    writer.on('error', reject);
    writer.on('data', (d) => {
      bufs.push(d);
    });
    writer.on('end', () => {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}


export const generateSpeech = ai.defineFlow(
  {
    name: 'generateSpeech',
    inputSchema: GenerateSpeechInputSchema,
    outputSchema: GenerateSpeechOutputSchema,
  },
  async (input) => {
    
    const { output } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-preview-tts'),
      prompt: input.text,
      output: { 
          schema: GeminiTtsOutputSchema,
          // Note: we don't need to provide a custom prompt function here,
          // Gemini TTS automatically understands to provide audio and timings.
      },
      config: {
        responseModalities: ['AUDIO', 'TEXT'],
        speechConfig: {
          voiceConfig: {
            // Mapping OpenAI voices to rough Gemini equivalents.
            // This is a simplification. A more robust solution might use different logic.
            prebuiltVoiceConfig: { voiceName: input.voice === 'nova' || input.voice === 'shimmer' ? 'Alloy' : 'Echo' },
          },
          speakingRate: input.speakingRate || 1.0,
        },
      },
    });

    if (!output || !output.media) {
        throw new Error('No media returned from Google AI. Check API response.');
    }
    
    try {
        const audioBuffer = Buffer.from(
          output.media.url.substring(output.media.url.indexOf(',') + 1),
          'base64'
        );
        const wavBase64 = await toWav(audioBuffer);
        const audioDataUri = `data:audio/wav;base64,${wavBase64}`;

        const sentences = output.timings.map(t => ({
            text: t.text,
            startTime: t.startTimeSec,
            endTime: t.endTimeSec,
        }));

        return {
            audioDataUri: audioDataUri,
            sentences: sentences,
        };

    } catch (fetchError: any) {
        console.error("Error processing audio from Google AI:", fetchError);
        throw new Error(`Could not process audio: ${fetchError.message}`);
    }
  }
);
