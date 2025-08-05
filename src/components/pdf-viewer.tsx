
'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import { Skeleton } from './ui/skeleton';

type PdfViewerProps = {
    pdfDoc: PDFDocumentProxy | null;
    scale: number;
};

const PageCanvas: React.FC<{ page: PDFPageProxy; scale: number }> = React.memo(({ page, scale }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const viewport = page.getViewport({ scale });
        const context = canvas.getContext('2d');
        if(!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport,
        };
        const renderTask = page.render(renderContext);

        return () => {
            renderTask.cancel();
        };
    }, [page, scale]);

    return (
        <div className="mx-auto mb-4 shadow-lg">
            <canvas ref={canvasRef} />
        </div>
    );
});
PageCanvas.displayName = "PageCanvas";

const PdfViewer: React.FC<PdfViewerProps> = React.memo(({ pdfDoc, scale }) => {
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
        <div className="w-full h-full p-4 overflow-auto flex justify-center">
            <div>
                {pages.map((page) => (
                    <PageCanvas key={`page-${page.pageNumber}`} page={page} scale={scale} />
                ))}
            </div>
        </div>
    );
});
PdfViewer.displayName = "PdfViewer";

export default PdfViewer;
