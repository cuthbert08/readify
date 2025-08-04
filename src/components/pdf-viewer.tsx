'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import type { TextItem as PdfTextItem, TextContent } from 'pdfjs-dist/types/src/display/api';
import * as pdfjsLib from 'pdfjs-dist';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import type { Sentence } from '@/ai/schemas';

export type TextItem = {
    text: string;
    transform: number[];
    width: number;
    height: number;
    pageNumber: number;
};

type PdfViewerProps = {
  pdfDoc: PDFDocumentProxy | null;
  scale: number;
  allTextItems: TextItem[];
  highlightSentence: Sentence | null;
  onTextSelect: (text: string, pageNumber: number, rect: DOMRect) => void;
};

const PageCanvas: React.FC<{
    page: PDFPageProxy;
    scale: number;
    textItems: TextItem[];
    highlightSentence: Sentence | null;
    onTextSelect: (text: string, pageNumber: number, rect: DOMRect) => void;
}> = React.memo(({ page, scale, textItems, highlightSentence, onTextSelect }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !page) return;

    const viewport = page.getViewport({ scale });
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    let renderTask = page.render(renderContext);
    renderTask.promise.then(async () => {
        setIsRendered(true);
        // Render text layer
        if (textLayerRef.current) {
            const textContent = await page.getTextContent();
            textLayerRef.current.innerHTML = ''; // Clear previous text layer
            pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayerRef.current,
                viewport: viewport,
                textDivs: []
            });
        }
    });

    return () => {
      renderTask.cancel();
    };
  }, [page, scale]);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const selectedText = range.toString().trim();
    
    if (selectedText && textLayerRef.current) {
        const rect = range.getBoundingClientRect();
        onTextSelect(selectedText, page.pageNumber, rect);
    }
  }

  const getHighlightBoxes = (): React.CSSProperties[] => {
    if (!highlightSentence || !textItems.length || !isRendered) return [];
  
    const sentenceText = highlightSentence.text.trim();
  
    // This is a simplified approach. A real implementation would need to handle
    // sentences spanning multiple text items and partial matches.
    const itemsInSentence: TextItem[] = [];
    let remainingSentence = sentenceText;
    
    const fullText = allTextItems.map(i => i.text).join('');
    const startIndex = fullText.indexOf(sentenceText);

    if (startIndex === -1) return [];

    let charCount = 0;
    let sentenceItems: TextItem[] = [];
    for(const item of allTextItems) {
        if(charCount + item.text.length > startIndex && charCount < startIndex + sentenceText.length) {
            if (item.pageNumber === page.pageNumber) {
                sentenceItems.push(item);
            }
        }
        charCount += item.text.length;
    }


    if (sentenceItems.length > 0) {
       const firstItem = sentenceItems[0];
       const lastItem = sentenceItems[sentenceItems.length - 1];
       
       const startX = firstItem.transform[4];
       const startY = firstItem.transform[5] - firstItem.height;

       const endX = lastItem.transform[4] + lastItem.width;
       
       return [{
           left: `${startX * scale}px`,
           top: `${startY * scale}px`,
           width: `${(endX - startX) * scale}px`,
           height: `${firstItem.height * scale * 1.2}px`,
           position: 'absolute',
           backgroundColor: 'rgba(255, 255, 0, 0.4)',
           zIndex: 2,
           pointerEvents: 'none',
           borderRadius: '2px',
       }]

    }
  
    return [];
  };

  return (
    <div className="relative mx-auto mb-4 shadow-lg" style={{ width: page.getViewport({ scale }).width, height: page.getViewport({ scale }).height }}>
        <canvas ref={canvasRef} />
        {isRendered && (
             <div ref={textLayerRef} className="absolute inset-0 textLayer" onMouseUp={handleMouseUp}>
                {/* Text layer content is now rendered by pdfjsLib.renderTextLayer */}
             </div>
        )}
        {getHighlightBoxes().map((style, i) => <div key={i} style={style} />)}
    </div>
  );
});
PageCanvas.displayName = "PageCanvas";

const PdfViewer: React.FC<PdfViewerProps> = React.memo(({ pdfDoc, scale, allTextItems, highlightSentence, onTextSelect }) => {
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pdfDoc) return;

    const fetchPages = async () => {
      setLoading(true);
      const allPages: PDFPageProxy[] = [];
      try {
        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            allPages.push(page);
        }
        setPages(allPages);
      } catch (error) {
        console.error("Error fetching pages", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, [pdfDoc]);

  if (loading) {
    return (
        <div className="space-y-4 p-4">
            <Skeleton className="h-[842px] w-[595px] rounded-md mx-auto" />
            <Skeleton className="h-[842px] w-[595px] rounded-md mx-auto" />
        </div>
    );
  }

  return (
    <div className="w-full h-full p-4">
      {pages.map((page, index) => (
        <PageCanvas 
            key={`page-${page.pageNumber}`} 
            page={page} 
            scale={scale}
            textItems={allTextItems.filter(item => item.pageNumber === page.pageNumber)}
            highlightSentence={highlightSentence}
            onTextSelect={onTextSelect}
        />
      ))}
    </div>
  );
});
PdfViewer.displayName = "PdfViewer";

export default PdfViewer;
