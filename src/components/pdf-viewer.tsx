
'use client';

import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import PdfToolbar from './pdf-toolbar';

// Set up the worker
// This is the recommended approach for Next.js and other bundlers
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type PdfViewerProps = {
  file: string;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  isFullScreen: boolean;
  onFullScreenToggle: () => void;
  onSaveZoom: (zoom: number) => void;
};

const PdfViewer: React.FC<PdfViewerProps> = ({ 
    file, 
    zoomLevel, 
    onZoomChange,
    isFullScreen,
    onFullScreenToggle,
    onSaveZoom
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isSavingZoom, setIsSavingZoom] = useState(false);
  const { toast } = useToast();

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF Load Error:", error);
    toast({
      variant: 'destructive',
      title: 'Error loading PDF',
      description: error.message || 'Failed to load the document.',
    });
  };

  const handleZoomIn = () => onZoomChange(Math.min(zoomLevel + 0.2, 3));
  const handleZoomOut = () => onZoomChange(Math.max(zoomLevel - 0.2, 0.4));

  const handleSaveZoom = async () => {
    setIsSavingZoom(true);
    try {
        await onSaveZoom(zoomLevel);
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save zoom level.'});
    } finally {
        setIsSavingZoom(false);
    }
  }

  const goToPrevPage = () => {
    setPageNumber((prevPageNumber) => Math.max(prevPageNumber - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prevPageNumber) => Math.min(prevPageNumber + 1, numPages!));
  };

  return (
    <div className="flex flex-col h-full w-full bg-muted">
      <div className={isFullScreen ? 'hidden' : 'flex-shrink-0'}>
        <PdfToolbar
            fileName={file.split('/').pop() || 'Document'}
            zoomLevel={zoomLevel}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            isFullScreen={isFullScreen}
            onFullScreen={onFullScreenToggle}
            showSave={true}
            onSave={handleSaveZoom}
            isSaving={isSavingZoom}
            showDownload={false}
            downloadUrl=""
            downloadFileName=""
        />
      </div>

      <div className="flex-1 overflow-auto relative flex items-center justify-center">
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex items-center space-x-2">
              <Loader2 className="animate-spin" />
              <span>Loading document...</span>
            </div>
          }
          className="flex justify-center"
        >
          <Page
            pageNumber={pageNumber}
            scale={zoomLevel}
            renderTextLayer={true} // This enables text selection
            renderAnnotationLayer={true}
          />
        </Document>

        {numPages && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-card p-2 rounded-lg shadow-lg">
                <Button onClick={goToPrevPage} disabled={pageNumber <= 1} variant="ghost" size="icon">
                    <ArrowLeft />
                </Button>
                <p className="text-sm font-medium">
                    Page {pageNumber} of {numPages}
                </p>
                <Button onClick={goToNextPage} disabled={pageNumber >= numPages} variant="ghost" size="icon">
                    <ArrowRight />
                </Button>
            </div>
        )}
      </div>

      {isFullScreen && (
          <div className="fixed top-0 left-0 right-0 z-50">
            <PdfToolbar
                fileName={file.split('/').pop() || 'Document'}
                zoomLevel={zoomLevel}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                isFullScreen={isFullScreen}
                onFullScreen={onFullScreenToggle}
                showSave={true}
                onSave={handleSaveZoom}
                isSaving={isSavingZoom}
                showDownload={false}
                downloadUrl=""
                downloadFileName=""
            />
          </div>
      )}
    </div>
  );
};

export default PdfViewer;
