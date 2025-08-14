
'use client';

import React from 'react';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Bot, Lightbulb, BookOpenCheck, BrainCircuit, MessageSquare, ArrowUp, ArrowDown } from 'lucide-react';
import { type AiDialogType } from '@/components/ai-dialog';
import { type Document } from '@/lib/db';

type AiToolsProps = {
    onAiAction: (type: AiDialogType) => void;
    onChatOpen: () => void;
    documentText: string;
    activeDoc: Document | null;
    onMoveUp: () => void;
    onMoveDown: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
};

const AiTools: React.FC<AiToolsProps> = ({ onAiAction, onChatOpen, documentText, activeDoc, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) => {
    return (
        <div>
            <div className="p-2 text-sm font-semibold flex items-center justify-between text-muted-foreground">
                <div className='flex items-center gap-2'>
                    <Bot />
                    AI Tools
                </div>
                 <div className='flex items-center'>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={!canMoveUp}>
                        <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={!canMoveDown}>
                        <ArrowDown className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <SidebarMenuItem>
            <SidebarMenuButton onClick={() => onAiAction('summary')} disabled={!documentText}>
                <Lightbulb />
                Summarize & Key Points
            </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
            <SidebarMenuButton onClick={() => onAiAction('glossary')} disabled={!documentText}>
                <BookOpenCheck />
                Create Glossary
            </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => onAiAction('quiz')} disabled={!documentText}>
                    <BrainCircuit />
                    {activeDoc?.quizAttempt ? 'Review Quiz' : 'Generate Quiz'}
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
            <SidebarMenuButton onClick={onChatOpen} disabled={!documentText}>
                <MessageSquare />
                Chat with Document
            </SidebarMenuButton>
            </SidebarMenuItem>
        </div>
    );
};

export default AiTools;
