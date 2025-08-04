'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, TextContent, PageViewport, RenderTask } from 'pdfjs-dist/types/src/display/api';
import { UploadCloud, FileText, Loader2, LogOut, Save, Library, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import PdfViewer from '@/components/pdf-viewer';
import AudioPlayer from '@/components/audio-player';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getAvailableVoices, AvailableVoicesOutput } from '@/ai/flows/voice-selection';
import { generateSpeech, previewSpeech } from '@/ai/flows/tts-flow';
import { Sidebar, SidebarProvider, SidebarTrigger, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from '@/components/ui/sidebar';
import { getDocuments, saveDocument, Document } from '@/lib/db';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getSession } from '@/lib/session';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;
}

type PdfState = 'idle' | 'loading' | 'loaded' | 'error';
type ActiveDocument = {
  id: string | null;
  file: File | null;
  doc: PDFDocumentProxy | null;
  url: string | null;
  audioUrl?: string | null;
};

export default function ReadPage() {
  const [pdfState, setPdfState] = useState<PdfState>('idle');
  const [activeDoc, setActiveDoc] = useState<ActiveDocument | null>(null);
  
  const [fileName, setFileName] = useState<string>('');
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const [textContent, setTextContent] = useState<TextContent | null>(null);
  const [pageText, setPageText] = useState('');
  const [viewport, setViewport] = useState<PageViewport | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);

  const [availableVoices, setAvailableVoices] = useState<AvailableVoicesOutput>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('Algenib');
  
  const [userDocuments, setUserDocuments] = useState<Document[]>([]);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const router = useRouter();

  const fetchUserDocuments = useCallback(async () => {
    try {
      const docs = await getDocuments();
      setUserDocuments(docs);
    } catch (error) {
      console.error('Failed to fetch documents', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not load your documents.",
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchUserDocuments();
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
  }, [toast, fetchUserDocuments]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const loadPage = useCallback(async (pageNumber: number, doc: PDFDocumentProxy) => {
    try {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      setViewport(viewport);

      const content = await page.getTextContent();
      setTextContent(content);
      const currentText = content.items.map(item => (item as any).str).join(' ');
      setPageText(currentText);
      setGeneratedAudioUrl(null); // Reset audio when page changes

    } catch (error) {
      console.error('Failed to load page:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to load page ${pageNumber}.`,
      });
    }
  }, [toast]);

  const loadPdf = useCallback(async (source: File | string, docId: string | null = null, initialPage: number = 1) => {
    setPdfState('loading');
    setLoadingProgress(0);
    setActiveDoc(null);
    setCurrentPage(1);

    try {
      const loadingTask = pdfjsLib.getDocument(typeof source === 'string' ? source : URL.createObjectURL(source));
      loadingTask.onProgress = ({ loaded, total }) => {
        if (total) setLoadingProgress((loaded / total) * 100);
      };
      const pdf = await loadingTask.promise;
      
      setActiveDoc({
        id: docId,
        file: typeof source === 'string' ? null : source,
        doc: pdf,
        url: typeof source === 'string' ? source : null,
      });

      setTotalPages(pdf.numPages);
      setCurrentPage(initialPage);
      setPdfState('loaded');
      await loadPage(initialPage, pdf);
      
      if(typeof source !== 'string') {
        setFileName(source.name);
      }

    } catch (error) {
      console.error('Failed to load PDF:', error);
      setPdfState('error');
      toast({
        variant: "destructive",
        title: "PDF Load Error",
        description: "Could not read the selected PDF file.",
      });
    }
  }, [toast, loadPage]);


  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      toast({ variant: "destructive", title: "Invalid File", description: "Please select a PDF file." });
      return;
    }
    await loadPdf(file);
  };
  
  const handleSelectDocument = async (doc: Document) => {
    setFileName(doc.fileName);
    await loadPdf(doc.pdfUrl, doc.id, doc.currentPage);
  }

  const handleSave = async () => {
    if (!activeDoc?.file) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf', 'x-vercel-filename': activeDoc.file.name },
        body: activeDoc.file,
      });

      if (!response.ok) throw new Error('Upload failed');
      
      const { url: pdfUrl } = await response.json();
      
      const newDoc = await saveDocument({
        fileName: activeDoc.file.name,
        pdfUrl: pdfUrl,
        currentPage: currentPage,
        totalPages: totalPages,
      });

      setActiveDoc(prev => prev ? { ...prev, id: newDoc.id, file: null, url: newDoc.pdfUrl } : null);
      await fetchUserDocuments();

      toast({ title: "Success", description: "Document saved successfully." });
    } catch (error) {
      console.error('Save error:', error);
      toast({ variant: "destructive", title: "Save Error", description: "Could not save your document." });
    } finally {
      setIsSaving(false);
    }
  }

  const handlePlayPause = async () => {
    if (isSpeaking) {
      audioRef.current?.pause();
      setIsSpeaking(false);
      return;
    }

    if (isGeneratingSpeech) return;

    if (audioRef.current?.src && !audioRef.current.ended) {
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
        setGeneratedAudioUrl(audioDataUri);
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
      toast({ variant: "destructive", title: "Audio Error", description: "Could not generate audio for the document." });
    }
  };

  const handlePreviewVoice = async (voice: string) => {
    try {
      const { audioDataUri } = await previewSpeech({ 
        text: "Hello! This is a preview of my voice.", 
        voice: voice 
      });
      if (audioDataUri && previewAudioRef.current) {
        previewAudioRef.current.src = audioDataUri;
        previewAudioRef.current.play();
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Audio Error", description: "Could not preview voice." });
    }
  }

  const changePage = (offset: number) => {
    if (!activeDoc?.doc) return;
    const newPage = currentPage + offset;
    if (newPage > 0 && newPage <= totalPages) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      setIsSpeaking(false);
      setGeneratedAudioUrl(null);
      setCurrentPage(newPage);
      loadPage(newPage, activeDoc.doc);
    }
  };
  
  useEffect(() => {
    if (activeDoc?.id && !isSaving) {
      const timer = setTimeout(() => {
        saveDocument({
          id: activeDoc.id,
          fileName: fileName,
          pdfUrl: activeDoc.url || '',
          currentPage: currentPage,
          totalPages: totalPages
        }).catch(err => console.error("Failed to auto-save progress", err));
      }, 2000); // Debounce auto-save
      return () => clearTimeout(timer);
    }
  }, [currentPage, activeDoc, fileName, totalPages, isSaving]);


  const renderContent = () => {
    switch (pdfState) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
            <p className="text-lg font-medium">Loading PDF...</p>
            <Progress value={loadingProgress} className="w-full max-w-md" />
          </div>
        );
      case 'loaded':
        return (
          <div className="flex-1 flex flex-col items-center w-full overflow-hidden">
            <div className="flex-1 overflow-auto w-full p-4 md:p-8">
              <PdfViewer pdfDoc={activeDoc?.doc || null} pageNumber={currentPage} textContent={textContent} viewport={viewport} />
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
    <SidebarProvider>
      <div className="flex flex-col h-screen bg-background">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" className="hidden" />
        <Sidebar>
          <SidebarHeader>
             <h1 className="text-2xl font-headline text-primary">Readify</h1>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => fileInputRef.current?.click()}>
                  <UploadCloud />
                  Upload New PDF
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                 <div className="p-2 text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                  <Library />
                  My Documents
                 </div>
              </SidebarMenuItem>
                {userDocuments.map((doc) => (
                   <SidebarMenuItem key={doc.id}>
                      <SidebarMenuButton variant="ghost" onClick={() => handleSelectDocument(doc)} isActive={activeDoc?.id === doc.id}>
                        <FileText />
                        <div className="flex flex-col items-start">
                           <span className="truncate max-w-[150px]">{doc.fileName}</span>
                           <span className="text-xs text-muted-foreground">Page {doc.currentPage} of {doc.totalPages}</span>
                        </div>
                      </SidebarMenuButton>
                   </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center gap-3 p-2">
              <Avatar>
                <AvatarImage data-ai-hint="user avatar" src="https://placehold.co/40x40.png" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">User</p>
              </div>
              <Button onClick={handleLogout} variant="ghost" size="icon">
                  <LogOut className="h-5 w-5"/>
                  <span className="sr-only">Log out</span>
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col">
            <header className="flex items-center justify-between p-4 border-b bg-card">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="md:hidden" />
                <h2 className="text-lg font-semibold truncate max-w-xs md:max-w-md">{fileName || 'Readify'}</h2>
              </div>
              <div className="flex items-center gap-4">
                {pdfState === 'loaded' && activeDoc?.file && (
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                    Save
                  </Button>
                )}
                 {pdfState === 'loaded' && generatedAudioUrl && (
                  <a href={generatedAudioUrl} download={`${fileName || 'audio'}-page-${currentPage}.wav`}>
                    <Button variant="outline">
                      <Download className="mr-2"/>
                      Download Audio
                    </Button>
                  </a>
                )}
              </div>
            </header>
            <main className="flex-1 flex items-center justify-center p-4">
              {renderContent()}
            </main>
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
                onPreviewVoice={handlePreviewVoice}
              />
            )}
        </div>
        <audio ref={audioRef} onEnded={() => setIsSpeaking(false)} hidden />
        <audio ref={previewAudioRef} hidden />
      </div>
    </SidebarProvider>
  );
}
