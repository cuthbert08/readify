'use server';
/**
 * @fileOverview A text-to-speech AI agent using Google AI.
 *
 * - generateSpeech - A function that handles the text-to-speech process with word timings.
 */
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { GenerateSpeechInputSchema, GenerateSpeechOutputSchema, type GenerateSpeechInput } from '@/ai/schemas';
import { z } from 'zod';
import wav from 'wav';

async function toWav(pcmData: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const writer = new wav.Writer({
            channels: 1,
            sampleRate: 24000,
            bitDepth: 16,
        });

        const buffers: Buffer[] = [];
        writer.on('data', chunk => buffers.push(chunk));
        writer.on('end', () => resolve(Buffer.concat(buffers).toString('base64')));
        writer.on('error', reject);

        writer.write(pcmData);
        writer.end();
    });
}

// Define sentences for highlighting
const sentenceSchema = z.object({
  text: z.string(),
  startTime: z.number(),
  endTime: z.number(),
});

export const generateSpeech = ai.defineFlow(
  {
    name: 'generateSpeech',
    inputSchema: GenerateSpeechInputSchema,
    outputSchema: GenerateSpeechOutputSchema,
  },
  async (input) => {
    
    const { media, content } = await ai.generate({
        model: googleAI.model('gemini-1.5-flash-latest'),
        prompt: input.text,
        config: {
            // @ts-ignore - The model supports this parameter
            "responseMimeType": "audio/wav",
            "responseRequestedAudioEncoding": "LINEAR16",
            "textToSpeech": {
                "enableTimepoints": true,
                "voice": {
                  "name": `text-to-speech/${input.voice}`
                },
                "speakingRate": input.speakingRate || 1.0,
            }
        },
    });

    if (!media) {
      throw new Error('No media returned from Google AI.');
    }
    
    // The media URL is a base64 encoded string of the audio data.
    const audioBuffer = Buffer.from(
      media.url.substring(media.url.indexOf(',') + 1),
      'base64'
    );
    const wavBase64 = await toWav(audioBuffer);
    const audioDataUri = `data:audio/wav;base64,${wavBase64}`;

    let sentences: z.infer<typeof sentenceSchema>[] = [];
    if (content[0]?.custom?.timepoints) {
        sentences = content[0].custom.timepoints.map((t: any) => ({
            text: t.text,
            startTime: t.start_time_secs,
            endTime: t.end_time_secs,
        }));
    }

    return {
      audioDataUri: audioDataUri,
      sentences: sentences,
    };
  }
);
