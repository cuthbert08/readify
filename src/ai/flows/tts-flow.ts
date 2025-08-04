'use server';

/**
 * @fileOverview A hybrid text-to-speech AI agent.
 * This flow uses a two-step process:
 * 1. Google Gemini is used to clean the text (remove headers/footers) and to
 *    generate sentence timings for highlighting.
 * 2. OpenAI is used to generate the high-quality audio from the cleaned text.
 *
 * - generateSpeech - A function that handles the text-to-speech process.
 */
import { ai } from '@/ai/genkit';
import { openAI } from 'genkitx-openai';
import { googleAI } from '@genkit-ai/googleai';
import { GenerateSpeechInputSchema, GenerateSpeechOutputSchema, type Sentence } from '@/ai/schemas';
import { z } from 'zod';


// Schema for the Google AI analysis step
const TextAnalysisOutputSchema = z.object({
    cleanedText: z.string().describe("The main body of the document, with headers, footers, and page numbers removed."),
    sentences: z.array(z.object({
        text: z.string().describe("The sentence text."),
        startTime: z.number().describe("The estimated start time of the sentence in seconds."),
        endTime: z.number().describe("The estimated end time of the sentence in seconds."),
    })).describe("An array of sentences with their estimated start and end times."),
});

export const generateSpeech = ai.defineFlow(
  {
    name: 'generateSpeech',
    inputSchema: GenerateSpeechInputSchema,
    outputSchema: GenerateSpeechOutputSchema,
  },
  async (input) => {
    
    // Step 1: Use Google AI to clean text and get sentence timings
    const analysisPrompt = `Analyze the following document text.
    Your task is to act as a text processing engine. You must perform two steps and return a single JSON object matching the requested schema.
    
    1.  **Clean the Text**: Read the entire text and remove any repetitive content that appears to be a header, footer, or page number. Return only the main body of the text in the 'cleanedText' field.
    
    2.  **Generate Sentence Timings**:
        *   Break the cleaned text down into an ordered list of individual sentences.
        *   For each sentence, you must calculate an *estimated* start and end time in seconds.
        *   Assume a normal speaking pace of 150 words per minute, which is equivalent to a speaking rate of ${input.speakingRate || 1.0}.
        *   Calculate the duration of each sentence based on its word count. The time for each word is approximately (60 seconds / 150 words) / speakingRate.
        *   The 'startTime' of a sentence is the 'endTime' of the previous sentence. The 'endTime' is the 'startTime' plus the calculated duration.
        *   The first sentence should have a 'startTime' of 0.

    Return a valid JSON object containing both the 'cleanedText' and the 'sentences' array.

    TEXT:
    ---
    ${input.text}
    ---
    `;

    const { output: analysisOutput } = await ai.generate({
        prompt: analysisPrompt,
        model: 'googleai/gemini-1.5-flash-latest',
        output: { schema: TextAnalysisOutputSchema },
        config: {
            responseMimeType: 'application/json',
        }
    });
    
    if (!analysisOutput?.cleanedText || !analysisOutput?.sentences) {
        console.error("Google AI analysis failed. Raw output:", JSON.stringify(analysisOutput, null, 2));
        throw new Error('Google AI text analysis failed to return cleaned text or sentences. The model may not have returned the data in the expected format.');
    }

    const { cleanedText, sentences } = analysisOutput;

    // Step 2: Generate speech from the cleaned text using OpenAI
    const { media: audioMedia } = await ai.generate({
      model: 'openai/tts-1',
      prompt: cleanedText,
      config: {
        voice: input.voice,
        speed: input.speakingRate || 1.0,
        response_format: 'wav',
      },
      output: {
        format: 'url'
      }
    });

    if (!audioMedia || !audioMedia.url) {
        throw new Error('No media URL returned from OpenAI. Check OpenAI API response.');
    }

    try {
        const audioResponse = await fetch(audioMedia.url);
        if (!audioResponse.ok) {
            const errorBody = await audioResponse.text();
            throw new Error(`Failed to fetch audio from OpenAI URL: ${audioResponse.statusText} (Status: ${audioResponse.status}) - ${errorBody}`);
        }

        const audioBuffer = await audioResponse.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString('base64');
        const audioDataUri = `data:audio/wav;base64,${base64Audio}`;

        return {
            audioDataUri: audioDataUri,
            sentences: sentences,
        };

    } catch (fetchError: any) {
        console.error("Error fetching or processing audio from OpenAI URL:", fetchError);
        throw new Error(`Could not process audio: ${fetchError.message}`);
    }
  }
);
