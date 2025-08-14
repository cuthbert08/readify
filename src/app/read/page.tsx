
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { UploadCloud, FileText, Loader2, LogOut, Save, Library, Download, Bot, Lightbulb, HelpCircle, Cloud, CloudOff, Settings, Menu, Home, BarChart, BookOpenCheck, BrainCircuit, Mic, FastForward, Rewind, Wind, Maximize, Minimize, ZoomIn, ZoomOut, Trash2, XCircle, MessageSquare, PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AudioPlayer from '@/components/audio-player';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { getAvailableVoices, AvailableVoice } from '@/ai/flows/voice-selection';
import { previewSpeech } from '@/ai/flows/preview-speech';
import { summarizePdf, SummarizePdfOutput } from '@/ai/flows/summarize-pdf';
import { chatWithPdf, ChatWithPdfOutput } from '@/ai/flows/chat-with-pdf';
import { generateGlossary, GenerateGlossaryOutput, GlossaryItem } from '@/ai/flows/glossary-flow';
import { generateQuiz, type GenerateQuizOutput } from '@/ai/flows/quiz-flow';
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
import { cleanPdfText } from '@/ai/flows/clean-text-flow';
import { generateSpeech } from '@/ai/flows/generate-speech';
import PdfViewer, { Highlight } from '@/components/pdf-viewer';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { SpeechMark } from '@/ai/schemas';

type GenerationState = 'idle' | 'generating' | 'error';
type ActiveDocument = Document;

type UploadStage = 'idle' | 'uploading' | 'extracting' | 'cleaning' | 'saving' | 'error';

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
  const [activeDoc, setActiveDoc] = useState<ActiveDocument | null>(null);
  
  const [documentText, setDocumentText] = useState('');
  const [speechMarks, setSpeechMarks] = useState<SpeechMark[]>([]);
  const [currentHighlight, setCurrentHighlight] = useState<Highlight | null>(null);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);

  const [availableVoices, setAvailableVoices] = useState<AvailableVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('openai/alloy');
  const [speakingRate, setSpeakingRate] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);

  const [userDocuments, setUserDocuments] = useState<Document[]>([]);

  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [aiDialogType, setAiDialogType] = useState<AiDialogType>('summary');
  const [aiIsLoading, setAiIsLoading] = useState(false);
  const [aiSummaryOutput, setAiSummaryOutput] = useState<SummarizePdfOutput | null>(null);
  const [aiQuizOutput, setAiQuizOutput] = useState<GenerateQuizOutput | null>(null);
  const [aiGlossaryOutput, setAiGlossaryOutput] = useState<GenerateGlossaryOutput | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const [generationState, setGenerationState] = useState<GenerationState>('idle');

  const [synthesisText, setSynthesisText] = useState('');
  const [synthesisVoice, setSynthesisVoice] = useState('openai/alloy');
  const [synthesisRate, setSynthesisRate] = useState(1.0);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisAudioUrl, setSynthesisAudioUrl] = useState<string | null>(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [uploadStage, setUploadStage] = useState<UploadStage>('idle');
  const [isUploading, setIsUploading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [pdfZoomLevel, setPdfZoomLevel] = useState(1);
  const [isSavingZoom, setIsSavingZoom] = useState(false);


  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const localAudioUrlRef = useRef<string | null>(null); 
  const router = useRouter();
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);


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


  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const clearActiveDoc = () => {
    setActiveDoc(null);
    setDocumentText('');
    setSpeechMarks([]);
    setCurrentHighlight(null);
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

  const handleNewDocumentClick = () => {
      clearActiveDoc();
  }

  const handleSelectDocument = async (doc: Document) => {
    clearActiveDoc();
    setActiveDoc(doc);
    setAiSummaryOutput(null);
    setAiQuizOutput(null);
    setAiGlossaryOutput(null);
    setPdfZoomLevel(doc.zoomLevel);
    setSpeechMarks(doc.speechMarks || []);
    
    // Fetch text if it's not already loaded or empty
    if (!doc.textContent) {
      // In a real app, you might fetch this on demand if it's large
      // For now, we assume textContent is always saved with the doc
      console.log("Document text is missing, AI tools will be limited.");
      setDocumentText("");
    } else {
      setDocumentText(doc.textContent);
    }

    if (doc.audioUrl && audioRef.current) {
        audioRef.current.src = doc.audioUrl;
        audioRef.current.load();
    }
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
          toast({ title: "In Progress", description: "Audio generation is already running." });
          return;
      }

      if (!documentText || !activeDoc || !activeDoc.id) {
          toast({ variant: "destructive", title: "No Document", description: "Please select a document with text content first." });
          return;
      }
      
      setGenerationState('generating');
      toast({ title: "Starting Audio Generation", description: "This may take a few moments..." });

      try {
        const result = await generateSpeech({
            text: documentText,
            voice: selectedVoice,
            speakingRate: speakingRate,
        });
        
        if (!result.audioDataUris || result.audioDataUris.length === 0) {
            toast({ title: "Generation Stopped", description: "Audio generation resulted in no audio." });
            setGenerationState('idle');
            return;
        }
        
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
            speechMarks: result.speechMarks || null,
        });
        
        setSpeechMarks(result.speechMarks || []);
        setActiveDoc(updatedDoc);
        if (audioRef.current) {
            audioRef.current.src = newAudioUrl;
            audioRef.current.load();
        }
        await fetchUserDocuments();

        toast({ title: "Success", description: "Audio generated and saved." });

      } catch (error: any) {
        console.error('Speech generation error', error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        toast({ variant: "destructive", title: "Audio Error", description: `Could not generate audio. ${errorMessage}` });
      } finally {
        setGenerationState('idle');
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
      const currentTimeMs = audioRef.current.currentTime * 1000;
      setAudioCurrentTime(audioRef.current.currentTime);

      if (audioDuration > 0) {
          setAudioProgress((audioRef.current.currentTime / audioDuration) * 100);
      }

      if (speechMarks.length > 0) {
        const currentWord = speechMarks.find(mark => mark.type === 'word' && currentTimeMs >= mark.time && currentTimeMs < (mark.time + (mark.end - mark.start) * 10)); // Heuristic for word duration
        const currentSentence = speechMarks.find(mark => mark.type === 'sentence' && currentTimeMs >= mark.time && currentTimeMs < (mark.time + (mark.end - mark.start) * 20));
        
        if (currentWord) {
            setCurrentHighlight({ type: 'word', start: currentWord.start, end: currentWord.end });
        } else if (currentSentence) {
            setCurrentHighlight({ type: 'sentence', start: currentSentence.start, end: currentSentence.end });
        } else {
            setCurrentHighlight(null);
        }
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
      const result = await generateSpeech({
          text,
          voice: selectedVoice, // Use global voice
          speakingRate: speakingRate, // Use global rate
      });
      
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
        const result = await generateSpeech({
            text: synthesisText,
            voice: synthesisVoice, // Use local voice for this tab
            speakingRate: synthesisRate, // Use local rate for this tab
        });
          
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
    if (!documentText) {
        toast({ variant: 'destructive', title: 'No Text', description: 'Please select a document with text content to use AI tools.' });
        return;
    }
    setAiDialogType(type);
    setIsAiDialogOpen(true);
    setAiIsLoading(true);
    setAiSummaryOutput(null);
    setAiQuizOutput(null);
    setAiGlossaryOutput(null);

    try {
      if (type === 'summary' || type === 'key-points') {
        const result = await summarizePdf({ pdfText: documentText });
        setAiSummaryOutput(result);
      } else if (type === 'glossary') {
          const result = await generateGlossary({ documentText });
          setAiGlossaryOutput(result);
      } else if (type === 'quiz') {
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

  const getProcessingMessage = () => {
      switch (generationState) {
          case 'generating': return 'Generating and saving audio...';
          case 'error': return 'An error occurred during audio generation.';
          default: return '';
      }
  }

  const getUploadMessage = () => {
    switch (uploadStage) {
        case 'uploading': return 'Uploading file...';
        case 'extracting': return 'Extracting text...';
        case 'cleaning': return 'Cleaning up content...';
        case 'saving': return 'Saving document...';
        case 'error': return 'An error occurred during upload.';
        default: return 'Drag & drop PDF here or click to upload';
    }
  };

  const handleFileChange = (files: FileList | null) => {
    if (files && files[0]) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.includes('pdf')) {
      toast({
        variant: "destructive",
        title: "Invalid File Type",
        description: "Please upload a PDF file.",
      });
      return;
    }
    setIsUploading(true);
    setUploadStage('uploading');

    try {
        // Step 1: Upload to Vercel Blob
        const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'x-vercel-filename': file.name },
            body: file,
        });

        if (!uploadResponse.ok) throw new Error('Failed to upload file.');
        const blob = await uploadResponse.json();

        // Step 2: Extract text from PDF
        setUploadStage('extracting');
        const pdf = await (window as any).pdfjsLib.getDocument(blob.url).promise;
        const numPages = pdf.numPages;
        let rawText = '';
        for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            rawText += textContent.items.map((item: any) => item.str).join(' ');
        }
        
        // Step 3: Clean text with AI
        setUploadStage('cleaning');
        const { cleanedText } = await cleanPdfText({ rawText });
        setDocumentText(cleanedText);

        // Step 4: Save document to database
        setUploadStage('saving');
        const newDoc = await saveDocument({
            fileName: file.name,
            pdfUrl: blob.url,
            textContent: cleanedText,
            zoomLevel: 1,
        });
        
        await fetchUserDocuments();
        handleSelectDocument(newDoc);
        toast({ title: "Success", description: "Your document has been prepared." });

    } catch (error) {
        setUploadStage('error');
        console.error("File upload process failed:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred during upload.";
        toast({ variant: "destructive", title: "Upload Failed", description: message });
    } finally {
        setIsUploading(false);
        setUploadStage('idle');
    }
  };


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

  const handleZoomIn = () => setPdfZoomLevel(Math.min(pdfZoomLevel + 0.2, 3));
  const handleZoomOut = () => setPdfZoomLevel(Math.max(pdfZoomLevel - 0.2, 0.4));
  const handleSaveZoom = async () => {
    if (!activeDoc) return;
    setIsSavingZoom(true);
    try {
        await saveDocument({ id: activeDoc.id, zoomLevel: pdfZoomLevel });
        await fetchUserDocuments();
        toast({ title: 'Zoom level saved' });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save zoom level.'});
    } finally {
        setIsSavingZoom(false);
    }
  }


  const renderContent = () => {
    if (activeDoc) {
      return (
          <PdfViewer
            file={activeDoc.pdfUrl}
            zoomLevel={pdfZoomLevel}
            highlight={currentHighlight}
            documentText={documentText}
          />
      );
    }

    if (isUploading) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 bg-muted/50 rounded-lg">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-xl font-semibold">{getUploadMessage()}</p>
                <p className="text-muted-foreground">Please wait while we process your document.</p>
            </div>
        );
    }
    
    return (
        <div
          className="w-full h-full flex items-center justify-center p-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileChange(e.dataTransfer.files);
          }}
        >
            <div className="text-center p-8 border-2 border-dashed border-muted-foreground/30 rounded-xl max-w-lg w-full">
                <UploadCloud className="mx-auto h-16 w-16 text-muted-foreground/50" />
                <h3 className="mt-4 text-2xl font-headline">Prepare a New Document</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    Drag and drop a PDF file here, or click the button below to select one.
                </p>
                <Button className="mt-6" onClick={() => fileInputRef.current?.click()}>
                    Select PDF File
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleFileChange(e.target.files)}
                    accept="application/pdf"
                    className="hidden"
                />
            </div>
        </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn("flex h-screen w-full bg-background", isFullScreen && "fixed inset-0 z-50")}>
        <Sidebar className={cn(isFullScreen && "hidden")}>
            <SidebarHeader>
                <div className="flex items-center justify-between">
                <h1 className="text-2xl font-headline text-primary flex items-center gap-2"><BarChart /> Readify</h1>
                <ThemeToggle />
                </div>
            </SidebarHeader>
            <SidebarContent>
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
                <SidebarMenuButton onClick={() => handleAiAction('summary')} disabled={!documentText}>
                    <Lightbulb />
                    Summarize & Key Points
                </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                <SidebarMenuButton onClick={() => handleAiAction('glossary')} disabled={!documentText}>
                    <BookOpenCheck />
                    Create Glossary
                </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => handleAiAction('quiz')} disabled={!documentText}>
                        <BrainCircuit />
                        {activeDoc?.quizAttempt ? 'Review Quiz' : 'Generate Quiz'}
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setIsChatOpen(true)} disabled={!documentText}>
                    <MessageSquare />
                    Chat with Document
                </SidebarMenuButton>
                </SidebarMenuItem>
            </div>
            <Separator className="my-2" />
            <div>
                 <div className="flex justify-between items-center p-2 text-sm font-semibold text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Library />
                        My Documents
                    </div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewDocumentClick}>
                                <PlusCircle className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>New Document</p>
                        </TooltipContent>
                    </Tooltip>
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
                                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleGenerateAudio()} disabled={generationState === 'generating' || activeDoc?.id !== doc.id}>
                                              {generationState === 'generating' && activeDoc?.id === doc.id ? <Loader2 className="h-4 w-4 animate-spin text-destructive" /> : <Mic className="h-4 w-4" />}
                                          </Button>
                                      </TooltipTrigger>
                                      <TooltipContent><p>{generationState === 'generating' && activeDoc?.id === doc.id ? 'Generating...' : 'Generate Audio'}</p></TooltipContent>
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
        
        <div className="flex-1 flex flex-col relative bg-muted/30">
            <main className="flex-1 flex items-center justify-center overflow-auto">
              {renderContent()}
            </main>
            {(activeDoc || generationState !== 'idle') && (
                <div 
                    className="absolute inset-x-0 bottom-0 z-10"
                >
                    <AudioPlayer
                        isSpeaking={isSpeaking}
                        processingStage={generationState}
                        processingMessage={getProcessingMessage()}
                        onPlayPause={handlePlayPause}
                        canPlay={!!(activeDoc?.audioUrl)}
                        playbackRate={playbackRate}
                        onPlaybackRateChange={setPlaybackRate}
                        showDownload={!!activeDoc?.audioUrl && generationState === 'idle'}
                        downloadUrl={activeDoc?.audioUrl || ''}
                        downloadFileName={`${activeDoc?.fileName?.replace(/\.pdf$/i, '') || 'audio'}.mp3`}
                        progress={audioProgress}
                        duration={audioDuration}
                        currentTime={audioCurrentTime}
                        onSeek={handleSeek}
                        onForward={handleForward}
                        onRewind={handleRewind}
                        // PDF Controls
                        zoomLevel={pdfZoomLevel}
                        onZoomIn={handleZoomIn}
                        onZoomOut={handleZoomOut}
                        isFullScreen={isFullScreen}
                        onFullScreenToggle={() => setIsFullScreen(!isFullScreen)}
                        onSaveZoom={handleSaveZoom}
                        isSavingZoom={isSavingZoom}
                        isPdfLoaded={!!activeDoc}
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
          onEnded={() => {
            setIsSpeaking(false);
            setCurrentHighlight(null);
          }} 
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
          onPlayAudio={handlePlayAiResponse}
        />
      </div>
    </TooltipProvider>
  );
}
