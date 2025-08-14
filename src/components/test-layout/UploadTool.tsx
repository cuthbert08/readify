
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { UploadCloud, ArrowUp, ArrowDown } from 'lucide-react';

type UploadToolProps = {
    onUploadClick: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
};

const UploadTool: React.FC<UploadToolProps> = ({ onUploadClick, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) => {
    return (
        <div>
            <div className="p-2 text-sm font-semibold flex items-center justify-between text-muted-foreground">
                <div className="flex items-center gap-2">
                    <UploadCloud />
                     <button onClick={onUploadClick} className="flex-1 text-left hover:underline">
                        Upload Document
                    </button>
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
        </div>
    );
};

export default UploadTool;
