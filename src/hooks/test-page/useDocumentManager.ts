
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { getDocuments, saveDocument, deleteDocument, Document, getUserSession } from '@/lib/db';
import { cleanPdfText } from '@/ai/flows/clean-text-flow';

const IS_STAGING = true;

export const useDocumentManager = () => {
    const { toast } = useToast();
    const [activeDoc, setActiveDoc] = useState<Document | null>(null);
    const [userDocuments, setUserDocuments] = useState<Document[]>([]);
    const [documentText, setDocumentText] = useState('');
    const [pdfZoomLevel, setPdfZoomLevel] = useState(1);
    const [isSavingZoom, setIsSavingZoom] = useState(false);
    const localPdfUrlRef = useRef<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [userEmail, setUserEmail] = useState('');

    useEffect(() => {
        async function checkSession() {
          const session = await getUserSession();
          if (session) {
            setIsAdmin(session.isAdmin || false);
            setUserEmail(session.email || 'user@example.com');
          }
        }
        checkSession();
        fetchUserDocuments();
    
        return () => {
          if (localPdfUrlRef.current) {
            URL.revokeObjectURL(localPdfUrlRef.current);
          }
        };
      }, []);

    const fetchUserDocuments = useCallback(async () => {
        try {
            const docs = await getDocuments(IS_STAGING);
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

    const clearActiveDocState = (audioRef: React.RefObject<HTMLAudioElement>) => {
        setActiveDoc(null);
        setDocumentText('');
        if (audioRef.current) {
            audioRef.current.src = "";
        }
        if (localPdfUrlRef.current) {
            URL.revokeObjectURL(localPdfUrlRef.current);
            localPdfUrlRef.current = null;
        }
    };
    
    const handleSetUsername = (doc: Document) => {
        setActiveDoc(doc);
    }

    const handleSelectDocument = async (doc: Document) => {
        setActiveDoc(doc);
        setDocumentText(doc.textContent || '');
        setPdfZoomLevel(doc.zoomLevel);
    };

    const handleFileUpload = async (file: File, clearDoc: () => void) => {
        if (!file.type.includes('pdf')) {
            toast({ variant: "destructive", title: "Invalid File Type", description: "Please upload a PDF file." });
            return;
        }
        clearDoc();
        const localUrl = URL.createObjectURL(file);
        localPdfUrlRef.current = localUrl;
        const tempDoc: Document = {
            id: `local-${Date.now()}`,
            userId: '',
            fileName: file.name,
            pdfUrl: localUrl,
            textContent: '',
            audioUrl: null,
            zoomLevel: 1,
            createdAt: new Date().toISOString(),
            chatHistory: [],
            quizAttempt: null
        };
        setActiveDoc(tempDoc);
        toast({ title: "Processing Document", description: "PDF is viewable now. AI features will be enabled shortly." });

        try {
            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                headers: { 
                    'x-vercel-filename': file.name,
                    'x-is-staging': IS_STAGING ? 'true' : 'false'
                },
                body: file,
            });
            if (!uploadResponse.ok) throw new Error('Failed to upload file.');
            const blob = await uploadResponse.json();

            const pdf = await (window as any).pdfjsLib.getDocument(blob.url).promise;
            const numPages = pdf.numPages;
            let rawText = '';
            for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                rawText += textContent.items.map((item: any) => item.str).join(' ');
            }
            
            const { cleanedText } = await cleanPdfText({ rawText });
            setDocumentText(cleanedText);

            const newDoc = await saveDocument({
                fileName: file.name,
                pdfUrl: blob.url,
                textContent: cleanedText,
                zoomLevel: 1,
            }, IS_STAGING);
            
            setActiveDoc(newDoc);
            await fetchUserDocuments();
            URL.revokeObjectURL(localUrl);
            localPdfUrlRef.current = null;
            toast({ title: "Success", description: "Your document has been prepared and all features are active." });

        } catch (error) {
            console.error("File upload process failed:", error);
            const message = error instanceof Error ? error.message : "An unknown error occurred during upload.";
            toast({ variant: "destructive", title: "Upload Failed", description: message });
            clearDoc();
        }
    };

    const handleDeleteDocument = async (docId: string | null, clearDoc: () => void) => {
        if (!docId) return;
        if (!window.confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
            return;
        }
        try {
            const result = await deleteDocument(docId, IS_STAGING);
            if (result.success) {
                toast({ title: "Success", description: "Document deleted successfully." });
                if (activeDoc?.id === docId) {
                    clearDoc();
                }
                fetchUserDocuments();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
            toast({ variant: "destructive", title: "Deletion Error", description: `Could not delete document: ${errorMessage}` });
        }
    };

    const handleZoomIn = () => setPdfZoomLevel(Math.min(pdfZoomLevel + 0.2, 3));
    const handleZoomOut = () => setPdfZoomLevel(Math.max(pdfZoomLevel - 0.2, 0.4));
    const handleSaveZoom = async () => {
        if (!activeDoc || activeDoc.id.startsWith('local-')) return;
        setIsSavingZoom(true);
        try {
            await saveDocument({ id: activeDoc.id, zoomLevel: pdfZoomLevel }, IS_STAGING);
            await fetchUserDocuments();
            toast({ title: 'Zoom level saved' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save zoom level.'});
        } finally {
            setIsSavingZoom(false);
        }
    };
    
    return {
        activeDoc,
        setActiveDoc: handleSetUsername,
        documentText,
        setDocumentText,
        userDocuments,
        setUserDocuments,
        pdfZoomLevel,
        setPdfZoomLevel,
        isSavingZoom,
        localPdfUrlRef,
        isAdmin,
        userEmail,
        fetchUserDocuments,
        handleSelectDocument: (doc: Document) => {
            clearActiveDocState(useRef<HTMLAudioElement>(null));
            handleSelectDocument(doc);
        },
        handleFileUpload: (file: File, clearDoc: () => void) => handleFileUpload(file, clearDoc),
        handleDeleteDocument: (docId: string | null, clearDoc: () => void) => handleDeleteDocument(docId, clearDoc),
        handleZoomIn,
        handleZoomOut,
        handleSaveZoom,
        clearActiveDoc: () => clearActiveDocState(useRef<HTMLAudioElement>(null)),
        handleSetUsername,
    };
};

    