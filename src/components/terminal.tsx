"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCommand } from '@/hooks/use-command';
import Typewriter from './typewriter';
import { User } from 'firebase/auth';
import NanoEditor from './nano-editor';
import { Skeleton } from './ui/skeleton';

interface HistoryItem {
  id: number;
  command: string;
  output: React.ReactNode;
  prompt: string;
}

const BlinkingCursor = () => (
  <span className="w-2.5 h-5 bg-accent inline-block animate-blink ml-1" />
);

export default function Terminal({ user }: { user: User | null | undefined }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [command, setCommand] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const { 
    prompt, 
    processCommand, 
    getWelcomeMessage,
    editingFile,
    saveFile,
    exitEditor,
    isProcessing,
  } = useCommand(user);

  const inputRef = useRef<HTMLInputElement>(null);
  const endOfHistoryRef = useRef<HTMLDivElement>(null);
  
  const focusInput = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 768 && !editingFile) {
      inputRef.current?.focus();
    }
  }, [editingFile]);

  useEffect(() => {
    focusInput();
    const clickHandler = () => focusInput();
    window.addEventListener('click', clickHandler);
    return () => window.removeEventListener('click', clickHandler);
  }, [focusInput]);

  const loadWelcomeMessage = useCallback(() => {
    setIsTyping(true);
    const output = getWelcomeMessage();
    if (!output) {
      setIsTyping(false);
      return;
    }
    const welcomeHistory: HistoryItem = {
      id: 0,
      command: '',
      output: <Typewriter text={output} onFinished={() => setIsTyping(false)} />,
      prompt: '',
    };
    setHistory([welcomeHistory]);
  }, [getWelcomeMessage]);
  
  // Reload welcome message only when user logs in or out
  useEffect(() => {
    setHistory([]);
    loadWelcomeMessage();
  }, [user, loadWelcomeMessage]);

  useEffect(() => {
    endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isTyping, isProcessing]);

  const handleCommand = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isTyping || isProcessing || editingFile) return;

    const currentCommand = command;
    const currentPrompt = prompt;
    
    if (currentCommand.toLowerCase() === 'clear') {
        setHistory([]);
        setCommand('');
        return;
    }
    
    const newHistoryItem: HistoryItem = { 
        id: history.length + 1,
        command: currentCommand, 
        output: <Skeleton className="h-4 w-32" />,
        prompt: `${currentPrompt} ` 
    };

    setHistory(prev => [...prev, newHistoryItem]);
    setCommand('');
    
    const result = await processCommand(currentCommand);
    
    let outputNode: React.ReactNode;

    if (result.type === 'component') {
      setIsTyping(true); // Assume component will handle its own typing/loading state
      outputNode = React.cloneElement(result.component as React.ReactElement<{ onFinished: () => void}>, { onFinished: () => setIsTyping(false) });
    } else if (result.type === 'text') {
      setIsTyping(true);
      outputNode = <Typewriter text={result.text} onFinished={() => setIsTyping(false)} />;
    } else { // 'none'
      outputNode = null;
    }
    
    const updatedHistoryItem = { ...newHistoryItem, output: outputNode };
    setHistory(prev => prev.map(h => h.id === updatedHistoryItem.id ? updatedHistoryItem : h));
  };
  
  const showInput = !isTyping && !isProcessing && !editingFile;

  if (editingFile && saveFile && exitEditor) {
    return (
      <NanoEditor
        filename={editingFile.path}
        initialContent={editingFile.content}
        onSave={async (newContent) => {
            const saveMessage = await saveFile(editingFile.path, newContent);
            const newHistoryItem: HistoryItem = { 
                id: history.length + 1,
                command: `^O (Save File)`,
                output: saveMessage,
                prompt: '' 
            };
            setHistory(prev => [...prev, newHistoryItem]);
        }}
        onExit={exitEditor}
      />
    );
  }

  return (
    <div className="h-full w-full p-2 md:p-4 font-code text-base md:text-lg text-primary overflow-y-auto" onClick={focusInput}>
      <div className="text-shadow-glow">
        {history.map((item) => (
          <div key={item.id}>
            {item.command || item.prompt ? (
              <div className="flex items-center">
                <span className="text-accent">{item.prompt}</span>
                <span>{item.command}</span>
              </div>
            ) : null}
            <div className="whitespace-pre-wrap">{item.output}</div>
          </div>
        ))}
      </div>

      {showInput && (
        <form onSubmit={handleCommand} className="flex items-center">
          <label htmlFor="command-input" className="flex-shrink-0 text-accent">{prompt}&nbsp;</label>
          <div className="flex-grow relative">
            <span className="text-shadow-glow">{command}</span>
            <BlinkingCursor />
            <input
              ref={inputRef}
              id="command-input"
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              className="absolute top-0 left-0 w-full h-full bg-transparent border-none outline-none text-transparent caret-transparent"
              aria-label="command input"
            />
          </div>
        </form>
      )}
      <div ref={endOfHistoryRef} />
    </div>
  );
}
