'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Pause, ArrowLeft, ArrowRight } from 'lucide-react';
import { Card } from './ui/card';

type AudioPlayerProps = {
  isSpeaking: boolean;
  onPlayPause: () => void;
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  availableVoices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  onVoiceChange: (voice: SpeechSynthesisVoice | null) => void;
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  isSpeaking,
  onPlayPause,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  availableVoices,
  selectedVoice,
  onVoiceChange,
}) => {
  return (
    <footer className="sticky bottom-0 left-0 right-0 w-full p-2 md:p-4 bg-transparent z-50">
      <Card className="max-w-3xl mx-auto p-2 md:p-4 shadow-2xl bg-card/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrevPage}
              disabled={currentPage <= 1 || isSpeaking}
              aria-label="Previous Page"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium w-20 text-center">
              Page {currentPage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNextPage}
              disabled={currentPage >= totalPages || isSpeaking}
              aria-label="Next Page"
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>

          <Button 
            onClick={onPlayPause} 
            size="lg" 
            className="rounded-full w-16 h-16 bg-primary hover:bg-primary/90 text-primary-foreground"
            aria-label={isSpeaking ? 'Pause' : 'Play'}
          >
            {isSpeaking ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
          </Button>

          <div className="w-48">
            <Select
              value={selectedVoice?.name}
              onValueChange={(name) => {
                const voice = availableVoices.find(v => v.name === name) || null;
                onVoiceChange(voice);
              }}
              disabled={isSpeaking}
            >
              <SelectTrigger aria-label="Select Voice">
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent>
                {availableVoices.map((voice) => (
                  <SelectItem key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>
    </footer>
  );
};

export default AudioPlayer;
