'use client';

import React from 'react';
import { Button } from './ui/button';
import { Lightbulb, X } from 'lucide-react';
import { Card } from './ui/card';

type TextSelectionMenuProps = {
  selection: {
    text: string;
    page: number;
    rect: DOMRect;
  } | null;
  bounds: DOMRect | null;
  onExplain: () => void;
  onClose: () => void;
};

const TextSelectionMenu: React.FC<TextSelectionMenuProps> = ({ selection, bounds, onExplain, onClose }) => {
  if (!selection || !bounds) return null;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${selection.rect.left - bounds.left + selection.rect.width / 2}px`,
    top: `${selection.rect.top - bounds.top - 50}px`, // Position above selection
    transform: 'translateX(-50%)',
    zIndex: 50,
  };

  return (
    <div style={style}>
        <Card className="p-1 flex items-center gap-1 shadow-2xl">
            <Button size="sm" variant="ghost" onClick={onExplain}>
                <Lightbulb className="mr-2 h-4 w-4" /> Explain
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose} className='h-8 w-8'>
                <X className="h-4 w-4" />
            </Button>
        </Card>
    </div>
  );
};

export default TextSelectionMenu;
