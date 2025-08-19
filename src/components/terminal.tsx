"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCommand } from '@/hooks/use-command';
import Typewriter from './typewriter';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface HistoryItem {
  id: number;
  command: string;
  output: React.ReactNode;
  prompt: string;
}

const BlinkingCursor = () => (
  <span className="w-2.5 h-5 bg-accent inline-block animate-blink ml-1" />
);

export default function Terminal() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [command, setCommand] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const { prompt, setPrompt, processCommand } = useCommand();
  const inputRef = useRef<HTMLInputElement>(null);
  const endOfHistoryRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const focusInput = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 768) {
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    focusInput();
  }, [focusInput]);
  
  useEffect(() => {
    const loadWelcomeMessage = async () => {
      const output = await processCommand('cat welcome.txt');
      const welcomeHistory: HistoryItem = {
        id: 0,
        command: '',
        output: <Typewriter text={output as string} onFinished={() => setIsTyping(false)} />,
        prompt: '',
      };
      setHistory([welcomeHistory]);
    };
    if (auth.currentUser) {
      loadWelcomeMessage();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isTyping]);

  const handleCommand = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isTyping) return;

    const currentCommand = command;
    let newHistoryItem: HistoryItem = { 
        id: history.length, 
        command: currentCommand, 
        output: '', 
        prompt: `${prompt} ` 
    };
    
    setHistory(prev => [...prev, newHistoryItem]);
    setCommand('');
    setIsTyping(true);

    if (currentCommand.trim().toLowerCase() === 'clear') {
      setHistory([]);
      setIsTyping(false);
      return;
    }
    
    if (currentCommand.trim().toLowerCase() === 'logout') {
      await auth.signOut();
      router.push('/');
      setIsTyping(false);
      return;
    }

    if (currentCommand.trim().toLowerCase().startsWith('prompt ')) {
      const newPrompt = currentCommand.trim().substring(7);
      if (newPrompt) {
        setPrompt(newPrompt);
        newHistoryItem.output = <Typewriter text={`Prompt set to: ${newPrompt}`} onFinished={() => setIsTyping(false)} />;
      } else {
        newHistoryItem.output = <Typewriter text="Usage: prompt [new_prompt_value]" onFinished={() => setIsTyping(false)} />;
      }
    } else {
        const output = await processCommand(currentCommand);
        newHistoryItem.output = <Typewriter text={output as string} onFinished={() => setIsTyping(false)} />;
    }

    setHistory(prev => prev.map(h => h.id === newHistoryItem.id ? newHistoryItem : h));
  };

  return (
    <div className="h-screen w-full p-2 md:p-4 font-code text-base md:text-lg text-primary overflow-y-auto" onClick={focusInput}>
      <div className="text-shadow-glow">
        {history.map((item) => (
          <div key={item.id}>
            {item.prompt && (
              <div className="flex items-center">
                <span className="text-accent">{item.prompt}</span>
                <span>{item.command}</span>
              </div>
            )}
            <div className="whitespace-pre-wrap">{item.output}</div>
          </div>
        ))}
      </div>

      {!isTyping && (
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
