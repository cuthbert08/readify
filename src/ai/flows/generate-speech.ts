'use server';

/**
 * @fileOverview An text-to-speech AI agent using OpenAI.
 * This flow generates audio from text, supporting long inputs by splitting them into chunks.
 *
 * - generateSpeech - A function that handles the text-to-speech process.
 */
import { ai } from '@/ai/genkit';
import { GenerateSpeechInputSchema, GenerateSpeechOutputSchema } from '@/ai/schemas';
import { z } from 'genkit';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegPath.path);

// Function to split text into chunks without breaking sentences
function splitText(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let remainingText = text;

    while (remainingText.length > 0) {
        if (remainingText.length <= maxLength) {
            chunks.push(remainingText);
            break;
        }

        let chunk = remainingText.substring(0, maxLength);
        let lastSentenceEnd = -1;

        // Find the last sentence-ending punctuation
        const sentenceEnders = ['.', '?', '!', '\n'];
        for (const p of sentenceEnders) {
            const pos = chunk.lastIndexOf(p);
            if (pos > lastSentenceEnd) {
                lastSentenceEnd = pos;
            }
        }

        if (lastSentenceEnd !== -1) {
            // Split at the end of the sentence
            chunk = remainingText.substring(0, lastSentenceEnd + 1);
        }

        chunks.push(chunk);
        remainingText = remainingText.substring(chunk.length);
    }

    return chunks.filter(chunk => chunk.trim().length > 0);
}


async function mergeAudioFiles(filePaths: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const command = ffmpeg();
        filePaths.forEach(filePath => {
            command.input(filePath);
        });

        command
            .on('error', (err) => {
                console.error('FFmpeg Error:', err);
                reject(err);
            })
            .on('end', () => {
                resolve();
            })
            .mergeToFile(outputPath, os.tmpdir());
    });
}


export const generateSpeech = ai.defineFlow(
  {
    name: 'generateSpeech',
    inputSchema: GenerateSpeechInputSchema,
    outputSchema: GenerateSpeechOutputSchema,
  },
  async (input) => {
    
    if (!input.text || !input.text.trim()) {
        throw new Error("Input text cannot be empty.");
    }

    const textChunks = splitText(input.text, 4000);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'readify-audio-'));
    const audioFilePaths: string[] = [];

    try {
        // Generate audio for each chunk in parallel
        const audioGenerationPromises = textChunks.map(async (chunk, index) => {
            const { media } = await ai.generate({
                model: 'openai/tts-1',
                prompt: chunk,
                config: {
                    voice: input.voice,
                    speed: input.speakingRate || 1.0,
                },
                output: { format: 'url' }
            });

            if (!media?.url) {
                throw new Error(`OpenAI failed to return audio for chunk ${index}.`);
            }

            const audioResponse = await fetch(media.url);
            if (!audioResponse.ok) {
                throw new Error(`Failed to fetch audio from OpenAI URL for chunk ${index}. Status: ${audioResponse.status}`);
            }

            const audioBuffer = await audioResponse.arrayBuffer();
            const tempFilePath = path.join(tempDir, `${index}.mp3`);
            await fs.writeFile(tempFilePath, Buffer.from(audioBuffer));
            return tempFilePath;
        });

        const generatedPaths = await Promise.all(audioGenerationPromises);
        audioFilePaths.push(...generatedPaths);

        if (audioFilePaths.length === 0) {
            throw new Error("No audio files were generated.");
        }
        
        if (audioFilePaths.length === 1) {
             const audioBuffer = await fs.readFile(audioFilePaths[0]);
             const base64Audio = audioBuffer.toString('base64');
             return { audioDataUri: `data:audio/mp3;base64,${base64Audio}` };
        }

        // Merge the audio files
        const outputFileName = `${randomUUID()}.mp3`;
        const outputFilePath = path.join(tempDir, outputFileName);
        
        await mergeAudioFiles(audioFilePaths, outputFilePath);

        const mergedAudioBuffer = await fs.readFile(outputFilePath);
        const base64Audio = mergedAudioBuffer.toString('base64');

        return { audioDataUri: `data:audio/mp3;base64,${base64Audio}` };

    } catch (error: any) {
        console.error("Error in generateSpeech flow:", error);
        throw new Error(`Failed to generate speech: ${error.message}`);
    } finally {
        // Clean up temporary directory
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    }
  }
);