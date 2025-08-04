'use client';

import React, { useRef, useEffect, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import type { TextItem as PdfTextItem } from 'pdfjs-dist/types/src/display/api';
import { Skeleton } from './ui/skeleton';
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
  const [textLayerItems, setTextLayerItems] = useState<React.ReactNode[]>([]);

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
        if (textLayerRef.current) {
            const textContent = await page.getTextContent();
            // Manually render text layer for selection
            const textLayerSpans = textContent.items.map((item, index) => {
                const textItem = item as PdfTextItem;
                const tx = textItem.transform;
                const style: React.CSSProperties = {
                    left: `${tx[4]}px`,
                    top: `${tx[5]}px`,
                    height: `${textItem.height}px`,
                    width: `${textItem.width}px`,
                    fontFamily: 'sans-serif', // Should match PDF font if possible
                    fontSize: `${Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1])}px`,
                    transform: `scaleX(${tx[0]})`,
                    position: 'absolute',
                    whiteSpace: 'pre',
                    color: 'transparent',
                    WebkitFontSmoothing: 'antialiased',
                    transformOrigin: '0% 0%',
                };

                return <span key={index} style={style}>{textItem.str}</span>;
            });
            setTextLayerItems(textLayerSpans);
        }
    });

    return () => {
      renderTask.cancel();
    };
  }, [page, scale]);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return;
    };
    
    const range = selection.getRangeAt(0);
    const selectedText = range.toString().trim();
    
    if (selectedText && textLayerRef.current) {
        const rect = range.getBoundingClientRect();
        onTextSelect(selectedText, page.pageNumber, rect);
    }
  }

  const getHighlightBoxes = (): React.ReactElement[] => {
    if (!highlightSentence || !textItems.length || !isRendered) return [];
  
    // Highlighting based on sentence is disabled as it's not supported by the current TTS engine.
    // This function is kept for potential future use if a different TTS engine is used.
    return [];
  };

  return (
    <div className="relative mx-auto mb-4 shadow-lg" style={{ width: page.getViewport({ scale }).width, height: page.getViewport({ scale }).height }}>
        <canvas ref={canvasRef} />
        {isRendered && (
             <div ref={textLayerRef} className="absolute inset-0 textLayer" onMouseUp={handleMouseUp}>
                {textLayerItems}
             </div>
        )}
        {getHighlightBoxes()}
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
