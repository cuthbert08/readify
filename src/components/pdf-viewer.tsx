
'use client';

import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';

// Set up the worker
// This is the recommended approach for Next.js and other bundlers
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;


type PdfViewerProps = {
  file: string;
  zoomLevel: number;
};

const PdfViewer: React.FC<PdfViewerProps> = ({ 
    file, 
    zoomLevel, 
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
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

  const goToPrevPage = () => {
    setPageNumber((prevPageNumber) => Math.max(prevPageNumber - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prevPageNumber) => Math.min(prevPageNumber + 1, numPages!));
  };

  return (
    <div className="flex flex-col h-full w-full bg-muted">
      <div className="flex-1 overflow-auto relative flex items-start justify-center pt-4">
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex items-center space-x-2 pt-20">
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
    </div>
  );
};

export default PdfViewer;
