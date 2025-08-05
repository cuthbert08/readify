
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, TextItem } from 'pdfjs-dist/types/src/display/api';
import { Skeleton } from './ui/skeleton';

// Add CSS to make the text layer selectable but invisible
const textLayerStyle = `
.textLayer {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
    opacity: 0.25;
    line-height: 1.0;
}
.textLayer > span {
    color: transparent;
    position: absolute;
    white-space: pre;
    cursor: text;
    transform-origin: 0% 0%;
}
.textLayer ::selection {
    background-color: hsl(var(--primary) / 0.3);
}
`;


const PageCanvas: React.FC<{
    page: PDFPageProxy;
    scale: number;
    onTextSelect: (text: string, pageNumber: number, rect: DOMRect) => void;
}> = React.memo(({ page, scale, onTextSelect }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const pageContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const pageContainer = pageContainerRef.current;
        const textLayer = textLayerRef.current;
        if (!canvas || !pageContainer || !textLayer) return;

        const viewport = page.getViewport({ scale });
        const context = canvas.getContext('2d');
        if (!context) return;

        pageContainer.style.width = `${viewport.width}px`;
        pageContainer.style.height = `${viewport.height}px`;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport,
        };

        let renderTask = page.render(renderContext);
        
        renderTask.promise.then(async () => {
            const textContent = await page.getTextContent();
            
            textLayer.innerHTML = '';

            pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayer,
                viewport: viewport,
                textDivs: []
            });
        });

        return () => {
            renderTask.cancel();
        };
    }, [page, scale]);

    const handleMouseUp = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            return;
        }

        const range = selection.getRangeAt(0);
        const selectedText = range.toString().trim();

        if (selectedText && textLayerRef.current) {
            const containerRect = textLayerRef.current.getBoundingClientRect();
            const rangeRects = range.getClientRects();
            
            if (rangeRects.length > 0) {
                const firstRect = rangeRects[0];
                const lastRect = rangeRects[rangeRects.length - 1];
                
                const combinedRect = new DOMRect(
                    firstRect.left,
                    firstRect.top,
                    lastRect.right - firstRect.left,
                    lastRect.bottom - firstRect.top
                );

                onTextSelect(selectedText, page.pageNumber, combinedRect);
            }
        }
    }

    return (
        <div ref={pageContainerRef} className="relative mx-auto mb-4 shadow-lg">
            <canvas ref={canvasRef} />
            <div ref={textLayerRef} className="textLayer" onMouseUp={handleMouseUp} />
        </div>
    );
});
PageCanvas.displayName = "PageCanvas";

const PdfViewer: React.FC<PdfViewerProps> = React.memo(({ pdfDoc, scale, onTextSelect }) => {
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
        <>
            <style>{textLayerStyle}</style>
            <div className="w-full h-full p-4 overflow-auto">
                {pages.map((page) => (
                    <PageCanvas 
                        key={`page-${page.pageNumber}`} 
                        page={page} 
                        scale={scale}
                        onTextSelect={onTextSelect}
                    />
                ))}
            </div>
        </>
    );
});
PdfViewer.displayName = "PdfViewer";

export default PdfViewer;
