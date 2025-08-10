
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Loader2, Minus, Send, X, Volume2 } from 'lucide-react';
import { type ChatMessage } from '@/lib/db';
import ReactMarkdown from 'react-markdown';
import { DraggableCore } from 'react-draggable';

type ChatWindowProps = {
  chatHistory: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onClose: () => void;
  onPlayAudio: (text: string) => void;
};

export function ChatWindow({ chatHistory, isLoading, onSendMessage, onClose, onPlayAudio }: ChatWindowProps) {
  const [message, setMessage] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
        const scrollableView = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
        if(scrollableView) {
            scrollableView.scrollTop = scrollableView.scrollHeight;
        }
    }
  }, [chatHistory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
    }
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button onClick={() => setIsMinimized(false)}>Chat ({chatHistory.length})</Button>
      </div>
    );
  }

  return (
    <DraggableCore 
        handle=".handle"
        onDrag={(e, data) => setPosition(prev => ({ x: prev.x + data.deltaX, y: prev.y + data.deltaY }))}
    >
      <div
        className="fixed bottom-4 right-4 z-50"
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      >
        <Card className="w-[450px] h-[600px] flex flex-col shadow-2xl">
          <CardHeader className="handle cursor-move flex flex-row items-center justify-between p-4">
            <CardTitle>Chat with Document</CardTitle>
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(true)}><Minus /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X /></Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
              <div className="space-y-4">
                {chatHistory.map((chat) => (
                  <div key={chat.id} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-lg ${chat.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                       <div className="prose dark:prose-invert text-sm">
                         <ReactMarkdown>{chat.content}</ReactMarkdown>
                       </div>
                       {chat.role === 'assistant' && (
                           <Button variant="ghost" size="icon" className="h-6 w-6 mt-2" onClick={() => onPlayAudio(chat.content)}>
                               <Volume2 className="h-4 w-4" />
                           </Button>
                       )}
                    </div>
                  </div>
                ))}
                 {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-muted p-3 rounded-lg">
                            <Loader2 className="animate-spin" />
                        </div>
                    </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="p-4">
            <form onSubmit={handleSubmit} className="flex w-full gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask a question..."
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading || !message.trim()}>
                {isLoading ? <Loader2 className="animate-spin" /> : <Send />}
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>
    </DraggableCore>
  );
}
