'use client';

import React, { useRef, useEffect, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import { Skeleton } from './ui/skeleton';

type PdfViewerProps = {
  pdfDoc: PDFDocumentProxy | null;
  scale: number;
};

const PageCanvas: React.FC<{ page: PDFPageProxy; scale: number; }> = ({ page, scale }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const viewport = page.getViewport({ scale });
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.height = viewport.height;
    canvas.width = viewport.width;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    let renderTask = page.render(renderContext);

    return () => {
      renderTask.cancel();
    };
  }, [page, scale]);

  return <canvas ref={canvasRef} className="mx-auto mb-4 shadow-lg" />;
};


const PdfViewer: React.FC<PdfViewerProps> = ({ pdfDoc, scale }) => {
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pdfDoc) return;

    const fetchPages = async () => {
      setLoading(true);
      const allPages: PDFPageProxy[] = [];
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        allPages.push(page);
      }
      setPages(allPages);
      setLoading(false);
    };

    fetchPages();
  }, [pdfDoc]);

  if (loading) {
    return (
        <div className="space-y-4">
            <Skeleton className="h-[700px] w-[500px] rounded-md" />
            <Skeleton className="h-[700px] w-[500px] rounded-md" />
        </div>
    );
  }

  return (
    <div className="w-full h-full">
      {pages.map((page, index) => (
        <PageCanvas key={`page-${index + 1}`} page={page} scale={scale} />
      ))}
    </div>
  );
};

export default PdfViewer;
