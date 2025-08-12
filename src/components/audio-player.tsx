
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Loader2, Download, Wind, FastForward, Rewind } from 'lucide-react';
import { Card } from './ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Slider } from './ui/slider';

type AudioPlayerProps = {
  isSpeaking: boolean;
  processingStage: 'idle' | 'generating' | 'error';
  processingMessage: string;
  onPlayPause: () => void;
  canPlay: boolean;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  showDownload: boolean;
  downloadUrl: string;
  downloadFileName: string;
  progress: number;
  duration: number;
  currentTime: number;
  onSeek: (value: number) => void;
  onForward: () => void;
  onRewind: () => void;
};

const playbackRates = [0.75, 1.0, 1.25, 1.5, 2.0];

const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const floorSeconds = Math.floor(seconds);
    const min = Math.floor(floorSeconds / 60);
    const sec = floorSeconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  isSpeaking,
  processingStage,
  processingMessage,
  onPlayPause,
  canPlay,
  playbackRate,
  onPlaybackRateChange,
  showDownload,
  downloadUrl,
  downloadFileName,
  progress,
  duration,
  currentTime,
  onSeek,
  onForward,
  onRewind
}) => {
  const isGeneratingSpeech = processingStage !== 'idle' && processingStage !== 'error';
  const hasAudio = duration > 0;

  return (
    <div className="p-2 md:p-4 w-full">
      <Card className="max-w-xl mx-auto p-4 shadow-2xl bg-card/90 backdrop-blur-sm">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={onRewind} disabled={!hasAudio}>
                    <Rewind className="h-5 w-5" />
                    <span className="sr-only">Rewind 10s</span>
                </Button>
                <Button 
                    onClick={onPlayPause} 
                    size="lg" 
                    className="rounded-full w-14 h-14 bg-primary hover:bg-primary/90 text-primary-foreground"
                    aria-label={isSpeaking ? 'Pause' : 'Play'}
                    disabled={isGeneratingSpeech || !canPlay}
                >
                    {isGeneratingSpeech ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                        isSpeaking ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />
                    )}
                </Button>
                <Button variant="ghost" size="icon" onClick={onForward} disabled={!hasAudio}>
                    <FastForward className="h-5 w-5" />
                    <span className="sr-only">Forward 10s</span>
                </Button>
            </div>
            <div className="flex-1 flex flex-col gap-2">
                 <Slider
                    value={[currentTime]}
                    max={duration || 1}
                    step={1}
                    onValueChange={(value) => onSeek(value[0])}
                    disabled={!hasAudio}
                    className="w-full"
                />
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>{formatTime(currentTime)}</span>
                     {isGeneratingSpeech && <span className="text-xs font-medium">{processingMessage}</span>}
                    <span>{formatTime(duration)}</span>
                </div>
            </div>
             <div className="flex items-center gap-1">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-20" disabled={!hasAudio}>
                        <Wind className="mr-2 h-4 w-4" />
                        {playbackRate.toFixed(2)}x
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center">
                    {playbackRates.map(rate => (
                        <DropdownMenuItem key={rate} onClick={() => onPlaybackRateChange(rate)}>
                            {rate.toFixed(2)}x {rate === 1.0 && "(Normal)"}
                        </DropdownMenuItem>
                    ))}
                    </DropdownMenuContent>
                </DropdownMenu>
                <a href={showDownload ? downloadUrl : undefined} download={showDownload ? downloadFileName : undefined}>
                    <Button variant="ghost" size="icon" disabled={!showDownload}>
                        <Download className="h-5 w-5"/>
                        <span className="sr-only">Download Audio</span>
                    </Button>
                </a>
            </div>
        </div>
      </Card>
    </div>
  );
};

export default AudioPlayer;
