
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Loader2, ZoomIn, ZoomOut, Maximize, Minimize, Download, Wind } from 'lucide-react';
import { Card } from './ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Separator } from './ui/separator';

type AudioPlayerProps = {
  isSpeaking: boolean;
  isGeneratingSpeech: boolean;
  onPlayPause: () => void;
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
};

const playbackRates = [0.75, 1.0, 1.25, 1.5, 2.0];

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  isSpeaking,
  isGeneratingSpeech,
  onPlayPause,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  isFullScreen,
  onFullScreen,
  playbackRate,
  onPlaybackRateChange,
  showDownload,
  downloadUrl,
  downloadFileName,
}) => {
  return (
    <div className="p-2 md:p-4 w-full">
      <Card className="max-w-md mx-auto p-2 md:p-3 shadow-2xl bg-card/90 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
           {/* Left Controls */}
           <div className="flex items-center gap-1">
             <Button variant="ghost" size="icon" onClick={onZoomOut} disabled={zoomLevel <= 0.4}>
                <ZoomOut />
                <span className="sr-only">Zoom Out</span>
            </Button>
             <Button variant="ghost" size="icon" onClick={onZoomIn} disabled={zoomLevel >= 3}>
                <ZoomIn />
                <span className="sr-only">Zoom In</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={onFullScreen}>
                {isFullScreen ? <Minimize /> : <Maximize />}
                <span className="sr-only">{isFullScreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
            </Button>
          </div>

          {/* Center Control */}
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

          {/* Right Controls */}
           <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                     <Wind />
                     <span className="sr-only">Playback Speed</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {playbackRates.map(rate => (
                     <DropdownMenuItem key={rate} onClick={() => onPlaybackRateChange(rate)}>
                        {rate === playbackRate && '✓'} {rate}x
                     </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

            <a href={showDownload ? downloadUrl : undefined} download={showDownload ? downloadFileName : undefined}>
                <Button variant="ghost" size="icon" disabled={!showDownload}>
                  <Download />
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
