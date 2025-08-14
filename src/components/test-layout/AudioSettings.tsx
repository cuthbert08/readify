
'use client';

import React, { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Settings, Volume2, ArrowUp, ArrowDown } from 'lucide-react';
import { type AvailableVoice } from '@/ai/flows/voice-selection';

type AudioSettingsProps = {
    availableVoices: AvailableVoice[];
    selectedVoice: string;
    onSelectedVoiceChange: (voice: string) => void;
    speakingRate: number;
    onSpeakingRateChange: (rate: number) => void;
    isSpeaking: boolean;
    generationState: 'idle' | 'generating' | 'error';
    onPreviewVoice: (voice: string) => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
};

const AudioSettings: React.FC<AudioSettingsProps> = ({
    availableVoices,
    selectedVoice,
    onSelectedVoiceChange,
    speakingRate,
    onSpeakingRateChange,
    isSpeaking,
    generationState,
    onPreviewVoice,
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
                    <Settings />
                    Audio Settings
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
                <div className='space-y-2'>
                    <Label>Voice</Label>
                    <Select value={selectedVoice} onValueChange={onSelectedVoiceChange} disabled={isSpeaking || generationState === 'generating'}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a voice"/>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(groupedVoices).map(([provider, voices]) => (
                              <SelectGroup key={provider}>
                                  <Label className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{provider.toUpperCase()}</Label>
                                  {voices.map((voice) => (
                                  <div key={voice.name} className="flex items-center justify-between pr-2">
                                      <SelectItem value={voice.name} className="flex-1">
                                          {voice.displayName} ({voice.gender})
                                      </SelectItem>
                                      <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-7 w-7 ml-2 shrink-0"
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              onPreviewVoice(voice.name);
                                          }}
                                          aria-label={`Preview voice ${voice.name}`}
                                      >
                                          <Volume2 className="h-4 w-4" />
                                      </Button>
                                  </div>
                                  ))}
                              </SelectGroup>
                          ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className='space-y-2'>
                    <Label htmlFor="speaking-rate">Speaking Rate: {speakingRate.toFixed(2)}x</Label>
                    <Slider id="speaking-rate" min={0.25} max={4.0} step={0.25} value={[speakingRate]} onValueChange={(v) => onSpeakingRateChange(v[0])} disabled={isSpeaking || generationState === 'generating'} />
                </div>
            </div>
        </div>
    );
}

export default AudioSettings;
