'use client';

import React, { useRef, useEffect } from 'react';
import type { PDFDocumentProxy, TextContent, PageViewport, RenderTask } from 'pdfjs-dist/types/src/display/api';
import { TextLayer } from 'pdfjs-dist/build/pdf';

type PdfViewerProps = {
  pdfDoc: PDFDocumentProxy | null;
  pageNumber: number;
  textContent: TextContent | null;
  viewport: PageViewport | null;
};

const PdfViewer: React.FC<PdfViewerProps> = ({ pdfDoc, pageNumber, textContent, viewport }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !textLayerRef.current || !viewport) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    const canvas = canvasRef.current;
    const textLayerDiv = textLayerRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    textLayerDiv.innerHTML = '';
    textLayerDiv.style.width = `${viewport.width}px`;
    textLayerDiv.style.height = `${viewport.height}px`;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        
        // Ensure rendering is not cancelled before starting.
        if (renderTaskRef.current) {
          return;
        }

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        
        await renderTask.promise;

        if (textContent) {
            const textLayer = new TextLayer({
                textContentSource: textContent,
                container: textLayerDiv,
                viewport: viewport,
            });
            textLayer.render();
        }
      } catch (error: any) {
        if (error.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', error);
        }
      } finally {
        if (renderTaskRef.current) {
            renderTaskRef.current = null;
        }
      }
    };

    renderPage();

    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };

  }, [pdfDoc, pageNumber, textContent, viewport]);
  
  return (
    <div className="relative mx-auto shadow-lg" style={{ width: viewport?.width, height: viewport?.height }}>
      <canvas ref={canvasRef} className="w-full h-full" />
      <div 
        ref={textLayerRef}
        className="textLayer absolute top-0 left-0 w-full h-full"
      />
    </div>
  );
};

export default PdfViewer;
