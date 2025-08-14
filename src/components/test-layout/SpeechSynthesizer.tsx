
'use client';

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Loader2, Mic, Download, ArrowUp, ArrowDown } from 'lucide-react';
import { type AvailableVoice } from '@/ai/flows/voice-selection';

type SpeechSynthesizerProps = {
    text: string;
    onTextChange: (text: string) => void;
    availableVoices: AvailableVoice[];
    selectedVoice: string;
    onSelectedVoiceChange: (voice: string) => void;
    speakingRate: number;
    onSpeakingRateChange: (rate: number) => void;
    isSynthesizing: boolean;
    onSynthesize: () => void;
    audioUrl: string | null;
    onMoveUp: () => void;
    onMoveDown: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
};

const SpeechSynthesizer: React.FC<SpeechSynthesizerProps> = ({
    text,
    onTextChange,
    availableVoices,
    selectedVoice,
    onSelectedVoiceChange,
    speakingRate,
    onSpeakingRateChange,
    isSynthesizing,
    onSynthesize,
    audioUrl,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown
}) => {
    const groupedVoices = useMemo(() => {
        return availableVoices.reduce((acc, voice) => {
            const provider = voice.provider;
            if (!acc[provider]) {
                acc[provider] = [];
            }
            acc[provider].push(voice);
            return acc;
        }, {} as Record<string, AvailableVoice[]>);
    }, [availableVoices]);

    return (
        <div>
            <div className="p-2 text-sm font-semibold flex items-center justify-between text-muted-foreground">
                <div className="flex items-center gap-2">
                    <Mic />
                    Speech Synthesizer
                </div>
                 <div className='flex items-center'>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={!canMoveUp}>
                        <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={!canMoveDown}>
                        <ArrowDown className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="p-2 space-y-4">
                <Textarea
                    placeholder="Paste text here to generate audio..."
                    value={text}
                    onChange={(e) => onTextChange(e.target.value)}
                    rows={5}
                />
                <div className='space-y-2'>
                    <Label>Voice</Label>
                    <Select value={selectedVoice} onValueChange={onSelectedVoiceChange} disabled={isSynthesizing}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a voice" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(groupedVoices).map(([provider, voices]) => (
                                <SelectGroup key={provider}>
                                    <Label className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{provider.toUpperCase()}</Label>
                                    {voices.map((voice) => (
                                        <SelectItem key={voice.name} value={voice.name}>
                                            {voice.displayName} ({voice.gender})
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div className='space-y-2'>
                    <Label htmlFor="synth-speaking-rate">Speaking Rate: {speakingRate.toFixed(2)}x</Label>
                    <Slider id="synth-speaking-rate" min={0.25} max={4.0} step={0.25} value={[speakingRate]} onValueChange={(v) => onSpeakingRateChange(v[0])} disabled={isSynthesizing} />
                </div>

                <Button onClick={onSynthesize} disabled={isSynthesizing || !text.trim()} className="w-full">
                    {isSynthesizing ? <Loader2 className="animate-spin" /> : <Mic />}
                    {isSynthesizing ? 'Generating...' : 'Generate Audio'}
                </Button>

                {audioUrl && (
                    <div className='space-y-2'>
                        <audio src={audioUrl} controls className="w-full" />
                        <a href={audioUrl} download="synthesis.mp3">
                            <Button variant="outline" className="w-full">
                                <Download />
                                Download Audio
                            </Button>
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}

export default SpeechSynthesizer;
