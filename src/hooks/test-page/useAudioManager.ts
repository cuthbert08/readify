
'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { getAvailableVoices, AvailableVoice } from '@/ai/flows/voice-selection';
import { previewSpeech } from '@/ai/flows/preview-speech';
import { generateSpeech } from '@/ai/flows/generate-speech';
import { saveDocument, Document } from '@/lib/db';
import type { SpeechMark } from '@/ai/schemas';

const IS_STAGING = true;

// Helper function to concatenate audio blobs
async function mergeAudio(audioDataUris: string[]): Promise<Blob> {
    const audioBuffers = await Promise.all(
        audioDataUris.map(async (uri) => {
            const response = await fetch(uri);
            return response.arrayBuffer();
        })
    );
    const totalLength = audioBuffers.reduce((acc, buffer) => acc + buffer.byteLength, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    audioBuffers.forEach((buffer) => {
        merged.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
    });
    return new Blob([merged], { type: 'audio/mp3' });
}

type UseAudioManagerProps = {
    activeDoc: Document | null;
    documentText: string;
    speechMarks: SpeechMark[];
    setSpeechMarks: (marks: SpeechMark[]) => void;
    audioRef: React.RefObject<HTMLAudioElement>;
    setActiveDoc: (doc: Document) => void;
    fetchUserDocuments: () => void;
};

export const useAudioManager = ({ 
    activeDoc, 
    documentText, 
    speechMarks, 
    setSpeechMarks, 
    audioRef, 
    setActiveDoc,
    fetchUserDocuments
}: UseAudioManagerProps) => {
    const { toast } = useToast();
    const [availableVoices, setAvailableVoices] = useState<AvailableVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState('openai/alloy');
    const [speakingRate, setSpeakingRate] = useState(1);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [generationState, setGenerationState] = useState<'idle' | 'generating' | 'error'>('idle');
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        async function fetchVoices() {
            try {
                const voices = await getAvailableVoices();
                setAvailableVoices(voices);
            } catch (error) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Could not fetch available voices.",
                });
            }
        }
        fetchVoices();
    }, [toast]);
    
    useEffect(() => {
        if(audioRef.current) {
            audioRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate, audioRef]);

    const handleGenerateAudio = async () => {
        if (generationState === 'generating') {
            toast({ title: "In Progress", description: "Audio generation is already running." });
            return;
        }
        if (!documentText || !activeDoc || !activeDoc.id) {
            toast({ variant: "destructive", title: "No Document", description: "Please select a document with text content first." });
            return;
        }
        setGenerationState('generating');
        toast({ title: "Starting Audio Generation", description: "This may take a few moments..." });

        try {
            const result = await generateSpeech({ text: documentText, voice: selectedVoice, speakingRate: speakingRate });
            if (!result.audioDataUris || result.audioDataUris.length === 0) {
                toast({ title: "Generation Stopped", description: "Audio generation resulted in no audio." });
                setGenerationState('idle');
                return;
            }
            const mergedAudioBlob = await mergeAudio(result.audioDataUris);
            const audioFileName = `${activeDoc.fileName.replace(/\.pdf$/i, '') || 'audio'}.mp3`;
            const uploadAudioResponse = await fetch('/api/upload', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'audio/mp3', 
                    'x-vercel-filename': audioFileName,
                    'x-doc-id': activeDoc.id,
                    'x-is-staging': IS_STAGING ? 'true' : 'false'
                },
                body: mergedAudioBlob,
            });
            if (!uploadAudioResponse.ok) throw new Error('Audio Upload failed');
            const audioBlobResult = await uploadAudioResponse.json();
            const newAudioUrl = audioBlobResult.url;
            const updatedDoc = await saveDocument({ id: activeDoc.id, audioUrl: newAudioUrl, speechMarks: result.speechMarks || null }, IS_STAGING);
            
            setSpeechMarks(result.speechMarks || []);
            setActiveDoc(updatedDoc);
            
            if (audioRef.current) {
                audioRef.current.src = newAudioUrl;
                audioRef.current.load();
            }
            await fetchUserDocuments();
            toast({ title: "Success", description: "Audio generated and saved." });
        } catch (error: any) {
            console.error('Speech generation error', error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
            toast({ variant: "destructive", title: "Audio Error", description: `Could not generate audio. ${errorMessage}` });
        } finally {
            setGenerationState('idle');
        }
    };

    const handlePreviewVoice = async (voice: string) => {
        try {
            const result = await previewSpeech({ voice: voice });
            if (result.audioDataUri && previewAudioRef.current) {
                previewAudioRef.current.src = result.audioDataUri;
                previewAudioRef.current.play();
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
            toast({ variant: "destructive", title: "Audio Error", description: `Could not preview voice: ${errorMessage}` });
        }
    };

    const getProcessingMessage = () => {
        switch (generationState) {
            case 'generating': return 'Generating and saving audio...';
            case 'error': return 'An error occurred during audio generation.';
            default: return '';
        }
    };

    return {
        previewAudioRef,
        availableVoices,
        selectedVoice,
        setSelectedVoice,
        speakingRate,
        setSpeakingRate,
        playbackRate,
        setPlaybackRate,
        generationState,
        handleGenerateAudio,
        handlePreviewVoice,
        getProcessingMessage,
    };
};
