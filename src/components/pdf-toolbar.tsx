
import React from 'react';
import { Button } from './ui/button';
import { ZoomIn, ZoomOut, Minimize, Maximize, Save, Download, Loader2 } from 'lucide-react';
import { Separator } from './ui/separator';

type PdfToolbarProps = {
  fileName: string;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFullScreen: () => void;
  isFullScreen: boolean;
  showSave: boolean;
  onSave: () => void;
  isSaving: boolean;
  showDownload: boolean;
  downloadUrl: string;
  downloadFileName: string;
};

const PdfToolbar: React.FC<PdfToolbarProps> = ({
  fileName,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onFullScreen,
  isFullScreen,
  showSave,
  onSave,
  isSaving,
  showDownload,
  downloadUrl,
  downloadFileName,
}) => {
  return (
    <div className="p-2">
       <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-card/90 text-card-foreground shadow-lg backdrop-blur-sm max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold truncate max-w-xs md:max-w-md">{fileName || 'Readify'}</h2>
        </div>
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-md bg-muted text-muted-foreground">
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
            {showSave && (
              <Button onClick={onSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                Save
              </Button>
            )}
            {showDownload && (
              <a href={downloadUrl} download={downloadFileName}>
                <Button variant="outline">
                  <Download className="mr-2"/>
                  Download Audio
                </Button>
              </a>
            )}
        </div>
       </div>
    </div>
  );
};

export default PdfToolbar;
