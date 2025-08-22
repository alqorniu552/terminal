
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCommand } from '@/hooks/use-command';
import Typewriter from './typewriter';
import NanoEditor from './nano-editor';
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
  const [editorState, setEditorState] = useState<{filename: string, content: string} | null>(null);

  const endOfHistoryRef = useRef<HTMLDivElement>(null);

  const loadWelcomeMessage = useCallback(() => {
    const welcomeHistory: HistoryItem = {
      id: 0,
      command: '',
      output: '', // Will be populated by getWelcomeMessage
      prompt: '',
    };
    setHistory([welcomeHistory]);
    setIsTyping(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { 
    prompt, 
    processCommand, 
    getWelcomeMessage, 
    isProcessing,
    resetCommandState,
    commandJustFinished,
    startProcessing,
  } = useCommand(user, { setEditorState, setIsTyping, loadWelcomeMessage });

  const inputRef = useRef<HTMLInputElement>(null);
  
  const focusInput = useCallback(() => {
    if (!editorState) {
        inputRef.current?.focus();
    }
  }, [editorState]);

  useEffect(() => {
    focusInput();
    const clickHandler = (e: MouseEvent) => {
        // Only focus if the click is not on a button or link inside the terminal output
        if (e.target instanceof HTMLElement) {
            if (e.target.closest('button') || e.target.closest('a')) {
                return;
            }
        }
        focusInput();
    };
    window.addEventListener('click', clickHandler);
    return () => window.removeEventListener('click', clickHandler);
  }, [focusInput]);
  
  useEffect(() => {
    setHistory(prev => {
        const welcomeMessage = getWelcomeMessage();
        if(prev.length > 0 && prev[0].id === 0) {
            return [{...prev[0], output: welcomeMessage}];
        }
        return [{ id: 0, command: '', output: welcomeMessage, prompt: '' }];
    });
    resetCommandState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!isTyping) {
        endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, isTyping]);
  
  const handleCommandSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isTyping || isProcessing || editorState) return;
    
    startProcessing();
    
    if (command.trim().toLowerCase() === 'clear') {
        setCommand('');
        loadWelcomeMessage();
        resetCommandState();
        return;
    }

    const currentPrompt = prompt;
    
    const newHistoryItem: HistoryItem = { 
      id: Date.now(),
      command: command, 
      output: '',
      prompt: currentPrompt 
    };

    setHistory(prev => [...prev, newHistoryItem]);
    const commandToProcess = command;
    setCommand('');
    
    // This is a critical state update. We must immediately signal that typing should start.
    setIsTyping(true);
    
    const result = await processCommand(commandToProcess);
    
    // Check if the result requires typing or is a static component
    const hasTypingOutput = (result && typeof result === 'string' && result.length > 0);
    const isStaticComponent = React.isValidElement(result);

    if (!hasTypingOutput && !isStaticComponent) {
       setIsTyping(false); // No output to type, so stop typing.
    }
    
    setHistory(prev => prev.map(h => 
        h.id === newHistoryItem.id ? { ...h, output: result } : h
    ));
  };
  
  const handleEditorSave = async (content: string) => {
    if (!editorState) return;
    
    startProcessing();
    setEditorState(null); // Exit editor UI first
    setIsTyping(true); // Show processing state

    const newHistoryItem: HistoryItem = { 
      id: Date.now(),
      command: `[save ${editorState.filename}]`, 
      output: '',
      prompt: ''
    };
    setHistory(prev => [...prev, newHistoryItem]);

    const result = await processCommand(`__save_buffer__ ${editorState.filename} ${btoa(content)}`);
    
    setHistory(prev => prev.map(h => 
        h.id === newHistoryItem.id ? { ...h, output: result } : h
    ));
    
    if (typeof result !== 'string' || result.length === 0) {
        setIsTyping(false);
    }
  };

  const handleEditorExit = () => {
    setEditorState(null);
    resetCommandState();
    setTimeout(focusInput, 10);
  };
  
  const showInput = !isTyping && !editorState && !commandJustFinished;

  return (
    <>
    {editorState && (
        <NanoEditor 
            filename={editorState.filename}
            initialContent={editorState.content}
            onSave={handleEditorSave}
            onExit={handleEditorExit}
        />
    )}
    <div className="h-full w-full p-2 md:p-4 font-code text-base md:text-lg text-primary overflow-y-scroll" onClick={focusInput}>
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
                  ? <div className="whitespace-pre-wrap"><Typewriter text={item.output} onFinished={() => {
                        setIsTyping(false);
                        resetCommandState();
                    }} /></div>
                  : (React.isValidElement(item.output)) ? <div onFocusCapture={ () => {
                        setIsTyping(false);
                        resetCommandState();
                    }}>{item.output}</div> : null
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
    </>
  );
}
