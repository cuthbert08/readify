'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, TextContent, PageViewport } from 'pdfjs-dist/types/src/display/api';
import { UploadCloud, FileText, Loader2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import PdfViewer from '@/components/pdf-viewer';
import AudioPlayer from '@/components/audio-player';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getAvailableVoices, AvailableVoicesOutput } from '@/ai/flows/voice-selection';
import { generateSpeech } from '@/ai/flows/tts-flow';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;
}

type PdfState = 'idle' | 'loading' | 'loaded' | 'error';

export default function ReadPage() {
  const [pdfState, setPdfState] = useState<PdfState>('idle');
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const [textContent, setTextContent] = useState<TextContent | null>(null);
  const [pageText, setPageText] = useState('');
  const [itemStartIndices, setItemStartIndices] = useState<number[]>([]);
  const [viewport, setViewport] = useState<PageViewport | null>(null);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const [availableVoices, setAvailableVoices] = useState<AvailableVoicesOutput>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('Default');

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchVoices() {
      try {
        const voices = await getAvailableVoices();
        setAvailableVoices(voices);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not fetch available voices.",
        });
      }
    }
    fetchVoices();
  }, [toast]);
  
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

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
        charAccumulator += str.length + 1;
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
  
  const loadPdfFromUrl = useCallback(async (url: string) => {
    setPdfState('loading');
    setLoadingProgress(0);
    try {
      const loadingTask = pdfjsLib.getDocument(url);
      loadingTask.onProgress = ({ loaded, total }) => {
        if(total) setLoadingProgress((loaded / total) * 100);
      };
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      setPdfState('loaded');
    } catch (error) {
      console.error('Failed to load PDF from URL:', error);
      setPdfState('error');
      toast({
        variant: "destructive",
        title: "PDF Load Error",
        description: "Could not read the PDF from the provided URL.",
      });
    }
  }, [toast]);

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

    try {
       const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/pdf',
          'x-vercel-filename': file.name
        },
        body: file,
      });

      if (!response.ok) {
        throw new Error('Failed to get pre-signed URL.');
      }

      const { downloadUrl } = await response.json();

      setPdfUrl(downloadUrl);
      await loadPdfFromUrl(downloadUrl);

    } catch (error) {
      console.error('Failed to upload PDF:', error);
      setPdfState('error');
      toast({
        variant: "destructive",
        title: "Upload Error",
        description: "Could not upload the selected PDF file.",
      });
    }
  };

  const handlePlayPause = async () => {
    if (isSpeaking) {
      audioRef.current?.pause();
      setIsSpeaking(false);
      return;
    }

    if (isGeneratingSpeech) return;

    if (audioRef.current && audioRef.current.src && !audioRef.current.ended) {
      audioRef.current.play();
      setIsSpeaking(true);
      return;
    }

    if (!pageText) return;

    try {
      setIsGeneratingSpeech(true);
      const { audioDataUri } = await generateSpeech({ text: pageText, voice: selectedVoice });
      setIsGeneratingSpeech(false);

      if (audioDataUri && audioRef.current) {
        audioRef.current.src = audioDataUri;
        audioRef.current.play();
        setIsSpeaking(true);
      } else {
        throw new Error('Audio generation failed.');
      }
    } catch (error) {
      console.error('Speech generation error', error);
      setIsGeneratingSpeech(false);
      setIsSpeaking(false);
      toast({
        variant: "destructive",
        title: "Audio Error",
        description: "Could not generate audio for the document.",
      });
    }
  };

  const changePage = (offset: number) => {
    if (!pdfDoc) return;
    const newPage = currentPage + offset;
    if (newPage > 0 && newPage <= totalPages) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      setIsSpeaking(false);
      setCurrentPage(newPage);
    }
  };

  const renderContent = () => {
    switch (pdfState) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <FileText className="w-16 h-16 text-primary" />
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
        <div className="flex items-center gap-4">
          {pdfState === 'loaded' && (
            <Button onClick={() => fileInputRef.current?.click()} variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Change PDF
            </Button>
          )}
          <Button onClick={handleLogout} variant="ghost" size="icon">
              <LogOut className="h-5 w-5"/>
              <span className="sr-only">Log out</span>
          </Button>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" className="hidden" />
        {renderContent()}
      </main>
      <audio ref={audioRef} onEnded={() => setIsSpeaking(false)} hidden />
      {pdfState === 'loaded' && (
        <AudioPlayer
          isSpeaking={isSpeaking}
          isGeneratingSpeech={isGeneratingSpeech}
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
