
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

export default function TestReadPage() {
  const router = useRouter();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [sidebarOrder, setSidebarOrder] = useState<string[]>(['upload', 'audio', 'ai', 'docs']);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    activeDoc,
    documentText,
    userDocuments,
    pdfZoomLevel,
    isSavingZoom,
    localPdfUrlRef,
    isAdmin,
    userEmail,
    handleSelectDocument,
    handleFileUpload,
    handleDeleteDocument,
    handleZoomIn,
    handleZoomOut,
    handleSaveZoom,
    clearActiveDoc,
    fetchUserDocuments,
    handleSetUsername,
  } = useDocumentManager();
  
  const {
    audioRef,
    previewAudioRef,
    isSpeaking,
    audioProgress,
    audioDuration,
    audioCurrentTime,
    availableVoices,
    selectedVoice,
    setSelectedVoice,
    speakingRate,
    setSpeakingRate,
    playbackRate,
    setPlaybackRate,
    generationState,
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
      setActiveDoc: handleSetUsername
  });
  
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const handleFileChange = (files: FileList | null) => {
    if (files && files[0]) {
      handleFileUpload(files[0], clearActiveDoc);
    }
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
            onChange={(e) => handleFileChange(e.target.files)}
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
          onGenerateAudio={handleGenerateAudio}
          onDeleteDocument={handleDeleteDocument}
          onMoveUp={() => handleMoveComponent(index, 'up')}
          onMoveDown={() => handleMoveComponent(index, 'down')}
          canMoveUp={index > 0}
          canMoveDown={index < sidebarOrder.length - 1}
        />
      </div>
    ),
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

    