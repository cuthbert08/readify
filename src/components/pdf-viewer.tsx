'use client';

import React, { useRef, useEffect } from 'react';
import type { PDFDocumentProxy, TextContent, PageViewport, RenderTask } from 'pdfjs-dist/types/src/display/api';
import { TextLayer } from 'pdfjs-dist/build/pdf';

type PdfViewerProps = {
  pdfDoc: PDFDocumentProxy | null;
  pageNumber: number;
  textContent: TextContent | null;
  viewport: PageViewport | null;
  highlightedIndex: number;
};

const PdfViewer: React.FC<PdfViewerProps> = ({ pdfDoc, pageNumber, textContent, viewport, highlightedIndex }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !textLayerRef.current || !viewport) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    const canvas = canvasRef.current;
    const textLayerDiv = textLayerRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    textLayerDiv.innerHTML = '';
    textLayerDiv.style.width = `${viewport.width}px`;
    textLayerDiv.style.height = `${viewport.height}px`;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const renderTask = page.render({ canvasContext: context, viewport: viewport });
        renderTaskRef.current = renderTask;
        
        await renderTask.promise;

        if (textContent) {
            const textLayer = new TextLayer({
                textContentSource: textContent,
                container: textLayerDiv,
                viewport: viewport,
            });
            textLayer.render();
            
            // Apply highlight
            const spans = textLayerDiv.querySelectorAll<HTMLElement>('span');
            spans.forEach((span, index) => {
                if(index === highlightedIndex) {
                    span.style.backgroundColor = 'rgba(126, 87, 194, 0.4)'; // Accent color with opacity
                    span.style.borderRadius = '2px';
                }
            });
        }
      } catch (error: any) {
        if (error.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', error);
        }
      } finally {
        renderTaskRef.current = null;
      }
    };

    renderPage();

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };

  }, [pdfDoc, pageNumber, textContent, viewport, highlightedIndex]);
  
  return (
    <div className="relative mx-auto shadow-lg" style={{ width: viewport?.width, height: viewport?.height }}>
      <canvas ref={canvasRef} />
      <div 
        ref={textLayerRef}
        className="textLayer absolute top-0 left-0"
      />
    </div>
  );
};

export default PdfViewer;
