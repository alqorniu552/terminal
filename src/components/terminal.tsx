
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCommand } from '@/hooks/use-command';
import Typewriter from './typewriter';
import { User } from 'firebase/auth';
import NanoEditor from './nano-editor';

interface HistoryItem {
  id: number;
  command: string;
  output: string | React.ReactNode;
  prompt: string;
}

const BlinkingCursor = () => (
  <span className="w-2.5 h-5 bg-accent inline-block animate-blink ml-1" />
);

export default function Terminal({ user }: { user: User | null | undefined }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [command, setCommand] = useState('');
  
  const { 
      prompt, 
      processCommand, 
      getWelcomeMessage,
      authStep,
      isProcessing,
      editingFile,
      saveFile,
      exitEditor,
  } = useCommand(user);

  const [isTyping, setIsTyping] = useState(true);

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
    setHistory([]);
    setIsTyping(true);
    const welcomeHistory: HistoryItem = {
      id: 0,
      command: '',
      output: getWelcomeMessage(),
      prompt: '',
    };
    setHistory([welcomeHistory]);
  }, [getWelcomeMessage]);
  
  useEffect(() => {
    loadWelcomeMessage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!isTyping) {
        endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, isTyping]);
  
  const handleCommandSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isTyping || isProcessing || editingFile) return;

    if (command.trim().toLowerCase() === 'clear') {
        setCommand('');
        loadWelcomeMessage();
        return;
    }

    const currentPrompt = prompt;
    const commandForHistory = authStep === 'password' || authStep === 'ssh_password' ? '******' : command;

    const newHistoryItem: HistoryItem = { 
      id: Date.now(),
      command: commandForHistory, 
      output: '',
      prompt: currentPrompt 
    };

    setHistory(prev => [...prev, newHistoryItem]);
    setCommand('');
    
    // Only set typing if we expect text output
    const result = await processCommand(command);
    
    if (result === null) { // This handles nano or logout
        setHistory(prev => prev.filter(h => h.id !== newHistoryItem.id)); // Remove the command from history for clean UI
        return;
    }
    
    // For commands with output, start typing
    if (typeof result === 'string' && result.length > 0) {
        setIsTyping(true);
    } else if (React.isValidElement(result)) {
        setIsTyping(false); // Components handle their own loading state
    } else {
        setIsTyping(false); // No output, no typing
    }
    
    setHistory(prev => prev.map(h => 
        h.id === newHistoryItem.id ? { ...h, output: result } : h
    ));
  };
  
  const showInput = !isTyping && !isProcessing && !editingFile;
  const isPasswordStep = authStep === 'password' || authStep === 'ssh_password';

  return (
    <div className="h-full w-full p-2 md:p-4 font-code text-base md:text-lg text-primary overflow-y-auto" onClick={focusInput}>
      
      {editingFile && (
         <NanoEditor
            filename={editingFile.path}
            initialContent={editingFile.content}
            onSave={(content) => {
                saveFile(content);
                exitEditor();
            }}
            onExit={exitEditor}
        />
      )}

      <div className="text-shadow-glow">
        {history.map((item, index) => (
          <div key={item.id}>
            {index === 0 && typeof item.output === 'string' ? (
                 <Typewriter text={item.output} onFinished={() => setIsTyping(false)} />
            ) : (
             <>
              {item.prompt && (
                <div className="flex items-center">
                  <span className="text-accent">{item.prompt}</span>
                  <span className="whitespace-pre-wrap">{item.command}</span>
                </div>
              )}
              {item.output && (
                  typeof item.output === 'string' && item.output.length > 0
                  ? <div className="whitespace-pre-wrap"><Typewriter text={item.output} onFinished={() => setIsTyping(false)} /></div>
                  : (React.isValidElement(item.output)) ? <div>{item.output}</div> : null
              )}
             </>
            )}
          </div>
        ))}
      </div>
      
      {showInput && (
        <form onSubmit={handleCommandSubmit} className="flex items-center">
          <label htmlFor="command-input" className="flex-shrink-0 text-accent">{prompt}</label>
          <div className="flex-grow relative">
            <span className="text-shadow-glow">{isPasswordStep ? '' : command}</span>
            <BlinkingCursor />
          </div>
           <input
                ref={inputRef}
                id="command-input"
                type={isPasswordStep ? 'password' : 'text'}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                className="absolute top-0 left-0 w-full h-full bg-transparent border-none outline-none text-transparent caret-transparent"
                aria-label="command input"
                onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
                disabled={!showInput}
                autoFocus={typeof window !== 'undefined' && window.innerWidth > 768}
            />
        </form>
      )}
      <div ref={endOfHistoryRef} />
    </div>
  );
}
