
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Loader2, ZoomIn, ZoomOut, Maximize, Minimize, Download, Wind, FastForward, Rewind } from 'lucide-react';
import { Card } from './ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Slider } from './ui/slider';

type AudioPlayerProps = {
  isSpeaking: boolean;
  processingStage: 'idle' | 'cleaning' | 'generating' | 'syncing' | 'error';
  processingMessage: string;
  onPlayPause: () => void;
  canPlay: boolean;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  isFullScreen: boolean;
  onFullScreen: () => void;
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
  onZoomIn,
  onZoomOut,
  onFullScreen,
  isFullScreen,
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

  return (
    <div className="p-2 md:p-4 w-full">
      <Card className="max-w-xl mx-auto p-3 shadow-2xl bg-card/90 backdrop-blur-sm">
        {isGeneratingSpeech ? (
             <div className="flex items-center justify-center gap-2 h-16">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium text-muted-foreground">{processingMessage}</span>
            </div>
        ) : (
            <div className="flex items-center justify-between gap-4">
                <Button variant="ghost" size="icon" onClick={onRewind} disabled={!showDownload}>
                    <Rewind />
                    <span className="sr-only">Rewind 10s</span>
                </Button>
                <Button 
                    onClick={onPlayPause} 
                    size="lg" 
                    className="rounded-full w-16 h-16 bg-primary hover:bg-primary/90 text-primary-foreground"
                    aria-label={isSpeaking ? 'Pause' : 'Play'}
                    disabled={isGeneratingSpeech || !canPlay}
                >
                    {isSpeaking ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={onForward} disabled={!showDownload}>
                    <FastForward />
                    <span className="sr-only">Forward 10s</span>
                </Button>
            </div>
        )}
        <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-mono">{formatTime(currentTime)}</span>
            <Slider
                value={[currentTime]}
                max={duration}
                step={1}
                onValueChange={(value) => onSeek(value[0])}
                disabled={!showDownload}
                className="w-full"
            />
            <span className="text-xs font-mono">{formatTime(duration)}</span>
        </div>
        <div className="flex items-center justify-center gap-1 mt-2">
             <Button variant="ghost" size="sm" onClick={onZoomOut}>
                <ZoomOut />
                <span className="sr-only">Zoom Out</span>
            </Button>
             <Button variant="ghost" size="sm" onClick={onZoomIn}>
                <ZoomIn />
                <span className="sr-only">Zoom In</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={onFullScreen}>
                {isFullScreen ? <Minimize /> : <Maximize />}
                <span className="sr-only">{isFullScreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                     <Wind />
                     <span className="sr-only">Playback Speed</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  {playbackRates.map(rate => (
                     <DropdownMenuItem key={rate} onClick={() => onPlaybackRateChange(rate)}>
                        {rate === playbackRate && '✓'} {rate}x
                     </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
            </DropdownMenu>
            <a href={showDownload ? downloadUrl : undefined} download={showDownload ? downloadFileName : undefined}>
                <Button variant="ghost" size="sm" disabled={!showDownload}>
                  <Download />
                  <span className="sr-only">Download Audio</span>
                </Button>
            </a>
        </div>
      </Card>
    </div>
  );
};

export default AudioPlayer;
