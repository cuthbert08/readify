
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { UploadCloud, FileText, Loader2, LogOut, Save, Library, Download, Bot, Lightbulb, HelpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import PdfViewer from '@/components/pdf-viewer';
import AudioPlayer from '@/components/audio-player';
import PdfToolbar from '@/components/pdf-toolbar';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getAvailableVoices, AvailableVoicesOutput } from '@/ai/flows/voice-selection';
import { generateSpeech, previewSpeech } from '@/ai/flows/tts-flow';
import { summarizePdf, SummarizePdfOutput } from '@/ai/flows/summarize-pdf';
import { chatWithPdf, ChatWithPdfOutput } from '@/ai/flows/chat-with-pdf';
import { Sidebar, SidebarProvider, SidebarTrigger, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, useSidebar, SidebarGroup } from '@/components/ui/sidebar';
import { getDocuments, saveDocument, Document } from '@/lib/db';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import AiDialog, { AiDialogType } from '@/components/ai-dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

type PdfState = 'idle' | 'loading' | 'loaded' | 'error';
type ActiveDocument = {
  id: string | null;
  file: File | null;
  doc: PDFDocumentProxy | null;
  url: string | null;
  audioUrl?: string | null;
};

const ReaderView = () => {
    const [pdfState, setPdfState] = useState<PdfState>('idle');
    const [activeDoc, setActiveDoc] = useState<ActiveDocument | null>(null);
    
    const [fileName, setFileName] = useState<string>('');
    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [isFullScreen, setIsFullScreen] = useState(false);
  
    const [documentText, setDocumentText] = useState('');
  
    const [isSaving, setIsSaving] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
    const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  
    const [availableVoices, setAvailableVoices] = useState<AvailableVoicesOutput>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>('Algenib');
    
    const [userDocuments, setUserDocuments] = useState<Document[]>([]);
    
    const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
    const [aiDialogType, setAiDialogType] = useState<AiDialogType>('summary');
    const [aiIsLoading, setAiIsLoading] = useState(false);
    const [aiSummaryOutput, setAiSummaryOutput] = useState<SummarizePdfOutput | null>(null);
    const [aiChatOutput, setAiChatOutput] = useState<ChatWithPdfOutput | null>(null);
    
    const [showControls, setShowControls] = useState(true);

    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);
    const viewerContainerRef = useRef<HTMLDivElement>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter();
    const { isMobile } = useSidebar();


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
          if (activeDoc?.audioUrl) {
              setGeneratedAudioUrl(activeDoc.audioUrl);
          }
        } catch (error) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Could not fetch available voices.",
          });
        }
      }
      fetchVoices();
    }, [toast, fetchUserDocuments, activeDoc]);

    const handleHideControls = () => {
        if(controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        setShowControls(true);
        controlsTimeoutRef.current = setTimeout(() => {
            setShowControls(false);
        }, 3000);
    }

    useEffect(() => {
        const viewer = viewerContainerRef.current;
        if(pdfState === 'loaded') {
            handleHideControls();
            viewer?.addEventListener('mousemove', handleHideControls);
        }
        return () => {
            viewer?.removeEventListener('mousemove', handleHideControls);
            if(controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
        }
    }, [pdfState]);
  
    const handleLogout = async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
    };
  
    const loadPdf = useCallback(async (source: File | string, docId: string | null = null, audioUrl: string | null = null) => {
      setPdfState('loading');
      setLoadingProgress(0);
      setActiveDoc(null);
      setDocumentText('');
      setAiSummaryOutput(null);
      setAiChatOutput(null);
      setGeneratedAudioUrl(null);
      setTotalPages(0);
      setCurrentPage(1);
  
      try {
        const loadingTask = pdfjsLib.getDocument(typeof source === 'string' ? { url: source } : { data: await source.arrayBuffer() });
        loadingTask.onProgress = ({ loaded, total }) => {
          if (total) setLoadingProgress((loaded / total) * 100);
        };
        const pdf = await loadingTask.promise;
        setTotalPages(pdf.numPages);
        
        const allText: string[] = [];
        for(let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map(item => (item as any).str).join(' ');
          allText.push(pageText);
        }
        setDocumentText(allText.join('\n\n'));
  
        setActiveDoc({
          id: docId,
          file: typeof source === 'string' ? null : source,
          doc: pdf,
          url: typeof source === 'string' ? source : null,
          audioUrl: audioUrl,
        });
  
        if(audioUrl) {
          setGeneratedAudioUrl(audioUrl);
        }
        
        setPdfState('loaded');
        
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
    }, [toast]);
  
  
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
      setZoomLevel(doc.zoomLevel || 1);
      await loadPdf(doc.pdfUrl, doc.id, doc.audioUrl);
    }
  
    const handleSave = async () => {
      if (!activeDoc || (!activeDoc.file && !activeDoc.id)) return;
      setIsSaving(true);
      try {
        let pdfUrl = activeDoc.url;
  
        if(activeDoc.file) {
          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/pdf', 'x-vercel-filename': activeDoc.file.name },
            body: activeDoc.file,
          });
  
          if (!uploadResponse.ok) throw new Error('PDF Upload failed');
          const blob = await uploadResponse.json();
          pdfUrl = blob.url;
        }
        
        if (!pdfUrl) throw new Error("Could not get PDF URL");
  
        const newDocData: any = {
          fileName: fileName,
          pdfUrl: pdfUrl,
          currentPage: currentPage,
          totalPages: totalPages,
          zoomLevel: zoomLevel
        };
        if (activeDoc.id) newDocData.id = activeDoc.id;
        if (generatedAudioUrl) newDocData.audioUrl = generatedAudioUrl;
  
        const newDoc = await saveDocument(newDocData);
  
        setActiveDoc(prev => prev ? { ...prev, id: newDoc.id, file: null, url: newDoc.pdfUrl, audioUrl: newDoc.audioUrl } : null);
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
  
      if (generatedAudioUrl && audioRef.current) {
          if(audioRef.current.src !== generatedAudioUrl) {
              audioRef.current.src = generatedAudioUrl;
          }
          audioRef.current.play();
          setIsSpeaking(true);
          return;
      }
  
      if (!documentText) return;
  
      try {
        setIsGeneratingSpeech(true);
        const { audioDataUri } = await generateSpeech({ text: documentText, voice: selectedVoice });
        setIsGeneratingSpeech(false);
  
        if (audioDataUri && audioRef.current) {
          setGeneratedAudioUrl(audioDataUri);
          setActiveDoc(prev => prev ? { ...prev, audioUrl: audioDataUri } : null);
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
  
    const handleAiAction = async (type: AiDialogType) => {
      if (!documentText) return;
      setAiDialogType(type);
      setIsAiDialogOpen(true);
      setAiIsLoading(true);
  
      if (type === 'summary' || type === 'key-points') {
        try {
          const result = await summarizePdf({ pdfText: documentText });
          setAiSummaryOutput(result);
        } catch (error) {
          console.error('AI Summary Error:', error);
          toast({ variant: "destructive", title: "AI Error", description: "Could not generate summary or key points." });
        }
      }
      setAiIsLoading(false);
    };
  
    const handleAiChat = async (question: string) => {
      if (!documentText || !question) return;
      setAiIsLoading(true);
      setAiChatOutput(null);
      try {
        const result = await chatWithPdf({ pdfText: documentText, question });
        setAiChatOutput(result);
      } catch (error) {
        console.error('AI Chat Error:', error);
        toast({ variant: "destructive", title: "AI Error", description: "Could not get an answer." });
      }
      setAiIsLoading(false);
    }
  
    const toggleFullScreen = () => {
      const element = viewerContainerRef.current;
      if (!element) return;
  
      if (!document.fullscreenElement) {
        element.requestFullscreen().catch(err => {
          toast({
            variant: "destructive",
            title: "Fullscreen Error",
            description: `Error attempting to enable full-screen mode: ${err.message} (${err.name})`,
          });
        });
      } else {
        document.exitFullscreen();
      }
    };
  
    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullScreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);
  
    useEffect(() => {
      if (activeDoc?.id && !isSaving) {
        const timer = setTimeout(() => {
          saveDocument({
            id: activeDoc.id,
            fileName: fileName,
            pdfUrl: activeDoc.url || '',
            currentPage: currentPage,
            totalPages: totalPages,
            zoomLevel: zoomLevel,
            audioUrl: activeDoc.audioUrl,
          }).catch(err => console.error("Failed to auto-save progress", err));
        }, 2000); 
        return () => clearTimeout(timer);
      }
    }, [currentPage, activeDoc, fileName, totalPages, isSaving, zoomLevel]);
  
    const renderContent = () => {
      switch (pdfState) {
        case 'loading':
          return (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <Loader2 className="w-16 h-16 text-primary animate-spin" />
              <p className="text-lg font-medium">Loading PDF...</p>
              <Progress value={loadingProgress} className="w-full max-w-md" />
            </div>
          );
        case 'loaded':
          return (
             <PdfViewer pdfDoc={activeDoc?.doc || null} scale={zoomLevel} />
          );
        case 'error':
          return (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <p className="text-destructive">Failed to load PDF.</p>
              <Button onClick={() => fileInputRef.current?.click()}>Try another file</Button>
            </div>
          );
        case 'idle':
        default:
          return (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 p-8 border-2 border-dashed border-primary/50 rounded-2xl cursor-pointer hover:bg-primary/5 transition-colors duration-300"
              onClick={() => fileInputRef.current?.click()}>
              <UploadCloud className="w-16 h-16 text-primary" />
              <h2 className="text-2xl font-headline">Upload your PDF</h2>
              <p className="text-muted-foreground">Click or drag & drop a file to start reading</p>
            </div>
          );
      }
    };
  
    return (
        <div className="flex h-screen w-full bg-background">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" className="hidden" />
          <Sidebar>
            <SidebarHeader>
               <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-headline text-primary">Readify</h1>
                  <SidebarTrigger />
               </div>
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => fileInputRef.current?.click()}>
                    <UploadCloud />
                    Upload New PDF
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <Separator className="my-2" />
                 <SidebarGroup>
                  <div className="p-2 text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                    <Bot />
                    AI Tools
                  </div>
                   <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => handleAiAction('summary')} disabled={pdfState !== 'loaded'}>
                        <Lightbulb />
                        Summarize & Key Points
                      </SidebarMenuButton>
                   </SidebarMenuItem>
                   <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => handleAiAction('chat')} disabled={pdfState !== 'loaded'}>
                        <HelpCircle />
                        Ask a Question
                      </SidebarMenuButton>
                   </SidebarMenuItem>
                 </SidebarGroup>
                <Separator className="my-2" />
                <SidebarGroup>
                   <div className="p-2 text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                    <Library />
                    My Documents
                   </div>
                </SidebarGroup>
                  {userDocuments.map((doc) => (
                     <SidebarMenuItem key={doc.id}>
                        <SidebarMenuButton variant="ghost" onClick={() => handleSelectDocument(doc)} isActive={activeDoc?.id === doc.id}>
                          <FileText />
                          <div className="flex flex-col items-start">
                             <span className="truncate max-w-[150px]">{doc.fileName}</span>
                             <span className="text-xs text-muted-foreground">{doc.totalPages} pages</span>
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
          
          <div className="flex flex-1 flex-col" ref={viewerContainerRef}>
              <div className="relative flex-1 flex">
                 <div className="absolute top-4 left-4 z-50">
                    <SidebarTrigger />
                 </div>
                 {pdfState === 'loaded' && (
                   <div className={cn("absolute inset-x-0 top-0 z-50 transition-opacity duration-300", showControls ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
                     <PdfToolbar
                       fileName={fileName}
                       zoomLevel={zoomLevel}
                       onZoomIn={() => setZoomLevel(z => Math.min(z + 0.2, 3))}
                       onZoomOut={() => setZoomLevel(z => Math.max(z - 0.2, 0.4))}
                       onFullScreen={toggleFullScreen}
                       isFullScreen={isFullScreen}
                       showSave={!!activeDoc?.file || (!!activeDoc?.id && !activeDoc.audioUrl)}
                       onSave={handleSave}
                       isSaving={isSaving}
                       showDownload={!!generatedAudioUrl}
                       downloadUrl={generatedAudioUrl || ''}
                       downloadFileName={`${fileName || 'audio'}.wav`}
                     />
                   </div>
                 )}
                 <main className="flex-1 flex items-center justify-center overflow-auto bg-muted/30">
                   {renderContent()}
                 </main>
                 {pdfState === 'loaded' && (
                   <div className={cn("absolute inset-x-0 bottom-0 z-50 transition-opacity duration-300", showControls ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
                       <AudioPlayer
                           isSpeaking={isSpeaking}
                           isGeneratingSpeech={isGeneratingSpeech}
                           onPlayPause={handlePlayPause}
                           availableVoices={availableVoices}
                           selectedVoice={selectedVoice}
                           onVoiceChange={setSelectedVoice}
                           onPreviewVoice={handlePreviewVoice}
                       />
                   </div>
                 )}
              </div>
          </div>
          <audio ref={audioRef} onEnded={() => setIsSpeaking(false)} hidden />
          <audio ref={previewAudioRef} hidden />
          <AiDialog
            open={isAiDialogOpen}
            onOpenChange={setIsAiDialogOpen}
            type={aiDialogType}
            isLoading={aiIsLoading}
            summaryOutput={aiSummaryOutput}
            chatOutput={aiChatOutput}
            onChatSubmit={handleAiChat}
          />
        </div>
    );
}


export default function ReadPage() {
    return (
        <SidebarProvider>
            <ReaderView />
        </SidebarProvider>
    )
}
