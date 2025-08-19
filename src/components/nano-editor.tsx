"use client";

import React, { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';

interface NanoEditorProps {
  filename: string;
  initialContent: string;
  onSave: (content: string) => void;
  onExit: () => void;
}

const NanoEditor = ({ filename, initialContent, onSave, onExit }: NanoEditorProps) => {
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Use Ctrl+O for save
      if (e.ctrlKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        onSave(content);
      }
      // Use Ctrl+X for exit
      if (e.ctrlKey && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        onExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [content, onSave, onExit]);

  return (
    <div className="absolute inset-0 bg-black text-white z-50 flex flex-col font-code">
      <div className="bg-gray-700 text-center py-0.5">
        GNU nano 5.4 | File: {filename}
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 w-full bg-black text-white rounded-none border-none focus-visible:ring-0 p-2"
        autoFocus
      />
      <div className="bg-gray-700 grid grid-cols-2 gap-x-4 px-2 py-0.5">
        <span>^O Save</span>
        <span>^X Exit</span>
      </div>
    </div>
  );
};

export default NanoEditor;
