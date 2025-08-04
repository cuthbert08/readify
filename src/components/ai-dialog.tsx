'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send } from 'lucide-react';
import type { SummarizePdfOutput } from '@/ai/flows/summarize-pdf';
import type { ChatWithPdfOutput } from '@/ai/flows/chat-with-pdf';
import { ScrollArea } from './ui/scroll-area';

export type AiDialogType = 'summary' | 'key-points' | 'chat';

type AiDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: AiDialogType;
  isLoading: boolean;
  summaryOutput: SummarizePdfOutput | null;
  chatOutput: ChatWithPdfOutput | null;
  onChatSubmit: (question: string) => void;
};

const AiDialog: React.FC<AiDialogProps> = ({
  open,
  onOpenChange,
  type,
  isLoading,
  summaryOutput,
  chatOutput,
  onChatSubmit,
}) => {
  const [question, setQuestion] = useState('');

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim()) {
      onChatSubmit(question);
      setQuestion('');
    }
  };

  const renderSummaryContent = () => (
    <Tabs defaultValue={type === 'key-points' ? 'key-points' : 'summary'} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="key-points">Key Points</TabsTrigger>
      </TabsList>
      <ScrollArea className="h-96">
        <TabsContent value="summary" className="p-4">
          <h3 className="text-lg font-semibold mb-2">Summary</h3>
          {isLoading ? (
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="animate-spin" />
              <span>Generating summary...</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {summaryOutput?.summary || 'No summary available.'}
            </p>
          )}
        </TabsContent>
        <TabsContent value="key-points" className="p-4">
          <h3 className="text-lg font-semibold mb-2">Key Points</h3>
          {isLoading ? (
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="animate-spin" />
              <span>Extracting key points...</span>
            </div>
          ) : (
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              {summaryOutput?.keyPoints?.map((point, index) => (
                <li key={index}>{point}</li>
              )) || <li>No key points available.</li>}
            </ul>
          )}
        </TabsContent>
      </ScrollArea>
    </Tabs>
  );

  const renderChatContent = () => (
    <div className="flex flex-col h-[32rem]">
      <DialogHeader>
        <DialogTitle>Ask a Question</DialogTitle>
        <DialogDescription>
          Ask a question about the document, and the AI will find the answer for you.
        </DialogDescription>
      </DialogHeader>
      <ScrollArea className="flex-1 my-4">
         <div className="p-4 space-y-4">
            {isLoading ? (
                 <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="animate-spin" />
                    <span>Thinking...</span>
                 </div>
            ) : (
                chatOutput && (
                    <div className="p-3 rounded-md bg-muted">
                        <p className="text-sm">{chatOutput.answer}</p>
                    </div>
                )
            )}
        </div>
      </ScrollArea>
      <DialogFooter>
        <form onSubmit={handleChatSubmit} className="flex w-full space-x-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type your question here..."
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !question.trim()}>
            {isLoading ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </form>
      </DialogFooter>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {type === 'chat' ? renderChatContent() : renderSummaryContent()}
      </DialogContent>
    </Dialog>
  );
};

export default AiDialog;
