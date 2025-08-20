
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCommand, EditingFile, WarlockMessage, AuthCommand, AuthStep } from '@/hooks/use-command';
import Typewriter from './typewriter';
import NanoEditor from './nano-editor';
import { User } from 'firebase/auth';
import { Button } from './ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';

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
  const isMobile = useIsMobile();
  
  // Auth state
  const [authCommand, setAuthCommand] = useState<AuthCommand>(null);
  const [authStep, setAuthStep] = useState<AuthStep>('idle');
  const authCredentials = useRef({ email: '', pass: '' });

  // Awaiting confirmation state
  const [confirmation, setConfirmation] = useState<{
      message: string;
      onConfirm: () => Promise<void>;
      onDeny: () => void;
  } | null>(null);

  const setAwaitingConfirmation = (message: string, onConfirm: () => Promise<void>, onDeny: () => void) => {
      setConfirmation({ message, onConfirm, onDeny });
  };
  
  const { 
      prompt, 
      getPrompt,
      processCommand, 
      getWelcomeMessage, 
      isProcessing, 
      editingFile, 
      saveFile, 
      exitEditor,
      warlockMessages,
      clearWarlockMessages
  } = useCommand(user, isMobile, setAwaitingConfirmation, authCommand, setAuthCommand, authStep, setAuthStep, authCredentials);

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
  }, [user, loadWelcomeMessage]);

  useEffect(() => {
    endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isTyping]);
  
  useEffect(() => {
    if(warlockMessages.length > 0) {
      const message = warlockMessages[0];
       setHistory(prev => [...prev, {
         id: message.id,
         command: '',
         prompt: '',
         output: <div className="text-red-500 font-bold animate-pulse">{message.text}</div>
       }]);
       clearWarlockMessages();
    }
  }, [warlockMessages, clearWarlockMessages])

  const handleCommandSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isTyping || isProcessing) return;

    if (command.trim().toLowerCase() === 'clear') {
        setCommand('');
        loadWelcomeMessage();
        return;
    }

    const currentPrompt = getPrompt();

    // Special handling for auth commands
    if (!user && (command.toLowerCase() === 'login' || command.toLowerCase() === 'register')) {
        setAuthCommand(command.toLowerCase() as AuthCommand);
        setAuthStep('email');
        setHistory(prev => [...prev, { id: Date.now(), command, output: '', prompt: currentPrompt }]);
        setCommand('');
        return;
    }

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

    if (result.type !== 'none') {
        const output = result.type === 'text' ? result.text : result.component;
        setHistory(prev => prev.map(h => 
            h.id === newHistoryItem.id ? { ...h, output } : h
        ));
    } else {
        setHistory(prev => prev.filter(h => h.id !== newHistoryItem.id));
    }
    
    setIsTyping(false);
  };
  
  const showInput = !isTyping && !editingFile && !confirmation;

  const handleConfirmation = async (confirmed: boolean) => {
      if (confirmation) {
          if (confirmed) {
              await confirmation.onConfirm();
              setHistory(prev => [...prev, { id: Date.now(), command: '', output: 'Plan executed.', prompt: ''}]);
          } else {
              confirmation.onDeny();
               setHistory(prev => [...prev, { id: Date.now(), command: '', output: 'Plan aborted.', prompt: ''}]);
          }
      }
      setConfirmation(null);
  };

  return (
    <div className="h-full w-full p-2 md:p-4 font-code text-base md:text-lg text-primary overflow-y-auto" onClick={focusInput}>
      {editingFile && (
          <NanoEditor
              filename={editingFile.path}
              initialContent={editingFile.content}
              onSave={async (content) => {
                  const result = await saveFile(editingFile.path, content);
                  exitEditor();
                  setHistory(prev => [...prev, {id: Date.now(), command: '', prompt: '', output: result}]);
              }}
              onExit={exitEditor}
          />
      )}
      <AlertDialog open={!!confirmation}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Action</AlertDialogTitle>
                  <AlertDialogDescription>
                      <pre className="whitespace-pre-wrap">{confirmation?.message}</pre>
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => handleConfirmation(false)}>Deny</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleConfirmation(true)}>Confirm</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <div className="text-shadow-glow">
        {history.map((item, index) => (
          <div key={item.id}>
            {index === 0 && !user ? (
                 <Typewriter text={item.output as string} onFinished={() => setIsTyping(false)} />
            ) : (
             <>
              {item.command || item.prompt ? (
                <div className="flex items-center">
                  <span className="text-accent" dangerouslySetInnerHTML={{ __html: item.prompt.replace(/\n/g, '<br/>') }} />
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
          <label htmlFor="command-input" className="flex-shrink-0 text-accent" dangerouslySetInnerHTML={{ __html: prompt.replace(/\n/g, '<br/>') }}/>
          <div className="flex-grow relative">
            <span className="text-shadow-glow">{command}</span>
            <BlinkingCursor />
          </div>
           <input
                ref={inputRef}
                id="command-input"
                type={authStep === 'password' ? 'password' : 'text'}
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
