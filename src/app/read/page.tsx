
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, TextItem as PdfTextItem } from 'pdfjs-dist/types/src/display/api';
import { UploadCloud, FileText, Loader2, LogOut, Save, Library, Download, Bot, Lightbulb, HelpCircle, Cloud, CloudOff, Settings, Menu, Home, BarChart, BookOpenCheck, BrainCircuit, Mic, FastForward, Rewind, Wind, Maximize, Minimize, ZoomIn, ZoomOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import PdfViewer from '@/components/pdf-viewer';
import AudioPlayer from '@/components/audio-player';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getAvailableVoices, AvailableVoicesOutput } from '@/ai/flows/voice-selection';
import { generateSpeech } from '@/ai/flows/generate-speech';
import { previewSpeech } from '@/ai/flows/preview-speech';
import { summarizePdf, SummarizePdfOutput } from '@/ai/flows/summarize-pdf';
import { chatWithPdf, ChatWithPdfOutput } from '@/ai/flows/chat-with-pdf';
import { generateGlossary, GenerateGlossaryOutput, GlossaryItem } from '@/ai/flows/glossary-flow';
import { explainText, ExplainTextOutput } from '@/ai/flows/explain-text-flow';
import { generateQuiz, type GenerateQuizOutput } from '@/ai/flows/quiz-flow';
import { cleanPdfText } from '@/ai/flows/clean-text-flow';
import { Sidebar, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarContent } from '@/components/ui/sidebar';
import { getDocuments, saveDocument, Document, getUserSession } from '@/lib/db';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import AiDialog, { AiDialogType } from '@/components/ai-dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Volume2 } from 'lucide-react';
import TextSelectionMenu from '@/components/text-selection-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type PdfState = 'idle' | 'loading' | 'loaded' | 'error';
type ProcessingStage = 'idle' | 'cleaning' | 'generating' | 'error';
type TextItem = {
    text: string;
    transform: number[];
    width: number;
    height: number;
    pageNumber: number;
};
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
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
  
    const [documentText, setDocumentText] = useState('');
  
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
    const [audioProgress, setAudioProgress] = useState(0);
    const [audioDuration, setAudioDuration] = useState(0);
    const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  
    const [availableVoices, setAvailableVoices] = useState<AvailableVoicesOutput>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>('alloy');
    const [speakingRate, setSpeakingRate] = useState(1);
    const [playbackRate, setPlaybackRate] = useState(1);
    
    const [userDocuments, setUserDocuments] = useState<Document[]>([]);
    
    const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
    const [aiDialogType, setAiDialogType] = useState<AiDialogType>('summary');
    const [aiIsLoading, setAiIsLoading] = useState(false);
    const [aiSummaryOutput, setAiSummaryOutput] = useState<SummarizePdfOutput | null>(null);
    const [aiChatOutput, setAiChatOutput] = useState<ChatWithPdfOutput | null>(null);
    const [aiGlossaryOutput, setAiGlossaryOutput] = useState<GenerateGlossaryOutput | null>(null);
    const [aiExplanationOutput, setAiExplanationOutput] = useState<ExplainTextOutput | null>(null);
    const [aiQuizOutput, setAiQuizOutput] = useState<GenerateQuizOutput | null>(null);
    
    const [showControls, setShowControls] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    
    const [selection, setSelection] = useState<{ text: string; page: number, rect: DOMRect } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    
    const [synthesisText, setSynthesisText] = useState('');
    const [synthesisVoice, setSynthesisVoice] = useState('alloy');
    const [synthesisRate, setSynthesisRate] = useState(1.0);
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const [synthesisAudioUrl, setSynthesisAudioUrl] = useState<string | null>(null);

    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);
    const viewerContainerRef = useRef<HTMLDivElement>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter();

    const isGeneratingSpeech = processingStage === 'cleaning' || processingStage === 'generating';

    useEffect(() => {
      async function checkSession() {
        const session = await getUserSession();
        if (session) {
          setIsAdmin(session.isAdmin || false);
          setUserEmail(session.email || 'user@example.com');
        }
      }
      checkSession();
    }, []);

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
  
    const loadPdf = useCallback(async (source: File | string, docId: string | null = null, savedData: Partial<Document> | null = null) => {
      setPdfState('loading');
      setLoadingProgress(0);
      setActiveDoc(null);
      setDocumentText('');
      setAiSummaryOutput(null);
      setAiChatOutput(null);
      setAiGlossaryOutput(null);
      setAiExplanationOutput(null);
      setAiQuizOutput(null);
      if (audioRef.current) {
          audioRef.current.src = "";
          setAudioDuration(0);
          setAudioCurrentTime(0);
      }
  
      try {
        const loadingTask = pdfjsLib.getDocument(typeof source === 'string' ? { url: source } : { data: await source.arrayBuffer() });
        loadingTask.onProgress = ({ loaded, total }) => {
          if (total) setLoadingProgress((loaded / total) * 100);
        };
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map(item => (item as PdfTextItem).str).join(' ');
        }
        setDocumentText(fullText);
  
        const docToLoad: ActiveDocument = {
          id: docId,
          file: typeof source === 'string' ? null : source,
          doc: pdf,
          url: typeof source === 'string' ? source : null,
          audioUrl: savedData?.audioUrl,
        };

        setActiveDoc(docToLoad);
  
        if (savedData?.audioUrl && audioRef.current) {
          audioRef.current.src = savedData.audioUrl;
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

    const handleFileDrop = async (file: File) => {
        if (!file || file.type !== 'application/pdf') {
            toast({ variant: "destructive", title: "Invalid File", description: "Please select a PDF file." });
            return;
        }
        await loadPdf(file);
    };
    
    const handleSelectDocument = async (doc: Document) => {
      setFileName(doc.fileName);
      setZoomLevel(doc.zoomLevel || 1);
      await loadPdf(doc.pdfUrl, doc.id, doc);
    }
  
    const handleSaveAfterAudio = async (audioUrl: string) => {
        if (!activeDoc || !activeDoc.doc) return;
    
        if (!activeDoc.file && !activeDoc.id) {
          toast({ variant: "destructive", title: "Save Error", description: "No document data to save." });
          return;
        }
    
        setIsSaving(true);
        try {
          let pdfUrl = activeDoc.url;
    
          if (activeDoc.file) {
            const uploadResponse = await fetch('/api/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/pdf', 'x-vercel-filename': activeDoc.file.name },
              body: activeDoc.file,
            });
    
            if (!uploadResponse.ok) {
              const errorData = await uploadResponse.json();
              throw new Error(errorData.message || 'PDF Upload failed');
            }
            const blob = await uploadResponse.json();
            pdfUrl = blob.url;
          }
        
          if (!pdfUrl) {
            throw new Error("Could not determine PDF URL for saving.");
          }
    
          const docToSave = {
            id: activeDoc.id || undefined, 
            fileName: fileName,
            pdfUrl: pdfUrl,
            zoomLevel: zoomLevel,
            audioUrl: audioUrl,
          };
    
          const savedDoc = await saveDocument(docToSave);
    
          setActiveDoc(prev => prev ? { ...prev, id: savedDoc.id, file: null, url: savedDoc.pdfUrl, audioUrl: savedDoc.audioUrl } : null);
        
          await fetchUserDocuments(); 
    
          toast({ title: "Success", description: "Document and audio saved successfully." });
        } catch (error) {
          console.error('Save error:', error);
          toast({ 
            variant: "destructive", 
            title: "Save Error", 
            description: error instanceof Error ? error.message : "Could not save your document." 
          });
        } finally {
          setIsSaving(false);
        }
      };
  
    const handlePlayPause = async () => {
      if (isSpeaking) {
        audioRef.current?.pause();
        setIsSpeaking(false);
        return;
      }
  
      if (isGeneratingSpeech) return;
  
      if (activeDoc?.audioUrl && audioRef.current) {
          if(audioRef.current.src !== activeDoc.audioUrl) {
              audioRef.current.src = activeDoc.audioUrl;
          }
          audioRef.current.play();
          setIsSpeaking(true);
          return;
      }
  
      if (!documentText || !activeDoc) return;
  
      try {
        setProcessingStage('cleaning');
        const { cleanedText } = await cleanPdfText({ rawText: documentText });

        if (!cleanedText || !cleanedText.trim()) {
            toast({ 
                variant: "destructive", 
                title: "Content Error", 
                description: "No readable content found in the document to generate audio." 
            });
            setProcessingStage('idle');
            return;
        }
        
        setProcessingStage('generating');
        const result = await generateSpeech({
          text: cleanedText,
          voice: selectedVoice as any,
          speakingRate: speakingRate,
        });

        if (!result.audioDataUri) {
          throw new Error('Audio generation failed to return data.');
        }

        if (audioRef.current) {
          audioRef.current.src = result.audioDataUri;
          audioRef.current.play();
          setIsSpeaking(true);
        }

        setActiveDoc(prev => prev ? { ...prev, audioUrl: result.audioDataUri } : null);
        await handleSaveAfterAudio(result.audioDataUri);
        
        setProcessingStage('idle');

      } catch (error) {
        console.error('Speech generation error', error);
        setProcessingStage('error');
        setIsSpeaking(false);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        toast({ variant: "destructive", title: "Audio Error", description: `Could not generate audio for the document. ${errorMessage}` });
        // Reset stage after showing error
        setTimeout(() => setProcessingStage('idle'), 2000);
      }
    };

    const handleAudioTimeUpdate = () => {
        if (!audioRef.current) {
            return;
        }
        const currentTime = audioRef.current.currentTime;

        setAudioCurrentTime(currentTime);
        if (audioDuration > 0) {
            setAudioProgress((currentTime / audioDuration) * 100);
        }
    }
  
    const handlePreviewVoice = async (voice: string) => {
      try {
        const result = await previewSpeech({ voice: voice as any });
        if (result.audioDataUri && previewAudioRef.current) {
          previewAudioRef.current.src = result.audioDataUri;
          previewAudioRef.current.play();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        toast({ variant: "destructive", title: "Audio Error", description: `Could not preview voice: ${errorMessage}` });
      }
    }

    const handleSynthesize = async () => {
        if (!synthesisText.trim()) {
            toast({ variant: "destructive", title: "No Text", description: "Please enter some text to synthesize." });
            return;
        }
        setIsSynthesizing(true);
        setSynthesisAudioUrl(null);
        try {
            const result = await generateSpeech({
                text: synthesisText,
                voice: synthesisVoice as any,
                speakingRate: synthesisRate
            });
            if (result.audioDataUri) {
                setSynthesisAudioUrl(result.audioDataUri);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
            toast({ variant: "destructive", title: "Synthesis Error", description: `Could not generate audio: ${errorMessage}` });
        } finally {
            setIsSynthesizing(false);
        }
    };

    useEffect(() => {
        if(audioRef.current) {
            audioRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate]);

    const handleSeek = (value: number) => {
      if (audioRef.current) {
        audioRef.current.currentTime = value;
        setAudioCurrentTime(value);
      }
    };
    
    const handleForward = () => {
      if (audioRef.current && audioRef.current.duration > 0) {
        const newTime = Math.min(audioRef.current.currentTime + 10, audioRef.current.duration);
        handleSeek(newTime);
      }
    };
    
    const handleRewind = () => {
      if (audioRef.current && audioRef.current.duration > 0) {
        const newTime = Math.max(audioRef.current.currentTime - 10, 0);
        handleSeek(newTime);
      }
    };
  
    const handleAiAction = async (type: AiDialogType, data?: any) => {
      setAiDialogType(type);
      setIsAiDialogOpen(true);
      setAiIsLoading(true);
      setAiChatOutput(null);
      setAiSummaryOutput(null);
      setAiGlossaryOutput(null);
      setAiExplanationOutput(null);
      setAiQuizOutput(null);
  
      try {
        if ((type === 'summary' || type === 'key-points') && documentText) {
          const result = await summarizePdf({ pdfText: documentText });
          setAiSummaryOutput(result);
        } else if (type === 'glossary' && documentText) {
            const result = await generateGlossary({ documentText: documentText });
            setAiGlossaryOutput(result);
        } else if (type === 'explain' && data?.text) {
            const result = await explainText({ text: data.text, context: documentText });
            setAiExplanationOutput(result);
        } else if (type === 'quiz' && documentText) {
            const result = await generateQuiz({ documentText });
            setAiQuizOutput(result);
        }
      } catch (error) {
        console.error(`AI Error (${type}):`, error);
        toast({ variant: "destructive", title: "AI Error", description: `Could not perform AI action: ${type}.` });
      } finally {
        setAiIsLoading(false);
      }
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
      const element = document.documentElement; 
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
      if (activeDoc?.id && !isSaving && processingStage === 'idle') {
        const timer = setTimeout(() => {
          saveDocument({
            id: activeDoc.id,
            fileName: fileName,
            pdfUrl: activeDoc.url || '',
            zoomLevel: zoomLevel,
            audioUrl: activeDoc.audioUrl,
          }).catch(err => console.error("Failed to auto-save progress", err));
        }, 2000); 
        return () => clearTimeout(timer);
      }
    }, [activeDoc, fileName, isSaving, zoomLevel, processingStage]);

    const handleTextSelect = (text: string, page: number, rect: DOMRect) => {
        setSelection({text, page, rect});
    }
    
    const getProcessingMessage = () => {
        switch (processingStage) {
            case 'cleaning': return 'AI is cleaning the document text...';
            case 'generating': return 'Generating audio, this may take a moment...';
            case 'error': return 'An error occurred during audio generation.';
            default: return '';
        }
    }

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
             <Tabs defaultValue="upload" className="w-full max-w-3xl mx-auto mt-20">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload">Upload PDF</TabsTrigger>
                    <TabsTrigger value="synthesize">Synthesize Speech</TabsTrigger>
                </TabsList>
                <TabsContent value="upload">
                    <div 
                        className={cn(
                            "flex flex-col items-center justify-center h-full text-center space-y-4 p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-colors duration-300 mt-4",
                            isDragging ? "border-primary bg-primary/10" : "border-primary/50 hover:bg-primary/5"
                        )}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                        onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDragging(false);
                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            handleFileDrop(e.dataTransfer.files[0]);
                            }
                        }}
                        >
                        <UploadCloud className="w-16 h-16 text-primary" />
                        <h2 className="text-2xl font-headline">Read a Document</h2>
                        <p className="text-muted-foreground">Click or drag & drop a PDF file to start reading</p>
                    </div>
                </TabsContent>
                <TabsContent value="synthesize">
                    <Card className="p-6 mt-4">
                        <div className="space-y-4">
                            <h2 className="text-2xl font-headline">Text-to-Audio</h2>
                            <p className="text-muted-foreground">Paste text below to generate audio and download it as an MP3 file.</p>
                            <Textarea 
                                placeholder="Paste your text here..." 
                                className="min-h-48"
                                value={synthesisText}
                                onChange={(e) => setSynthesisText(e.target.value)}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className='space-y-2'>
                                    <Label>Voice</Label>
                                    <Select value={synthesisVoice} onValueChange={setSynthesisVoice} disabled={isSynthesizing}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a voice" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableVoices.map((voice) => (
                                            <SelectItem key={voice.name} value={voice.name}>
                                                {voice.displayName} ({voice.gender})
                                            </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor="synthesis-rate">Speaking Rate: {synthesisRate.toFixed(2)}x</Label>
                                    <Slider id="synthesis-rate" min={0.25} max={4.0} step={0.25} value={[synthesisRate]} onValueChange={(v) => setSynthesisRate(v[0])} disabled={isSynthesizing} />
                                </div>
                            </div>
                            <Button onClick={handleSynthesize} disabled={isSynthesizing || !synthesisText.trim()}>
                                {isSynthesizing ? <Loader2 className="mr-2 animate-spin"/> : <Mic className="mr-2"/>}
                                {isSynthesizing ? 'Generating Audio...' : 'Generate Audio'}
                            </Button>

                            {synthesisAudioUrl && (
                                <div className="space-y-2">
                                    <Label>Generated Audio</Label>
                                    <audio src={synthesisAudioUrl} controls className="w-full" />
                                     <a href={synthesisAudioUrl} download="synthesis.mp3">
                                        <Button variant="outline" className="w-full">
                                            <Download className="mr-2" />
                                            Download MP3
                                        </Button>
                                    </a>
                                </div>
                            )}
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
          );
      }
    }
  
    return (
      <TooltipProvider>
        <div className="flex h-screen w-full bg-background">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" className="hidden" />
          <Sidebar>
            <SidebarHeader>
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-headline text-primary flex items-center gap-2"><BarChart /> Readify</h1>
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
                  <div>
                    <div className="p-2 text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                        <Settings />
                        Audio Settings
                    </div>
                    <div className="p-2 space-y-4">
                        <div className='space-y-2'>
                            <Label>Voice</Label>
                            <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={isSpeaking || isGeneratingSpeech}>
                                <SelectTrigger>
                                    <SelectValue>
                                      {availableVoices.find(v => v.name === selectedVoice)?.displayName || selectedVoice}
                                      ({availableVoices.find(v => v.name === selectedVoice)?.gender})
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {availableVoices.map((voice) => (
                                    <div key={voice.name} className="flex items-center justify-between pr-2">
                                        <SelectItem value={voice.name} className="flex-1">
                                            {voice.displayName} ({voice.gender})
                                        </SelectItem>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-7 w-7 ml-2 shrink-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePreviewVoice(voice.name);
                                            }}
                                            aria-label={`Preview voice ${voice.name}`}
                                        >
                                            <Volume2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor="speaking-rate">Speaking Rate: {speakingRate.toFixed(2)}x</Label>
                            <Slider id="speaking-rate" min={0.25} max={4.0} step={0.25} value={[speakingRate]} onValueChange={(v) => setSpeakingRate(v[0])} disabled={isSpeaking || isGeneratingSpeech} />
                        </div>
                    </div>
                  </div>

                <Separator className="my-2" />
                  <div>
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
                      <SidebarMenuButton onClick={() => handleAiAction('glossary')} disabled={pdfState !== 'loaded'}>
                        <BookOpenCheck />
                        Create Glossary
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => handleAiAction('quiz')} disabled={pdfState !== 'loaded'}>
                            <BrainCircuit />
                            Generate Quiz
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => handleAiAction('chat')} disabled={pdfState !== 'loaded'}>
                        <HelpCircle />
                        Ask a Question
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </div>
                <Separator className="my-2" />
                <div>
                    <div className="p-2 text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                      <Library />
                      My Documents
                    </div>
                     <div className="px-2">
                        {activeDoc && !activeDoc.id && (
                          <div className={cn(
                            "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm",
                            "bg-sidebar-accent font-medium text-sidebar-accent-foreground mb-1"
                          )}>
                          <FileText />
                          <div className="flex-1 flex items-center justify-between">
                             <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="truncate max-w-[150px]">{fileName}</span>
                                </TooltipTrigger>
                                <TooltipContent><p>{fileName}</p></TooltipContent>
                             </Tooltip>
                             <Tooltip>
                                <TooltipTrigger asChild>
                                     <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => isGeneratingSpeech || handlePlayPause()} disabled={isSaving || isGeneratingSpeech}>
                                        {isSaving || isGeneratingSpeech ? <Loader2 className="h-4 w-4 animate-spin"/> : <CloudOff className="h-4 w-4 text-destructive" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Not saved. Generate audio to save to cloud.</p>
                                </TooltipContent>
                            </Tooltip>
                          </div>
                          </div>
                        )}
                        {userDocuments.map((doc) => (
                          <div key={doc.id} className={cn(
                              "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm mb-1",
                              activeDoc?.id === doc.id && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          )}>
                              <FileText />
                              <div className="flex-1 flex items-center justify-between">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                      <button onClick={() => handleSelectDocument(doc)} className="truncate max-w-[150px] text-left hover:underline">
                                          {doc.fileName}
                                      </button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>{doc.fileName}</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Cloud className="h-4 w-4 text-primary" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                      <p>Saved to cloud</p>
                                  </TooltipContent>
                              </Tooltip>
                              </div>
                          </div>
                        ))}
                    </div>
                </div>
              </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
               {isAdmin && (
                  <>
                    <SidebarMenu>
                      <SidebarMenuItem>
                          <SidebarMenuButton onClick={() => router.push('/admin')}>
                            <Settings />
                            Admin Dashboard
                          </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                    <Separator />
                  </>
                )}
              <div className="flex items-center gap-3 p-2">
                <Avatar>
                  <AvatarImage data-ai-hint="user avatar" src="https://placehold.co/40x40.png" />
                  <AvatarFallback>{userEmail.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate">{userEmail}</p>
                </div>
                <Button onClick={handleLogout} variant="ghost" size="icon">
                    <LogOut className="h-5 w-5"/>
                    <span className="sr-only">Log out</span>
                </Button>
              </div>
            </SidebarFooter>
          </Sidebar>
          
          <div className="flex-1 flex flex-col relative" ref={viewerContainerRef} onMouseUp={() => selection && setSelection(null)}>
            <main className="flex-1 flex items-center justify-center overflow-auto bg-muted/30">
                {pdfState !== 'loaded' && renderContent()}
                <div className="w-full h-full relative" style={{ display: pdfState === 'loaded' ? 'block' : 'none' }}>
                   <PdfViewer 
                        pdfDoc={activeDoc?.doc || null} 
                        scale={zoomLevel} 
                        onTextSelect={handleTextSelect}
                    />
                     {selection && viewerContainerRef.current && (
                        <TextSelectionMenu 
                            bounds={viewerContainerRef.current.getBoundingClientRect()}
                            selection={selection}
                            onExplain={() => handleAiAction('explain', {text: selection.text})}
                            onClose={() => setSelection(null)}
                        />
                    )}
                </div>
            </main>
            {pdfState === 'loaded' && (
                <div className={cn("absolute inset-x-0 bottom-0 z-10 transition-opacity duration-300", showControls ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
                    <AudioPlayer
                        isSpeaking={isSpeaking}
                        processingStage={processingStage}
                        processingMessage={getProcessingMessage()}
                        onPlayPause={handlePlayPause}
                        canPlay={!!documentText}
                        isFullScreen={isFullScreen}
                        onFullScreen={toggleFullScreen}
                        zoomLevel={zoomLevel}
                        onZoomIn={() => setZoomLevel(z => Math.min(z + 0.2, 3))}
                        onZoomOut={() => setZoomLevel(z => Math.max(z - 0.2, 0.4))}
                        playbackRate={playbackRate}
                        onPlaybackRateChange={setPlaybackRate}
                        showDownload={!!activeDoc?.audioUrl && processingStage === 'idle'}
                        downloadUrl={activeDoc?.audioUrl || ''}
                        downloadFileName={`${fileName || 'audio'}.mp3`}
                        progress={audioProgress}
                        duration={audioDuration}
                        currentTime={audioCurrentTime}
                        onSeek={handleSeek}
                        onForward={handleForward}
                        onRewind={handleRewind}
                    />
                </div>
            )}
          </div>

          <audio 
            ref={audioRef} 
            onEnded={() => setIsSpeaking(false)} 
            onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration)}
            onTimeUpdate={handleAudioTimeUpdate}
            hidden 
          />
          <audio ref={previewAudioRef} hidden />
          <AiDialog
            open={isAiDialogOpen}
            onOpenChange={setIsAiDialogOpen}
            type={aiDialogType}
            isLoading={aiIsLoading}
            summaryOutput={aiSummaryOutput}
            chatOutput={aiChatOutput}
            glossaryOutput={aiGlossaryOutput}
            explanationOutput={aiExplanationOutput}
            quizOutput={aiQuizOutput}
            onChatSubmit={handleAiChat}
          />
        </div>
      </TooltipProvider>
    );
}
