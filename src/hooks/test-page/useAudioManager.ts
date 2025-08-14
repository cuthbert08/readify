
'use client';

import { useState, useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { getAvailableVoices, AvailableVoice } from '@/ai/flows/voice-selection';
import { previewSpeech } from '@/ai/flows/preview-speech';
import { generateSpeech } from '@/ai/flows/generate-speech';
import { saveDocument, Document } from '@/lib/db';
import type { SpeechMark } from '@/ai/schemas';
import type { Highlight } from '@/components/pdf-viewer';


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
    setCurrentHighlight: (h: Highlight | null) => void;
};

export const useAudioManager = ({ activeDoc, documentText, speechMarks, setSpeechMarks, setCurrentHighlight }: UseAudioManagerProps) => {
    const { toast } = useToast();
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [audioProgress, setAudioProgress] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const [audioCurrentTime, setAudioCurrentTime] = useState(0);
    const [availableVoices, setAvailableVoices] = useState<AvailableVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState('openai/alloy');
    const [speakingRate, setSpeakingRate] = useState(1);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [generationState, setGenerationState] = useState<'idle' | 'generating' | 'error'>('idle');
    const audioRef = useRef<HTMLAudioElement | null>(null);
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
    }, [playbackRate]);

    const handlePlayPause = async () => {
        if (!audioRef.current) return;
        if (isSpeaking) {
          audioRef.current.pause();
        } else if (audioRef.current.src && audioRef.current.src !== window.location.href) { 
          try {
            await audioRef.current.play();
          } catch (error) {
            console.error("Error playing audio:", error);
            toast({ variant: "destructive", title: "Playback Error", description: "Could not play the audio file."});
          }
        }
    };

    const handleGenerateAudio = async (setActiveDoc: (doc: Document) => void, fetchUserDocuments: () => void) => {
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
            const updatedDoc = await saveDocument({ id: activeDoc.id, audioUrl: newAudioUrl, speechMarks: result.speechMarks }, IS_STAGING);
            
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

    const handleAudioTimeUpdate = () => {
        if (!audioRef.current) return;
        const currentTime = audioRef.current.currentTime;
        const currentTimeMs = currentTime * 1000;
        setAudioCurrentTime(currentTime);

        if (audioDuration > 0) {
            setAudioProgress((currentTime / audioDuration) * 100);
        }

        if (speechMarks.length > 0) {
            const currentWord = speechMarks.find(mark => mark.type === 'word' && currentTimeMs >= mark.time && currentTimeMs < (mark.time + (mark.end - mark.start) * 10)); // Heuristic for word duration
            const currentSentence = speechMarks.find(mark => mark.type === 'sentence' && currentTimeMs >= mark.time && currentTimeMs < (mark.time + (mark.end - mark.start) * 20));
            
            if (currentWord) {
                setCurrentHighlight({ type: 'word', start: currentWord.start, end: currentWord.end });
            } else if (currentSentence) {
                setCurrentHighlight({ type: 'sentence', start: currentSentence.start, end: currentSentence.end });
            } else {
                setCurrentHighlight(null);
            }
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

    const handleSeek = (value: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = value;
            setAudioCurrentTime(value);
        }
    };

    const handleForward = () => {
        if (audioRef.current && audioRef.current.duration > 0) {
            const newTime = Math.min(audioRef.current.currentTime + 10, audioRef.current.duration);
            handleSeek(newTime);
        }
    };

    const handleRewind = () => {
        if (audioRef.current && audioRef.current.duration > 0) {
            const newTime = Math.max(audioRef.current.currentTime - 10, 0);
            handleSeek(newTime);
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
        audioRef,
        previewAudioRef,
        isSpeaking,
        setIsSpeaking,
        audioProgress,
        audioDuration,
        setAudioDuration,
        audioCurrentTime,
        setAudioCurrentTime,
        availableVoices,
        selectedVoice,
        setSelectedVoice,
        speakingRate,
        setSpeakingRate,
        playbackRate,
        setPlaybackRate,
        generationState,
        setGenerationState,
        handlePlayPause,
        handleGenerateAudio,
        handleAudioTimeUpdate,
        handlePreviewVoice,
        handleSeek,
        handleForward,
        handleRewind,
        getProcessingMessage,
    };
};
