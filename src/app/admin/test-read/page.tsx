
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, BarChart, TestTube2 } from 'lucide-react';

import { useDocumentManager } from '@/hooks/test-page/useDocumentManager';
import { useAudioManager } from '@/hooks/test-page/useAudioManager';
import { useAiFeatures } from '@/hooks/test-page/useAiFeatures';

import AudioPlayer from '@/components/audio-player';
import { Sidebar, SidebarHeader, SidebarFooter, SidebarContent } from '@/components/ui/sidebar';
import AiDialog from '@/components/ai-dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';
import { ChatWindow } from '@/components/chat-window';
import PdfViewer from '@/components/pdf-viewer';
import AudioSettings from '@/components/test-layout/AudioSettings';
import AiTools from '@/components/test-layout/AiTools';
import DocumentLibrary from '@/components/test-layout/DocumentLibrary';
import UserPanel from '@/components/test-layout/UserPanel';
import UploadTool from '@/components/test-layout/UploadTool';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import SpeechSynthesizer from '@/components/test-layout/SpeechSynthesizer';
import { generateSpeech } from '@/ai/flows/generate-speech';
import { useToast } from '@/hooks/use-toast';

// Helper function to concatenate audio blobs
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


export default function TestReadPage() {
  const router = useRouter();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [sidebarOrder, setSidebarOrder] = useState<string[]>(['upload', 'audio', 'ai', 'docs', 'synth']);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { toast } = useToast();

  const {
    activeDoc,
    setActiveDoc,
    documentText,
    userDocuments,
    pdfZoomLevel,
    isSavingZoom,
    isAdmin,
    userEmail,
    handleSelectDocument: selectDoc,
    handleFileUpload: uploadFile,
    handleDeleteDocument: deleteDoc,
    handleZoomIn,
    handleZoomOut,
    handleSaveZoom,
    clearActiveDoc,
    fetchUserDocuments,
  } = useDocumentManager();
  
  const {
    audioRef,
    previewAudioRef,
    isSpeaking,
    setIsSpeaking,
    audioProgress,
    setAudioProgress,
    audioDuration,
    setAudioDuration,
    audioCurrentTime,
    setAudioCurrentTime,
    availableVoices,
    selectedVoice,
    setSelectedVoice,
    speakingRate,
    setSpeakingRate,
    playbackRate,
    setPlaybackRate,
    generationState,
    setGenerationState,
    handlePlayPause,
    handleGenerateAudio,
    handleAudioTimeUpdate,
    handlePreviewVoice,
    handleSeek,
    handleForward,
    handleRewind,
    getProcessingMessage,
  } = useAudioManager({ activeDoc, documentText });
  
  const {
    isAiDialogOpen,
    aiDialogType,
    aiIsLoading,
    aiSummaryOutput,
    aiQuizOutput,
    aiGlossaryOutput,
    isChatOpen,
    isChatLoading,
    chatWindowRef,
    handleAiAction,
    handleQuizSubmit,
    handleSendMessage,
    handleClearChat,
    handlePlayAiResponse,
    setIsAiDialogOpen,
    setIsChatOpen,
  } = useAiFeatures({ 
      documentText, 
      activeDoc, 
      selectedVoice, 
      speakingRate, 
      fetchDoc: fetchUserDocuments,
      setActiveDoc: setActiveDoc
  });
  
  // State for the standalone synthesizer
  const [synthesisText, setSynthesisText] = useState('');
  const [synthesisVoice, setSynthesisVoice] = useState('openai/alloy');
  const [synthesisRate, setSynthesisRate] = useState(1.0);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisAudioUrl, setSynthesisAudioUrl] = useState<string | null>(null);
  const localAudioUrlRef = useRef<string | null>(null);

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
          voice: synthesisVoice,
          speakingRate: synthesisRate,
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


  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const handleClearActiveDoc = () => {
      clearActiveDoc(audioRef);
  }

  const handleSelectDocument = (doc: any) => {
    selectDoc(doc, audioRef);
  };
  
  const handleFileUpload = (files: FileList | null) => {
    if (files && files[0]) {
      uploadFile(files[0], () => clearActiveDoc(audioRef));
    }
  };
  
  const handleDeleteDocument = (docId: string | null) => {
    deleteDoc(docId, () => clearActiveDoc(audioRef));
  };

  const handleMoveComponent = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...sidebarOrder];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
    setSidebarOrder(newOrder);
  };

  const sidebarComponents = {
    upload: (key: string, index: number) => (
      <div key={key}>
        <Separator className="my-2" />
        <UploadTool
          onUploadClick={() => fileInputRef.current?.click()}
          onMoveUp={() => handleMoveComponent(index, 'up')}
          onMoveDown={() => handleMoveComponent(index, 'down')}
          canMoveUp={index > 0}
          canMoveDown={index < sidebarOrder.length - 1}
        />
        <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileUpload(e.target.files)}
            accept="application/pdf"
            className="hidden"
        />
      </div>
    ),
    audio: (key: string, index: number) => (
      <div key={key}>
        <Separator className="my-2" />
        <AudioSettings
          availableVoices={availableVoices}
          selectedVoice={selectedVoice}
          onSelectedVoiceChange={setSelectedVoice}
          speakingRate={speakingRate}
          onSpeakingRateChange={setSpeakingRate}
          isSpeaking={isSpeaking}
          generationState={generationState}
          onPreviewVoice={handlePreviewVoice}
          onMoveUp={() => handleMoveComponent(index, 'up')}
          onMoveDown={() => handleMoveComponent(index, 'down')}
          canMoveUp={index > 0}
          canMoveDown={index < sidebarOrder.length - 1}
        />
      </div>
    ),
    ai: (key: string, index: number) => (
      <div key={key}>
        <Separator className="my-2" />
        <AiTools
          onAiAction={handleAiAction}
          onChatOpen={() => setIsChatOpen(true)}
          documentText={documentText}
          activeDoc={activeDoc}
          onMoveUp={() => handleMoveComponent(index, 'up')}
          onMoveDown={() => handleMoveComponent(index, 'down')}
          canMoveUp={index > 0}
          canMoveDown={index < sidebarOrder.length - 1}
        />
      </div>
    ),
    docs: (key: string, index: number) => (
      <div key={key}>
        <Separator className="my-2" />
        <DocumentLibrary
          documents={userDocuments}
          activeDocId={activeDoc?.id || null}
          generationState={generationState}
          onSelectDocument={handleSelectDocument}
          onGenerateAudio={() => handleGenerateAudio(setActiveDoc, fetchUserDocuments)}
          onDeleteDocument={handleDeleteDocument}
          onMoveUp={() => handleMoveComponent(index, 'up')}
          onMoveDown={() => handleMoveComponent(index, 'down')}
          canMoveUp={index > 0}
          canMoveDown={index < sidebarOrder.length - 1}
        />
      </div>
    ),
    synth: (key: string, index: number) => (
        <div key={key}>
            <Separator className="my-2" />
            <SpeechSynthesizer
                text={synthesisText}
                onTextChange={setSynthesisText}
                availableVoices={availableVoices}
                selectedVoice={synthesisVoice}
                onSelectedVoiceChange={setSynthesisVoice}
                speakingRate={synthesisRate}
                onSpeakingRateChange={setSynthesisRate}
                isSynthesizing={isSynthesizing}
                onSynthesize={handleSynthesize}
                audioUrl={synthesisAudioUrl}
                onMoveUp={() => handleMoveComponent(index, 'up')}
                onMoveDown={() => handleMoveComponent(index, 'down')}
                canMoveUp={index > 0}
                canMoveDown={index < sidebarOrder.length - 1}
            />
        </div>
    )
  };

  const renderContent = () => {
    if (activeDoc) {
      return (
          <PdfViewer
            file={activeDoc.pdfUrl}
            zoomLevel={pdfZoomLevel}
          />
      );
    }
    
    return (
        <div
          className="w-full h-full flex items-center justify-center p-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFileUpload(e.dataTransfer.files);
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
                    onChange={(e) => handleFileUpload(e.target.files)}
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
                <div className='flex items-center gap-2'>
                    <h1 className="text-2xl font-headline text-primary flex items-center gap-2"><BarChart /> Readify</h1>
                    <div className='flex items-center gap-1 bg-destructive/20 text-destructive border border-destructive/50 rounded-full px-2 py-0.5'>
                        <TestTube2 className='h-4 w-4'/>
                        <span className='text-xs font-bold'>TEST MODE</span>
                    </div>
                </div>
                <ThemeToggle />
                </div>
            </SidebarHeader>
            <SidebarContent>
                {sidebarOrder.map((key, index) => sidebarComponents[key as keyof typeof sidebarComponents](key, index))}
            </SidebarContent>
            <SidebarFooter>
                <UserPanel 
                    isAdmin={isAdmin}
                    userEmail={userEmail}
                    onLogout={handleLogout}
                    onNavigateToAdmin={() => router.push('/admin')}
                    onNavigateToProfile={() => router.push('/profile')}
                />
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
                        showDownload={!!activeDoc?.audioUrl && generationState === 'idle' && !activeDoc.id.startsWith('local-')}
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
          onPlayAudio={handlePlayAiResponse}
        />
      </div>
    </TooltipProvider>
  );
}

    