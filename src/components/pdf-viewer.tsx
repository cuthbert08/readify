
'use client';

import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// Use the local worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();


interface PdfViewerProps {
  pdfUrl: string | null;
  scale: number;
  onLoadSuccess: (pdf: PDFDocumentProxy) => void;
  numPages: number | null;
}

const PdfViewer: React.FC<PdfViewerProps> = React.memo(({ pdfUrl, scale, onLoadSuccess, numPages }) => {
  const [loading, setLoading] = useState(true);

  const onDocumentLoadSuccess = (pdf: PDFDocumentProxy) => {
    onLoadSuccess(pdf);
    setLoading(false);
  };
  
  const loadingArray = Array.from(new Array(numPages || 3), (_, index) => index);

  return (
    <div className="w-full h-full p-4 overflow-auto flex justify-center">
      <Document
        file={pdfUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={(error) => {
          console.error('Failed to load PDF:', error);
          setLoading(false);
        }}
        loading={
            <div className="space-y-4 p-4">
                {loadingArray.map((i) => (
                    <Skeleton key={i} className="h-[842px] w-[595px] rounded-md mx-auto" />
                ))}
            </div>
        }
        className={cn(loading && 'hidden')}
      >
        {Array.from(new Array(numPages), (_, index) => (
          <div key={`page_${index + 1}`} id={`page-${index}`} className="relative mx-auto mb-4 shadow-lg">
             <Page
                pageNumber={index + 1}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                loading={<Skeleton className="h-[842px] w-[595px] rounded-md mx-auto" />}
            />
          </div>
        ))}
      </Document>
    </div>
  );
});

PdfViewer.displayName = 'PdfViewer';

export default PdfViewer;
