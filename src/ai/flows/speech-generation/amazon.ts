
'use server';

export type SpeechMark = {
    time: number;
    type: 'sentence' | 'word';
    start: number;
    end: number;
    value: string;
};

export type AmazonVoiceOutput = {
    audioDataUris: string[];
    speechMarks: SpeechMark[];
}

export async function generateAmazonVoice(formattedText: string, voice: string): Promise<AmazonVoiceOutput> {
    const pollyBaseUrl = process.env.AMAZON_POLLY_API_URL;
    if (!pollyBaseUrl) {
        throw new Error('Amazon Polly API URL is not configured. Please set the AMAZON_POLLY_API_URL environment variable.');
    }
    const pollyUrl = `${pollyBaseUrl.replace(/\/$/, '')}/tts`;


    const response = await fetch(pollyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: formattedText,
            voiceId: voice,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        // Log the full error for server-side debugging
        console.error("Amazon Polly Lambda Error:", errorBody);
        // Throw a detailed error for the client
        throw new Error(`Polly API Error (${response.status}): ${errorBody}`);
    }

    const { audioChunks, speechMarks } = await response.json();
    if (!audioChunks || !Array.isArray(audioChunks)) {
        throw new Error('Amazon Polly response did not include audio data in the expected format.');
    }

    // Prepend the data URI prefix to each chunk
    const audioDataUris = audioChunks.map(chunk => `data:audio/mp3;base64,${chunk}`);
    
    return { audioDataUris, speechMarks };
}
