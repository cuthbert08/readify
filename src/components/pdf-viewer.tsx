
'use client';

import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

// Set up the worker with the correct URL
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export type Highlight = {
  start: number;
  end: number;
  type: 'word' | 'sentence';
};

type PdfViewerProps = {
  file: string;
  zoomLevel: number;
  highlight: Highlight | null;
  documentText: string;
};

const PdfViewer: React.FC<PdfViewerProps> = ({ 
    file, 
    zoomLevel, 
    highlight,
    documentText,
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const { toast } = useToast();

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF Load Error:", error);
    toast({
      variant: 'destructive',
      title: 'Error loading PDF',
      description: error.message || 'Failed to load the document.',
    });
  };

  const textRenderer = useCallback((textItem: any) => {
    if (!highlight || !documentText) {
      return textItem.str;
    }
    
    // This is a simplified matching logic. A more robust solution would need to
    // map the PDF text items to the flat documentText string more precisely.
    // For now, we highlight based on string matching.
    const { start, end, type } = highlight;
    const highlightText = documentText.substring(start, end);
    
    if (!highlightText || !textItem.str.includes(highlightText)) {
      return textItem.str;
    }
    
    const parts = textItem.str.split(highlightText);

    return (
      <>
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            {part}
            {index < parts.length - 1 && (
              <mark className={type === 'word' ? 'bg-accent/70' : 'bg-primary/30'}>
                {highlightText}
              </mark>
            )}
          </React.Fragment>
        ))}
      </>
    );

  }, [highlight, documentText]);

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
          className="flex flex-col items-center"
        >
          {/* Render all pages to enable scrolling */}
          {numPages && Array.from(new Array(numPages), (el, index) => (
            <div key={`page_${index + 1}`} className="my-2 shadow-lg">
              <Page
                pageNumber={index + 1}
                scale={zoomLevel}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                customTextRenderer={textRenderer}
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
};

export default PdfViewer;
