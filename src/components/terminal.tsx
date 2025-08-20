
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCommand } from '@/hooks/use-command';
import Typewriter from './typewriter';
import { User } from 'firebase/auth';

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
  const [isTyping, setIsTyping] = useState(true);
  
  const { 
      prompt, 
      processCommand, 
      getWelcomeMessage, 
  } = useCommand(user);

  const inputRef = useRef<HTMLInputElement>(null);
  const endOfHistoryRef = useRef<HTMLDivElement>(null);
  
  const focusInput = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 768) {
      inputRef.current?.focus();
    }
  }, []);

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
  }, [user, loadWelcomeMessage]);

  useEffect(() => {
    endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isTyping]);
  
  const handleCommandSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isTyping) return;

    if (command.trim().toLowerCase() === 'clear') {
        setCommand('');
        loadWelcomeMessage();
        return;
    }

    const currentPrompt = prompt;

    const newHistoryItem: HistoryItem = { 
      id: Date.now(),
      command, 
      output: '',
      prompt: currentPrompt 
    };

    setHistory(prev => [...prev, newHistoryItem]);
    setCommand('');
    setIsTyping(true);

    const result = await processCommand(command);

    setHistory(prev => prev.map(h => 
        h.id === newHistoryItem.id ? { ...h, output: result } : h
    ));
    
    setIsTyping(false);
  };
  
  const showInput = !isTyping;

  return (
    <div className="h-full w-full p-2 md:p-4 font-code text-base md:text-lg text-primary overflow-y-auto" onClick={focusInput}>
      
      <div className="text-shadow-glow">
        {history.map((item, index) => (
          <div key={item.id}>
            {index === 0 ? (
                 <Typewriter text={item.output as string} onFinished={() => setIsTyping(false)} />
            ) : (
             <>
              {item.command || item.prompt ? (
                <div className="flex items-center">
                  <span className="text-accent">{item.prompt}</span>
                  <span>{item.command}</span>
                </div>
              ) : null}
              {item.output && (
                  typeof item.output === 'string' 
                  ? <div className="whitespace-pre-wrap"><Typewriter text={item.output} onFinished={() => setIsTyping(false)} /></div>
                  : <div>{item.output}</div>
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
            <span className="text-shadow-glow">{command}</span>
            <BlinkingCursor />
          </div>
           <input
                ref={inputRef}
                id="command-input"
                type='text'
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                className="absolute top-0 left-0 w-full h-full bg-transparent border-none outline-none text-transparent caret-transparent"
                aria-label="command input"
                onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
                disabled={!showInput}
                autoFocus
            />
        </form>
      )}
      <div ref={endOfHistoryRef} />
    </div>
  );
}
