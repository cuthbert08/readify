'use client';

import React, { useRef, useEffect } from 'react';
import type { PDFDocumentProxy, TextContent, PageViewport } from 'pdfjs-dist/types/src/display/api';
import * as pdfjsLib from 'pdfjs-dist';

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

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !textLayerRef.current || !viewport) return;

    const canvas = canvasRef.current;
    const textLayer = textLayerRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    textLayer.style.width = `${viewport.width}px`;
    textLayer.style.height = `${viewport.height}px`;

    const renderTask = pdfDoc.getPage(pageNumber).then(page => {
      return page.render({ canvasContext: context, viewport: viewport }).promise;
    });

    renderTask.then(() => {
        if (textContent) {
            textLayer.innerHTML = '';
            const textLayerFragment = document.createDocumentFragment();
            pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayerFragment,
                viewport: viewport,
                textDivs: []
            });
            textLayer.appendChild(textLayerFragment);
            
            // Apply highlight
            const spans = textLayer.querySelectorAll<HTMLElement>('span');
            spans.forEach((span, index) => {
                if(index === highlightedIndex) {
                    span.style.backgroundColor = 'rgba(126, 87, 194, 0.4)'; // Accent color with opacity
                    span.style.borderRadius = '2px';
                }
            });
        }
    });

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
