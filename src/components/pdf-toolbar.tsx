import React from 'react';
import { Button } from './ui/button';
import { ZoomIn, ZoomOut, Minimize, Maximize } from 'lucide-react';
import { Separator } from './ui/separator';

type PdfToolbarProps = {
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFullScreen: () => void;
  isFullScreen: boolean;
};

const PdfToolbar: React.FC<PdfToolbarProps> = ({
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onFullScreen,
  isFullScreen,
}) => {
  return (
    <div className="flex items-center gap-2 p-1 rounded-md bg-muted text-muted-foreground">
      <Button variant="ghost" size="icon" onClick={onZoomOut} disabled={zoomLevel <= 0.4}>
        <ZoomOut />
        <span className="sr-only">Zoom Out</span>
      </Button>
      <span className="text-sm font-semibold w-12 text-center">{(zoomLevel * 100).toFixed(0)}%</span>
      <Button variant="ghost" size="icon" onClick={onZoomIn} disabled={zoomLevel >= 3}>
        <ZoomIn />
        <span className="sr-only">Zoom In</span>
      </Button>
      <Separator orientation="vertical" className="h-6" />
      <Button variant="ghost" size="icon" onClick={onFullScreen}>
        {isFullScreen ? <Minimize /> : <Maximize />}
        <span className="sr-only">{isFullScreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
      </Button>
    </div>
  );
};

export default PdfToolbar;
