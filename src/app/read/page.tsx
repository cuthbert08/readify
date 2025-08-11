
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, TextItem as PdfTextItem } from 'pdfjs-dist/types/src/display/api';
import { UploadCloud, FileText, Loader2, LogOut, Save, Library, Download, Bot, Lightbulb, HelpCircle, Cloud, CloudOff, Settings, Menu, Home, BarChart, BookOpenCheck, BrainCircuit, Mic, FastForward, Rewind, Wind, Maximize, Minimize, ZoomIn, ZoomOut, Trash2, XCircle, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import PdfViewer from '@/components/pdf-viewer';
import AudioPlayer from '@/components/audio-player';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getAvailableVoices, AvailableVoice } from '@/ai/flows/voice-selection';
import { previewSpeech } from '@/ai/flows/preview-speech';
import { summarizePdf, SummarizePdfOutput } from '@/ai/flows/summarize-pdf';
import { chatWithPdf, ChatWithPdfOutput } from '@/ai/flows/chat-with-pdf';
import { generateGlossary, GenerateGlossaryOutput, GlossaryItem } from '@/ai/flows/glossary-flow';
import { generateQuiz, type GenerateQuizOutput } from '@/ai/flows/quiz-flow';
import { cleanPdfText } from '@/ai/flows/clean-text-flow';
import { Sidebar, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarContent } from '@/components/ui/sidebar';
import { getDocuments, saveDocument, Document, getUserSession, ChatMessage, deleteDocument, clearChatHistory } from '@/lib/db';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import AiDialog, { AiDialogType } from '@/components/ai-dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Volume2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { ChatWindow } from '@/components/chat-window';
import { generateQuizFeedback } from '@/ai/flows/quiz-feedback-flow';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type PdfState = 'idle' | 'loading' | 'loaded' | 'error';
type GenerationState = 'idle' | 'generating' | 'error';
type ActiveDocument = Document;

// Helper function to concatenate audio blobs on the client-side
async function mergeAudio(audioDataUris: string[]): Promise<Blob> {
    const audioBuffers = await Promise.all(
        audioDataUris.map(async (uri) => {
            const response = await fetch(uri);
            return response.arrayBuffer();
        })
    );

    const totalLength = audioBuffers.reduce((acc, buffer) => acc + buffer.byteLength, 0);
    const merged = new Uint8Array(totalLength);
    
    let offset = 0;
    audioBuffers.forEach((buffer) => {
        merged.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
    });

    return new Blob([merged], { type: 'audio/mp3' });
}


export default function ReadPage() {
  const [pdfState, setPdfState] = useState<PdfState>('idle');
  const [activeDoc, setActiveDoc] = useState<ActiveDocument | null>(null);

  const [loadingProgress, setLoadingProgress] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [documentText, setDocumentText] = useState('');

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);

  const [availableVoices, setAvailableVoices] = useState<AvailableVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('openai/alloy');
  const [speakingRate, setSpeakingRate] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);

  const [userDocuments, setUserDocuments] = useState<Document[]>([]);

  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiDialogType, setAiDialogType] = useState<AiDialogType>('summary');
  const [aiIsLoading, setAiIsLoading] = useState(false);
  const [aiSummaryOutput, setAiSummaryOutput] = useState<SummarizePdfOutput | null>(null);
  const [aiQuizOutput, setAiQuizOutput] = useState<GenerateQuizOutput | null>(null);
  const [aiGlossaryOutput, setAiGlossaryOutput] = useState<GenerateGlossaryOutput | null>(null);

  const [showControls, setShowControls] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const [isDragging, setIsDragging] = useState(false);
  const [generationState, setGenerationState] = useState<GenerationState>('idle');
  const generationAbortController = useRef<AbortController | null>(null);

  const [synthesisText, setSynthesisText] = useState('');
  const [synthesisVoice, setSynthesisVoice] = useState('openai/alloy');
  const [synthesisRate, setSynthesisRate] = useState(1.0);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisAudioUrl, setSynthesisAudioUrl] = useState<string | null>(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localAudioUrlRef = useRef<string | null>(null); 
  const router = useRouter();
  const chatWindowRef = useRef<HTMLDivElement>(null);


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

     // Cleanup blob URL on unmount
    return () => {
      if (localAudioUrlRef.current) {
        URL.revokeObjectURL(localAudioUrlRef.current);
      }
    };

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

  const clearActiveDoc = () => {
    setActiveDoc(null);
    setDocumentText('');
    setPdfState('idle');
    setZoomLevel(1);
    setIsChatOpen(false);
    if (audioRef.current) {
        audioRef.current.src = "";
    }
     if (localAudioUrlRef.current) {
        URL.revokeObjectURL(localAudioUrlRef.current);
        localAudioUrlRef.current = null;
    }
    setAudioDuration(0);
    setAudioCurrentTime(0);
    setAudioProgress(0);
  }

  const loadPdf = useCallback(async (source: File | string, existingDoc: Document | null) => {
    clearActiveDoc();
    setPdfState('loading');
    setLoadingProgress(0);
    setAiSummaryOutput(null);
    setAiQuizOutput(null);
    setAiGlossaryOutput(null);
    
    try {
      const loadingTask = pdfjsLib.getDocument(typeof source === 'string' ? { url: source } : { data: await source.arrayBuffer() });
      loadingTask.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
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

      if (source instanceof File) {
         const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/pdf', 'x-vercel-filename': source.name },
            body: source,
        });
        if (!uploadResponse.ok) throw new Error('PDF Upload failed');
        const pdfBlob = await uploadResponse.json();
        
        const savedDoc = await saveDocument({
            fileName: source.name,
            pdfUrl: pdfBlob.url,
        });
        setActiveDoc(savedDoc);
        fetchUserDocuments();
      } else if (existingDoc) {
        setActiveDoc(existingDoc);
        setZoomLevel(existingDoc.zoomLevel || 1);
         if (existingDoc.audioUrl && audioRef.current) {
            audioRef.current.src = existingDoc.audioUrl;
            audioRef.current.load();
        }
      }

      setPdfState('loaded');

    } catch (error) {
      console.error('Failed to load PDF:', error);
      setPdfState('error');
      toast({
        variant: "destructive",
        title: "PDF Load Error",
        description: error instanceof Error ? error.message : "Could not process the PDF.",
      });
    }
  }, [toast, fetchUserDocuments]);


  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      toast({ variant: "destructive", title: "Invalid File", description: "Please select a PDF file." });
      return;
    }
    await loadPdf(file, null);
  };

  const handleFileDrop = async (file: File) => {
      if (!file || file.type !== 'application/pdf') {
          toast({ variant: "destructive", title: "Invalid File", description: "Please select a PDF file." });
          return;
      }
      await loadPdf(file, null);
  };
  
  const handleSelectDocument = async (doc: Document) => {
    await loadPdf(doc.pdfUrl, doc);
  }

  const handlePlayPause = async () => {
    if (!audioRef.current) return;
    if (isSpeaking) {
      audioRef.current.pause();
    } else if (audioRef.current.src && audioRef.current.src !== window.location.href) { 
      try {
        await audioRef.current.play();
      } catch (error) {
        console.error("Error playing audio:", error);
        toast({ variant: "destructive", title: "Playback Error", description: "Could not play the audio file."});
      }
    }
  };
  
  const handleGenerateAudio = async () => {
      if (generationState === 'generating') {
          if (generationAbortController.current) {
              generationAbortController.current.abort();
              toast({ title: "Cancelled", description: "Audio generation has been cancelled." });
          }
          return;
      }

      if (!documentText || !activeDoc || !activeDoc.id) {
          toast({ variant: "destructive", title: "No Document", description: "Please load a document first." });
          return;
      }

      generationAbortController.current = new AbortController();
      const signal = generationAbortController.current.signal;
      
      setGenerationState('generating');
      toast({ title: "Starting Audio Generation", description: "Formatting text and preparing to generate speech..." });

      try {
        const response = await fetch('/api/generate-speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: documentText,
                voice: selectedVoice,
                speakingRate: speakingRate,
            }),
            signal: signal,
        });
        
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Speech generation API failed');
        }
        const result = await response.json();
        
        const mergedAudioBlob = await mergeAudio(result.audioDataUris);

        const audioFileName = `${activeDoc.fileName.replace(/\.pdf$/i, '') || 'audio'}.mp3`;
        const uploadAudioResponse = await fetch('/api/upload', {
            method: 'POST',
            headers: { 
                'Content-Type': 'audio/mp3', 
                'x-vercel-filename': audioFileName,
                'x-doc-id': activeDoc.id,
            },
            body: mergedAudioBlob,
        });
        if (!uploadAudioResponse.ok) throw new Error('Audio Upload failed');
        const audioBlobResult = await uploadAudioResponse.json();
        const newAudioUrl = audioBlobResult.url;

        const updatedDoc = await saveDocument({
            id: activeDoc.id,
            audioUrl: newAudioUrl,
        });

        setActiveDoc(updatedDoc);
        if (audioRef.current) {
            audioRef.current.src = newAudioUrl;
            audioRef.current.load();
        }
        await fetchUserDocuments();

        toast({ title: "Success", description: "Audio generated and saved." });

      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log("Audio generation was aborted.");
        } else {
          console.error('Speech generation error', error);
          const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
          toast({ variant: "destructive", title: "Audio Error", description: `Could not generate audio. ${errorMessage}` });
        }
      } finally {
        setGenerationState('idle');
        generationAbortController.current = null;
      }
  };
  
  const handleDeleteDocument = async (docId: string | null) => {
      if (!docId) return;

      if (!window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
          return;
      }
      try {
          const result = await deleteDocument(docId);
          if (result.success) {
              toast({ title: "Success", description: "Document deleted successfully." });
              if (activeDoc?.id === docId) {
                  clearActiveDoc();
              }
              fetchUserDocuments();
          } else {
              throw new Error(result.message);
          }
      } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
          toast({ variant: "destructive", title: "Deletion Error", description: `Could not delete document: ${errorMessage}` });
      }
  }

  const handleAudioTimeUpdate = () => {
      if (!audioRef.current) return;
      setAudioCurrentTime(audioRef.current.currentTime);
      if (audioDuration > 0) {
          setAudioProgress((audioRef.current.currentTime / audioDuration) * 100);
      }
  }

  const handlePreviewVoice = async (voice: string) => {
    try {
      const result = await previewSpeech({ voice: voice });
      if (result.audioDataUri && previewAudioRef.current) {
        previewAudioRef.current.src = result.audioDataUri;
        previewAudioRef.current.play();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast({ variant: "destructive", title: "Audio Error", description: `Could not preview voice: ${errorMessage}` });
    }
  }
  
  const handlePlayAiResponse = async (text: string) => {
    try {
      const response = await fetch('/api/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: selectedVoice,
          speakingRate: 1.0, // Use a default rate for chat responses
        }),
      });

      if (!response.ok) throw new Error('Speech generation API failed');
      const result = await response.json();
      
      const mergedAudioBlob = await mergeAudio(result.audioDataUris);
      const audioUrl = URL.createObjectURL(mergedAudioBlob);
      
      if (previewAudioRef.current) {
          previewAudioRef.current.src = audioUrl;
          previewAudioRef.current.play();
          previewAudioRef.current.onended = () => {
              URL.revokeObjectURL(audioUrl);
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({ variant: "destructive", title: "Audio Error", description: `Could not play response: ${errorMessage}` });
    }
  };

  const handleSynthesize = async () => {
      if (!synthesisText.trim()) {
          toast({ variant: "destructive", title: "No Text", description: "Please enter some text to synthesize." });
          return;
      }
      setIsSynthesizing(true);
      setSynthesisAudioUrl(null);
      if (localAudioUrlRef.current) {
          URL.revokeObjectURL(localAudioUrlRef.current);
          localAudioUrlRef.current = null;
      }
      try {
          const response = await fetch('/api/generate-speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: synthesisText,
              voice: synthesisVoice,
              speakingRate: synthesisRate,
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'API call failed');
          }

          const result = await response.json();
          
          if (result.audioDataUris && result.audioDataUris.length > 0) {
              const mergedAudioBlob = await mergeAudio(result.audioDataUris);
              const audioUrl = URL.createObjectURL(mergedAudioBlob);
              localAudioUrlRef.current = audioUrl;
              setSynthesisAudioUrl(audioUrl);
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

  const handleAiAction = async (type: AiDialogType) => {
    setAiDialogType(type);
    setIsAiDialogOpen(true);
    setAiIsLoading(true);
    setAiSummaryOutput(null);
    setAiQuizOutput(null);
    setAiGlossaryOutput(null);

    try {
      if ((type === 'summary' || type === 'key-points') && documentText) {
        const result = await summarizePdf({ pdfText: documentText });
        setAiSummaryOutput(result);
      } else if (type === 'glossary' && documentText) {
          const result = await generateGlossary({ documentText: documentText });
          setAiGlossaryOutput(result);
      } else if (type === 'quiz' && documentText) {
          if (activeDoc?.quizAttempt) {
            setAiQuizOutput({ quiz: activeDoc.quizAttempt.questions });
          } else {
            const result = await generateQuiz({ documentText });
            setAiQuizOutput(result);
          }
      }
    } catch (error) {
      console.error(`AI Error (${type}):`, error);
      toast({ variant: "destructive", title: "AI Error", description: `Could not perform AI action: ${type}.` });
    } finally {
      setAiIsLoading(false);
    }
  };

  const handleQuizSubmit = async (questions: any[], answers: Record<number, string>) => {
    if (!activeDoc || !activeDoc.id) return;
    
    let correctCount = 0;
    const failedQuestions: any[] = [];
    questions.forEach((q, index) => {
        if(q.answer === answers[index]){
            correctCount++;
        } else {
            failedQuestions.push({
                question: q.question,
                userAnswer: answers[index] || "Not answered",
                correctAnswer: q.answer,
            });
        }
    });

    const score = (correctCount / questions.length) * 100;
    
    let feedback = 'Great job! You got all the questions right!';
    if(failedQuestions.length > 0) {
        toast({ title: "Generating Feedback", description: "Analyzing your answers..." });
        const feedbackResult = await generateQuizFeedback({ documentText, failedQuestions });
        feedback = feedbackResult.feedback;
    }

    const quizAttempt = {
        questions,
        answers,
        score,
        suggestions: feedback,
        completedAt: new Date().toISOString()
    };
    
    const updatedDoc = await saveDocument({ id: activeDoc.id, quizAttempt });
    setActiveDoc(updatedDoc);
    toast({
        title: `Quiz Complete! Score: ${score.toFixed(0)}%`,
        description: "You can review your results and suggestions.",
    });
  };

  const handleSendMessage = async (message: string) => {
      if(!activeDoc || !activeDoc.id || !documentText) return;

      const userMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content: message,
          createdAt: new Date().toISOString(),
      };
      
      const updatedHistory = [...(activeDoc.chatHistory || []), userMessage];
      setActiveDoc(prev => prev ? {...prev, chatHistory: updatedHistory} : null);
      setIsChatLoading(true);

      try {
          const result = await chatWithPdf({
              pdfText: documentText,
              question: message,
              chatHistory: updatedHistory.slice(-10), // Send last 10 messages for context
          });

          const assistantMessage: ChatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: result.answer,
              createdAt: new Date().toISOString(),
          };

          const finalHistory = [...updatedHistory, assistantMessage];
          
          const updatedDoc = await saveDocument({ id: activeDoc.id, chatHistory: finalHistory });
          setActiveDoc(updatedDoc);

      } catch (error) {
          toast({ variant: "destructive", title: "Chat Error", description: "Could not get an answer." });
          setActiveDoc(prev => prev ? {...prev, chatHistory: updatedHistory} : null);
      } finally {
          setIsChatLoading(false);
      }
  }

  const handleClearChat = async () => {
    if (!activeDoc || !activeDoc.id) return;
    
    try {
        const updatedDoc = await clearChatHistory(activeDoc.id);
        setActiveDoc(updatedDoc);
        toast({ title: "Success", description: "Chat history has been cleared." });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Could not clear chat history.";
        toast({ variant: "destructive", title: "Error", description: message });
    }
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
    if (activeDoc?.id && !isSaving && generationState === 'idle') {
      const timer = setTimeout(() => {
        saveDocument({
          id: activeDoc.id,
          zoomLevel: zoomLevel
        }).catch(err => console.error("Failed to auto-save zoom level", err));
      }, 2000); 
      return () => clearTimeout(timer);
    }
  }, [activeDoc, zoomLevel, isSaving, generationState]);
  
  const getProcessingMessage = () => {
      switch (generationState) {
          case 'generating': return 'Generating and saving audio...';
          case 'error': return 'An error occurred during audio generation.';
          default: return '';
      }
  }

  const pdfDocProp = useMemo(() => {
    if (!activeDoc) return null;
    return { url: activeDoc.pdfUrl };
  }, [activeDoc]);

  const groupedVoices = useMemo(() => {
    return availableVoices.reduce((acc, voice) => {
        const provider = voice.provider;
        if (!acc[provider]) {
            acc[provider] = [];
        }
        acc[provider].push(voice);
        return acc;
    }, {} as Record<string, AvailableVoice[]>);
  }, [availableVoices]);

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
                                        {Object.entries(groupedVoices).map(([provider, voices]) => (
                                            <SelectGroup key={provider}>
                                                <Label className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{provider.toUpperCase()}</Label>
                                                {voices.map((voice) => (
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
                                            </SelectGroup>
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
        
        { !isFullScreen && (
          <Sidebar>
              <SidebarHeader>
                  <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-headline text-primary flex items-center gap-2"><BarChart /> Readify</h1>
                  <ThemeToggle />
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
                              <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={isSpeaking || generationState === 'generating'}>
                                  <SelectTrigger>
                                      <SelectValue placeholder="Select a voice"/>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(groupedVoices).map(([provider, voices]) => (
                                        <SelectGroup key={provider}>
                                            <Label className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{provider.toUpperCase()}</Label>
                                            {voices.map((voice) => (
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
                                        </SelectGroup>
                                    ))}
                                  </SelectContent>
                              </Select>
                          </div>
                          <div className='space-y-2'>
                              <Label htmlFor="speaking-rate">Speaking Rate: {speakingRate.toFixed(2)}x</Label>
                              <Slider id="speaking-rate" min={0.25} max={4.0} step={0.25} value={[speakingRate]} onValueChange={(v) => setSpeakingRate(v[0])} disabled={isSpeaking || generationState === 'generating'} />
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
                              {activeDoc?.quizAttempt ? 'Review Quiz' : 'Generate Quiz'}
                          </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => setIsChatOpen(true)} disabled={pdfState !== 'loaded'}>
                          <MessageSquare />
                          Chat with Document
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
                          {userDocuments.map((doc) => (
                          <div key={doc.id} className={cn(
                              "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm mb-1 group",
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
                                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    {doc.audioUrl ? (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Cloud className="h-4 w-4 text-primary mr-1" />
                                            </TooltipTrigger>
                                            <TooltipContent><p>Audio is saved</p></TooltipContent>
                                        </Tooltip>
                                    ) : (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleGenerateAudio} disabled={generationState === 'generating' || activeDoc?.id !== doc.id}>
                                                    {generationState === 'generating' && activeDoc?.id === doc.id ? <XCircle className="h-4 w-4 text-destructive" /> : <Mic className="h-4 w-4" />}
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent><p>{generationState === 'generating' && activeDoc?.id === doc.id ? 'Cancel Generation' : 'Generate Audio'}</p></TooltipContent>
                                        </Tooltip>
                                    )}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteDocument(doc.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Delete document</p></TooltipContent>
                                    </Tooltip>
                                  </div>
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
                  <p className="text-sm font-medium truncate" onClick={() => router.push('/profile')} style={{cursor: 'pointer'}}>{userEmail}</p>
                  </div>
                  <Button onClick={handleLogout} variant="ghost" size="icon">
                      <LogOut className="h-5 w-5"/>
                      <span className="sr-only">Log out</span>
                  </Button>
              </div>
              </SidebarFooter>
          </Sidebar>
          )}
        
        <div className="flex-1 flex flex-col relative" ref={viewerContainerRef}>
            <main className="flex-1 flex items-center justify-center overflow-auto bg-muted/30">
              {pdfState !== 'loaded' && renderContent()}
              <div className={cn("w-full h-full relative", pdfState === 'loaded' ? 'flex items-center justify-center' : 'hidden')}>
                  <PdfViewer 
                      pdfDoc={pdfDocProp}
                      scale={zoomLevel} 
                  />
              </div>
            </main>
            {pdfState === 'loaded' && (
                <div className={cn("absolute inset-x-0 bottom-0 z-10 transition-opacity duration-300", showControls ? 'opacity-100' : 'opacity-0 pointer-events-none')}>
                    <AudioPlayer
                        isSpeaking={isSpeaking}
                        processingStage={generationState}
                        processingMessage={getProcessingMessage()}
                        onPlayPause={handlePlayPause}
                        canPlay={!!(activeDoc?.audioUrl)}
                        isFullScreen={isFullScreen}
                        onFullScreen={toggleFullScreen}
                        zoomLevel={zoomLevel}
                        onZoomIn={() => setZoomLevel(z => Math.min(z + 0.2, 3))}
                        onZoomOut={() => setZoomLevel(z => Math.max(z - 0.2, 0.4))}
                        playbackRate={playbackRate}
                        onPlaybackRateChange={setPlaybackRate}
                        showDownload={!!activeDoc?.audioUrl && generationState === 'idle'}
                        downloadUrl={activeDoc?.audioUrl || ''}
                        downloadFileName={`${activeDoc?.fileName || 'audio'}.mp3`}
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
        
        {isChatOpen && activeDoc && (
            <ChatWindow 
                ref={chatWindowRef}
                key={activeDoc.id}
                chatHistory={activeDoc.chatHistory || []}
                isLoading={isChatLoading}
                onSendMessage={handleSendMessage}
                onClose={() => setIsChatOpen(false)}
                onPlayAudio={handlePlayAiResponse}
                onClearChat={handleClearChat}
            />
        )}

        <audio 
          ref={audioRef} 
          onPlay={() => setIsSpeaking(true)}
          onPause={() => setIsSpeaking(false)}
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
          glossaryOutput={aiGlossaryOutput}
          quizOutput={aiQuizOutput}
          quizAttempt={activeDoc?.quizAttempt || null}
          onQuizSubmit={handleQuizSubmit}
        />
      </div>
    </TooltipProvider>
  );
}
