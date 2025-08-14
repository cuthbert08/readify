
'use client';

import { useState, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { summarizePdf, SummarizePdfOutput } from '@/ai/flows/summarize-pdf';
import { chatWithPdf } from '@/ai/flows/chat-with-pdf';
import { generateGlossary, GenerateGlossaryOutput } from '@/ai/flows/glossary-flow';
import { generateQuiz, type GenerateQuizOutput } from '@/ai/flows/quiz-flow';
import { generateQuizFeedback } from '@/ai/flows/quiz-feedback-flow';
import { generateSpeech } from '@/ai/flows/generate-speech';
import { saveDocument, clearChatHistory, Document, ChatMessage } from '@/lib/db';
import type { AiDialogType } from '@/components/ai-dialog';

const IS_STAGING = true;

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


type UseAiFeaturesProps = {
    documentText: string;
    activeDoc: Document | null;
    selectedVoice: string;
    speakingRate: number;
    setActiveDoc: (doc: Document) => void;
    previewAudioRef: React.RefObject<HTMLAudioElement>;
};

export const useAiFeatures = ({ documentText, activeDoc, selectedVoice, speakingRate, setActiveDoc, previewAudioRef }: UseAiFeaturesProps) => {
    const { toast } = useToast();
    const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
    const [aiDialogType, setAiDialogType] = useState<AiDialogType>('summary');
    const [aiIsLoading, setAiIsLoading] = useState(false);
    const [aiSummaryOutput, setAiSummaryOutput] = useState<SummarizePdfOutput | null>(null);
    const [aiQuizOutput, setAiQuizOutput] = useState<GenerateQuizOutput | null>(null);
    const [aiGlossaryOutput, setAiGlossaryOutput] = useState<GenerateGlossaryOutput | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const chatWindowRef = useRef<HTMLDivElement>(null);

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
        
        const updatedDoc = await saveDocument({ id: activeDoc.id, quizAttempt }, IS_STAGING);
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
        setActiveDoc({ ...activeDoc, chatHistory: updatedHistory });
        setIsChatLoading(true);

        try {
            const result = await chatWithPdf({
                pdfText: documentText,
                question: message,
                chatHistory: updatedHistory.slice(-10),
            });

            const assistantMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: result.answer,
                createdAt: new Date().toISOString(),
            };

            const finalHistory = [...updatedHistory, assistantMessage];
            
            const updatedDoc = await saveDocument({ id: activeDoc.id, chatHistory: finalHistory }, IS_STAGING);
            setActiveDoc(updatedDoc);

        } catch (error) {
            toast({ variant: "destructive", title: "Chat Error", description: "Could not get an answer." });
            setActiveDoc({ ...activeDoc, chatHistory: updatedHistory });
        } finally {
            setIsChatLoading(false);
        }
    };
    
    const handleClearChat = async () => {
        if (!activeDoc || !activeDoc.id) return;
        
        try {
            const updatedDoc = await clearChatHistory(activeDoc.id, IS_STAGING);
            setActiveDoc(updatedDoc);
            toast({ title: "Success", description: "Chat history has been cleared." });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Could not clear chat history.";
            toast({ variant: "destructive", title: "Error", description: message });
        }
    };

    const handlePlayAiResponse = async (text: string) => {
        try {
          const result = await generateSpeech({
              text,
              voice: selectedVoice,
              speakingRate: speakingRate,
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

    return {
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
    };
};
