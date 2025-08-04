'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, TextContent, PageViewport } from 'pdfjs-dist/types/src/display/api';
import { UploadCloud, FileText } from 'lucide-react';
import PdfViewer from '@/components/pdf-viewer';
import AudioPlayer from '@/components/audio-player';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

// Set the worker source for pdfjs
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;
}

type PdfState = 'idle' | 'loading' | 'loaded' | 'error';

export default function ReadPage() {
  const [pdfState, setPdfState] = useState<PdfState>('idle');
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const [textContent, setTextContent] = useState<TextContent | null>(null);
  const [pageText, setPageText] = useState('');
  const [itemStartIndices, setItemStartIndices] = useState<number[]>([]);
  const [viewport, setViewport] = useState<PageViewport | null>(null);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadVoices = useCallback(() => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      setAvailableVoices(voices);
      setSelectedVoice(voices.find(v => v.default) || voices[0]);
    }
  }, []);

  useEffect(() => {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    }
  }, [loadVoices]);

  const loadPage = useCallback(async (pageNumber: number) => {
    if (!pdfDoc) return;
    try {
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      setViewport(viewport);

      const content = await page.getTextContent();
      setTextContent(content);

      let currentText = '';
      const starts: number[] = [];
      let charAccumulator = 0;

      content.items.forEach(item => {
        const str = (item as any).str || '';
        starts.push(charAccumulator);
        charAccumulator += str.length + 1; // +1 for space
        currentText += str + ' ';
      });

      setPageText(currentText);
      setItemStartIndices(starts);
      setHighlightedIndex(-1);
    } catch (error) {
      console.error('Failed to load page:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to load page ${pageNumber}.`,
      });
    }
  }, [pdfDoc, toast]);

  useEffect(() => {
    if (pdfDoc) {
      loadPage(currentPage);
    }
  }, [pdfDoc, currentPage, loadPage]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      toast({
        variant: "destructive",
        title: "Invalid File",
        description: "Please select a PDF file.",
      });
      return;
    }
    
    setPdfState('loading');
    setFileName(file.name);
    setLoadingProgress(0);

    const fileReader = new FileReader();
    fileReader.onload = async (e) => {
      const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
      try {
        const loadingTask = pdfjsLib.getDocument(typedArray);
        loadingTask.onProgress = ({ loaded, total }) => {
          setLoadingProgress((loaded / total) * 100);
        };
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
        setPdfState('loaded');
      } catch (error) {
        console.error('Failed to load PDF:', error);
        setPdfState('error');
        toast({
          variant: "destructive",
          title: "PDF Load Error",
          description: "Could not read the selected PDF file.",
        });
      }
    };
    fileReader.readAsArrayBuffer(file);
  };
  
  const handlePlayPause = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setHighlightedIndex(-1);
    } else {
      if (!pageText) return;
      const utterance = new SpeechSynthesisUtterance(pageText);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        setHighlightedIndex(-1);
      };
      utterance.onerror = (e) => {
        console.error('Speech synthesis error', e);
        setIsSpeaking(false);
        toast({
            variant: "destructive",
            title: "Audio Error",
            description: "Could not play audio for the document.",
        });
      };
      utterance.onboundary = (event) => {
        const charIndex = event.charIndex;
        const itemIndex = itemStartIndices.findIndex((start, i) => {
          const nextStart = itemStartIndices[i + 1] ?? Infinity;
          return charIndex >= start && charIndex < nextStart;
        });
        setHighlightedIndex(itemIndex);
      };
      window.speechSynthesis.speak(utterance);
    }
  };

  const changePage = (offset: number) => {
    if (!pdfDoc) return;
    const newPage = currentPage + offset;
    if (newPage > 0 && newPage <= totalPages) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setCurrentPage(newPage);
    }
  };

  const renderContent = () => {
    switch(pdfState) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center text-center space-y-4">
              <FileText className="w-16 h-16 text-primary"/>
              <p className="text-lg font-medium">Loading "{fileName}"...</p>
              <Progress value={loadingProgress} className="w-full max-w-md" />
          </div>
        )
      case 'loaded':
        return (
          <div className="flex-1 flex flex-col items-center w-full overflow-hidden">
            <div className="flex-1 overflow-auto w-full p-4 md:p-8">
              <PdfViewer 
                pdfDoc={pdfDoc}
                pageNumber={currentPage}
                textContent={textContent}
                viewport={viewport}
                highlightedIndex={highlightedIndex}
              />
            </div>
          </div>
        );
      case 'error':
        return (
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <p className="text-destructive">Failed to load PDF.</p>
            <Button onClick={() => fileInputRef.current?.click()}>Try another file</Button>
          </div>
        );
      case 'idle':
      default:
        return (
          <div className="flex flex-col items-center justify-center text-center space-y-4 p-8 border-2 border-dashed border-primary/50 rounded-2xl cursor-pointer hover:bg-primary/5 transition-colors duration-300"
            onClick={() => fileInputRef.current?.click()}>
            <UploadCloud className="w-16 h-16 text-primary" />
            <h2 className="text-2xl font-headline">Upload your PDF</h2>
            <p className="text-muted-foreground">Click or drag & drop a file to start reading</p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="flex items-center justify-between p-4 border-b bg-card">
        <h1 className="text-2xl font-headline text-primary">Readify</h1>
        {pdfState === 'loaded' && (
            <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                <FileText className="mr-2 h-4 w-4"/>
                Change PDF
            </Button>
        )}
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" className="hidden" />
        {renderContent()}
      </main>
      {pdfState === 'loaded' && (
        <AudioPlayer
          isSpeaking={isSpeaking}
          onPlayPause={handlePlayPause}
          currentPage={currentPage}
          totalPages={totalPages}
          onPrevPage={() => changePage(-1)}
          onNextPage={() => changePage(1)}
          availableVoices={availableVoices}
          selectedVoice={selectedVoice}
          onVoiceChange={setSelectedVoice}
        />
      )}
    </div>
  );
}
