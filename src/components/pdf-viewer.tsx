
'use client';

import React, { useRef, useEffect, useState } from 'react';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import type { TextItem as PdfTextItem } from 'pdfjs-dist/types/src/display/api';
import { Skeleton } from './ui/skeleton';
import type { WordTimestamp } from '@/ai/schemas';

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
  highlightWord: WordTimestamp | null;
  onTextSelect: (text: string, pageNumber: number, rect: DOMRect) => void;
};

const PageCanvas: React.FC<{
    page: PDFPageProxy;
    scale: number;
    textItems: TextItem[];
    highlightWord: WordTimestamp | null;
    onTextSelect: (text: string, pageNumber: number, rect: DOMRect) => void;
}> = React.memo(({ page, scale, textItems, highlightWord, onTextSelect }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const highlightContainerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [textLayerItems, setTextLayerItems] = useState<React.ReactNode[]>([]);
  const highlightRef = useRef<HTMLDivElement>(null);

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
            const textLayerSpans = textContent.items.map((item, index) => {
                const textItem = item as PdfTextItem;
                const tx = textItem.transform;
                const style: React.CSSProperties = {
                    left: `${tx[4]}px`,
                    top: `${tx[5]}px`,
                    height: `${textItem.height}px`,
                    width: `${textItem.width}px`,
                    fontFamily: 'sans-serif',
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

  useEffect(() => {
    if (highlightRef.current) {
        const element = highlightRef.current;
        const parent = element.offsetParent?.parentElement; // The scrolling container
        if (parent) {
            const elementRect = element.getBoundingClientRect();
            const parentRect = parent.getBoundingClientRect();

            if (
                elementRect.top < parentRect.top ||
                elementRect.bottom > parentRect.bottom
            ) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
  }, [highlightWord]);

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
    if (!highlightWord || !textItems.length || !isRendered) return [];
  
    const pageText = textItems.map(item => item.text).join('');
    const wordText = highlightWord.word.trim();
    if (!wordText) return [];

    let startIndex = -1;
    let textPosition = 0;
    
    for (const item of textItems) {
      const itemText = item.text;
      const wordIndexInItem = itemText.indexOf(wordText);
      if (wordIndexInItem !== -1) {
        // A simple check to see if this is roughly the right place in the text
        const estimatedChars = highlightWord.start * 20; // 20 chars per second rough estimate
        if (Math.abs(textPosition - estimatedChars) < 500) { // Check within a reasonable character window
          startIndex = textPosition + wordIndexInItem;
          break;
        }
      }
      textPosition += itemText.length;
    }


    if (startIndex === -1) return [];

    let charIndex = startIndex;
    const endIndex = startIndex + wordText.length;
    const boxes: React.ReactElement[] = [];
    
    let textItemIndex = -1;
    let accumulatedLen = 0;
    
    for(let i=0; i<textItems.length; i++){
        if(accumulatedLen + textItems[i].text.length > startIndex){
            textItemIndex = i;
            break;
        }
        accumulatedLen += textItems[i].text.length;
    }
    
    if(textItemIndex === -1) return [];

    let offsetInTextItem = startIndex - accumulatedLen;

    for (let i = textItemIndex; i < textItems.length && charIndex < endIndex; i++) {
        const item = textItems[i];
        if (!item || !item.text) continue;
        const itemText = item.text;

        for (let j = offsetInTextItem; j < itemText.length && charIndex < endIndex; j++) {
            const viewport = page.getViewport({ scale });
            const [fontSize, , , , left, top] = item.transform;
            const charWidth = item.width / item.text.length;

            const boxLeft = left + (j * charWidth);
            const boxTop = viewport.height - top - item.height;

            const box = (
                 <div
                    ref={charIndex === startIndex ? highlightRef : null}
                    key={`${charIndex}-${i}-${j}`}
                    className="highlight-box absolute bg-primary/30 rounded-sm"
                    style={{
                        left: `${boxLeft}px`,
                        top: `${boxTop}px`,
                        width: `${charWidth}px`,
                        height: `${item.height}px`,
                    }}
                />
            );
            boxes.push(box);

            charIndex++;
        }
        offsetInTextItem = 0; 
    }
    return boxes;
  };

  return (
    <div ref={pageRef} className="relative mx-auto mb-4 shadow-lg" style={{ width: page.getViewport({ scale }).width, height: page.getViewport({ scale }).height }}>
        <canvas ref={canvasRef} />
        {isRendered && (
             <div ref={textLayerRef} className="absolute inset-0 textLayer" onMouseUp={handleMouseUp}>
                {textLayerItems}
             </div>
        )}
        <div ref={highlightContainerRef} className="absolute inset-0 pointer-events-none">
            {getHighlightBoxes()}
        </div>
    </div>
  );
});
PageCanvas.displayName = "PageCanvas";

const PdfViewer: React.FC<PdfViewerProps> = React.memo(({ pdfDoc, scale, allTextItems, highlightWord, onTextSelect }) => {
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
    <div className="w-full h-full p-4 overflow-auto">
      {pages.map((page, index) => (
        <PageCanvas 
            key={`page-${page.pageNumber}`} 
            page={page} 
            scale={scale}
            textItems={allTextItems.filter(item => item.pageNumber === page.pageNumber)}
            highlightWord={highlightWord}
            onTextSelect={onTextSelect}
        />
      ))}
    </div>
  );
});
PdfViewer.displayName = "PdfViewer";

export default PdfViewer;
