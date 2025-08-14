
'use client';

import React from 'react';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Bot, Lightbulb, BookOpenCheck, BrainCircuit, MessageSquare } from 'lucide-react';
import { type AiDialogType } from '@/components/ai-dialog';
import { type Document } from '@/lib/db';

type AiToolsProps = {
    onAiAction: (type: AiDialogType) => void;
    onChatOpen: () => void;
    documentText: string;
    activeDoc: Document | null;
};

const AiTools: React.FC<AiToolsProps> = ({ onAiAction, onChatOpen, documentText, activeDoc }) => {
    return (
        <div>
            <div className="p-2 text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Bot />
                AI Tools
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
