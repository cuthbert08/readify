
'use server';

import { ai } from '@/ai/genkit';

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

        // Prioritize splitting at sentence-ending punctuation.
        const sentenceEnders = ['.', '?', '!', '\n'];
        for (const p of sentenceEnders) {
            const pos = chunk.lastIndexOf(p);
            // Ensure the punctuation is not part of a larger structure like "e.g."
            if (pos > -1 && (remainingText[pos + 1] === ' ' || remainingText[pos + 1] === '\n' || pos === chunk.length - 1)) {
                lastSentenceEnd = Math.max(lastSentenceEnd, pos);
            }
        }

        // If a sentence end is found, split there. Otherwise, split at the last space to avoid breaking words.
        let splitIndex;
        if (lastSentenceEnd !== -1) {
            splitIndex = lastSentenceEnd + 1;
        } else {
            const lastSpace = chunk.lastIndexOf(' ');
            splitIndex = lastSpace !== -1 ? lastSpace : maxLength; // Fallback to hard split if no space
        }
        
        chunk = remainingText.substring(0, splitIndex);
        chunks.push(chunk);
        remainingText = remainingText.substring(chunk.length);
    }

    return chunks.filter(chunk => chunk.trim().length > 0);
}

export async function generateOpenAIVoice(formattedText: string, voice: string, speed: number) {
    // OpenAI has a 4096 character limit per request.
    const textChunks = splitText(formattedText, 4000);
    console.log(`Generated ${textChunks.length} text chunks for OpenAI.`);

    const audioGenerationPromises = textChunks.map(async (chunk) => {
        const { media } = await ai.generate({
            model: 'openai/tts-1',
            prompt: chunk,
            config: { voice: voice as any, speed },
            output: { format: 'url' }
        });
        if (!media?.url) throw new Error('OpenAI failed to return audio.');
        
        const audioResponse = await fetch(media.url);
        if (!audioResponse.ok) throw new Error('Failed to fetch audio from OpenAI URL.');
        const audioBuffer = await audioResponse.arrayBuffer();
        return `data:audio/mp3;base64,${Buffer.from(audioBuffer).toString('base64')}`;
    });
    return Promise.all(audioGenerationPromises);
}
