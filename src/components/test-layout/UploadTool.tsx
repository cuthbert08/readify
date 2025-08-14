
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { SidebarMenuButton } from '@/components/ui/sidebar';
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
        <div className='flex items-center justify-between p-2 pl-4 pr-2'>
             <SidebarMenuButton onClick={onUploadClick} className="flex-1">
                <UploadCloud />
                Upload New PDF
            </SidebarMenuButton>
            <div className='flex items-center'>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={!canMoveUp}>
                    <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={!canMoveDown}>
                    <ArrowDown className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};

export default UploadTool;
