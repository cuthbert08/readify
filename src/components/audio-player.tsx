'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Pause, ArrowLeft, ArrowRight, Loader2, Volume2 } from 'lucide-react';
import { Card } from './ui/card';
import type { AvailableVoicesOutput } from '@/ai/flows/voice-selection';

type AudioPlayerProps = {
  isSpeaking: boolean;
  isGeneratingSpeech: boolean;
  onPlayPause: () => void;
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  availableVoices: AvailableVoicesOutput;
  selectedVoice: string | null;
  onVoiceChange: (voice: string | null) => void;
  onPreviewVoice: (voice: string) => void;
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  isSpeaking,
  isGeneratingSpeech,
  onPlayPause,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
  availableVoices,
  selectedVoice,
  onVoiceChange,
  onPreviewVoice,
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
              disabled={currentPage <= 1 || isSpeaking || isGeneratingSpeech}
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
              disabled={currentPage >= totalPages || isSpeaking || isGeneratingSpeech}
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
            disabled={isGeneratingSpeech}
          >
            {isGeneratingSpeech ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              isSpeaking ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />
            )}
          </Button>

          <div className="w-48">
            <Select
              value={selectedVoice || ''}
              onValueChange={(name) => onVoiceChange(name)}
              disabled={isSpeaking || isGeneratingSpeech}
            >
              <SelectTrigger aria-label="Select Voice">
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent>
                {availableVoices.map((voice) => (
                  <div key={voice.name} className="flex items-center justify-between pr-2">
                    <SelectItem value={voice.name} className="flex-1">
                      {voice.name} ({voice.lang})
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
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>
    </footer>
  );
};

export default AudioPlayer;
