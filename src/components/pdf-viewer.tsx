
'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, TextContent } from 'pdfjs-dist/types/src/display/api';
import { Skeleton } from './ui/skeleton';
import 'pdfjs-dist/web/pdf_viewer.css';

const Page: React.FC<{ pagePromise: Promise<PDFPageProxy>; scale: number; pageIndex: number }> = React.memo(({ pagePromise, scale, pageIndex }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);
    const [page, setPage] = useState<PDFPageProxy | null>(null);
    const [viewport, setViewport] = useState<pdfjsLib.PageViewport | null>(null);

    useEffect(() => {
        pagePromise.then(setPage);
    }, [pagePromise]);

    useEffect(() => {
        if (page) {
            setViewport(page.getViewport({ scale }));
        }
    }, [page, scale]);

    useEffect(() => {
        const renderPage = async () => {
            if (!page || !viewport || !canvasRef.current || !textLayerRef.current) return;

            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            if (!context) return;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };

            await page.render(renderContext).promise;

            const textContent = await page.getTextContent();
            
            const textLayer = textLayerRef.current;
            textLayer.innerHTML = '';
            textLayer.style.width = `${viewport.width}px`;
            textLayer.style.height = `${viewport.height}px`;

            const textLayerBuilder = new pdfjsLib.TextLayerBuilder({
                textLayerDiv: textLayer,
                pageIndex: page.pageIndex,
                viewport,
            });

            textLayerBuilder.setTextContent(textContent);
            textLayerBuilder.render();

        };
        renderPage();
    }, [page, viewport]);
    
    return (
        <div id={`page-${pageIndex}`} className="relative mx-auto mb-4 shadow-lg" style={{ width: viewport?.width, height: viewport?.height }}>
            <canvas ref={canvasRef} />
            <div ref={textLayerRef} className="textLayer" />
        </div>
    );
});
Page.displayName = "Page";

interface PdfViewerProps {
    pdfUrl: string | null;
    scale: number;
}

const PdfViewer: React.FC<PdfViewerProps> = React.memo(({ pdfUrl, scale }) => {
    const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setDoc(null);
        if (!pdfUrl) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        loadingTask.promise.then(
            (pdfDoc) => {
                setDoc(pdfDoc);
                setLoading(false);
            },
            (reason) => {
                console.error("Error loading PDF:", reason);
                setLoading(false);
            }
        );

        return () => {
            loadingTask.destroy();
        };
    }, [pdfUrl]);

    if (loading) {
        return (
            <div className="space-y-4 p-4">
                <Skeleton className="h-[842px] w-[595px] rounded-md mx-auto" />
                <Skeleton className="h-[842px] w-[595px] rounded-md mx-auto" />
            </div>
        );
    }

    if (!doc) {
        return null;
    }

    return (
        <div className="w-full h-full p-4 overflow-auto flex justify-center">
            <div>
                {Array.from({ length: doc.numPages }, (_, i) => (
                    <Page 
                        key={`page-${i}`}
                        pagePromise={doc.getPage(i + 1)} 
                        scale={scale}
                        pageIndex={i}
                    />
                ))}
            </div>
        </div>
    );
});
PdfViewer.displayName = "PdfViewer";

export default PdfViewer;
