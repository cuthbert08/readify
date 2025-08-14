
'use client';

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Library, PlusCircle, FileText, Cloud, Mic, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Document } from '@/lib/db';

type DocumentLibraryProps = {
    documents: Document[];
    activeDocId: string | null;
    generationState: 'idle' | 'generating' | 'error';
    onNewDocument: () => void;
    onSelectDocument: (doc: Document) => void;
    onGenerateAudio: () => void;
    onDeleteDocument: (docId: string | null) => void;
};

const DocumentLibrary: React.FC<DocumentLibraryProps> = ({
    documents,
    activeDocId,
    generationState,
    onNewDocument,
    onSelectDocument,
    onGenerateAudio,
    onDeleteDocument
}) => {
    return (
        <TooltipProvider>
            <div>
                <div className="flex justify-between items-center p-2 text-sm font-semibold text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Library />
                        My Test Documents
                    </div>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNewDocument}>
                                <PlusCircle className="h-5 w-5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>New Document</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
                <div className="px-2">
                    {documents.map((doc) => (
                    <div key={doc.id} className={cn(
                        "flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm mb-1 group",
                        activeDocId === doc.id && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    )}>
                        <FileText />
                        <div className="flex-1 flex items-center justify-between">
                            <Tooltip>
                            <TooltipTrigger asChild>
                                <button onClick={() => onSelectDocument(doc)} className="truncate max-w-[150px] text-left hover:underline">
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
                                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onGenerateAudio()} disabled={generationState === 'generating' || activeDocId !== doc.id}>
                                              {generationState === 'generating' && activeDocId === doc.id ? <Loader2 className="h-4 w-4 animate-spin text-destructive" /> : <Mic className="h-4 w-4" />}
                                          </Button>
                                      </TooltipTrigger>
                                      <TooltipContent><p>{generationState === 'generating' && activeDocId === doc.id ? 'Generating...' : 'Generate Audio'}</p></TooltipContent>
                                  </Tooltip>
                              )}
                              <Tooltip>
                                  <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDeleteDocument(doc.id)}>
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
        </TooltipProvider>
    );
};

export default DocumentLibrary;
