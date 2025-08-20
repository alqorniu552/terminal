"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCommand, handleLogin, handleRegister } from '@/hooks/use-command';
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

type AuthStep = 'none' | 'email' | 'password';
type AuthCommand = 'login' | 'register' | null;

const BlinkingCursor = () => (
  <span className="w-2.5 h-5 bg-accent inline-block animate-blink ml-1" />
);

export default function Terminal({ user }: { user: User | null | undefined }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [command, setCommand] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  // State for multi-step authentication
  const [authStep, setAuthStep] = useState<AuthStep>('none');
  const [authCommand, setAuthCommand] = useState<AuthCommand>(null);
  const [authData, setAuthData] = useState({ email: '', password: '' });
  const [currentPrompt, setCurrentPrompt] = useState('');

  const { 
    prompt: commandPrompt, 
    processCommand, 
    getWelcomeMessage,
    editingFile,
    saveFile,
    exitEditor,
    isProcessing,
  } = useCommand(user);

  const inputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const endOfHistoryRef = useRef<HTMLDivElement>(null);
  
  const focusInput = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 768 && !editingFile) {
        if (authStep === 'password') {
            passwordInputRef.current?.focus();
        } else {
            inputRef.current?.focus();
        }
    }
  }, [editingFile, authStep]);

  useEffect(() => {
    focusInput();
    const clickHandler = () => focusInput();
    window.addEventListener('click', clickHandler);
    return () => window.removeEventListener('click', clickHandler);
  }, [focusInput]);

  const loadWelcomeMessage = useCallback(() => {
    setHistory([]);
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
  
  useEffect(() => {
    loadWelcomeMessage();
  }, [user, loadWelcomeMessage]);

  useEffect(() => {
    endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isTyping, isProcessing]);
  
  useEffect(() => {
      if (authStep === 'email') {
          setCurrentPrompt('email: ');
      } else if (authStep === 'password') {
          setCurrentPrompt('password: ');
      } else {
          setCurrentPrompt(commandPrompt);
      }
  }, [authStep, commandPrompt]);

  const addHistory = (item: Omit<HistoryItem, 'id'>) => {
    setHistory(prev => [...prev, { ...item, id: prev.length + 1 }]);
  };

  const handleCommandSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isTyping || isProcessing || editingFile) return;

    const currentInput = command;
    setCommand('');
    
    // --- Multi-step Auth Flow ---
    if (authStep !== 'none') {
        let newAuthData = { ...authData };
        if (authStep === 'email') {
            addHistory({ command: currentInput, output: '', prompt: currentPrompt });
            newAuthData.email = currentInput;
            setAuthData(newAuthData);
            setAuthStep('password');
        } else if (authStep === 'password') {
            addHistory({ command: '********', output: '', prompt: currentPrompt });
            newAuthData.password = currentInput;
            
            setIsTyping(true);
            const authFn = authCommand === 'login' ? handleLogin : handleRegister;
            const result = await authFn(newAuthData.email, newAuthData.password);
            
            addHistory({
                command: '',
                output: <Typewriter text={result} onFinished={() => setIsTyping(false)} />,
                prompt: ''
            });

            // Reset auth flow
            setAuthStep('none');
            setAuthCommand(null);
            setAuthData({ email: '', password: '' });
        }
        return;
    }

    // --- Regular Command Flow ---
    const lowerCaseCommand = currentInput.toLowerCase();

    if (lowerCaseCommand === 'login' || lowerCaseCommand === 'register') {
        addHistory({ command: currentInput, output: '', prompt: `${commandPrompt} ` });
        setAuthCommand(lowerCaseCommand);
        setAuthStep('email');
        return;
    }

    if (lowerCaseCommand === 'clear') {
        setHistory([]);
        return;
    }
    
    const newHistoryItem: HistoryItem = { 
        id: history.length + 1,
        command: currentInput, 
        output: <Skeleton className="h-4 w-32" />,
        prompt: `${commandPrompt} ` 
    };
    setHistory(prev => [...prev, newHistoryItem]);
    
    const result = await processCommand(currentInput);
    
    let outputNode: React.ReactNode;

    if (result.type === 'component') {
      setIsTyping(true);
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
            addHistory({
                command: `^O (Save File)`,
                output: <Typewriter text={saveMessage} onFinished={() => {}}/>,
                prompt: '' 
            });
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
        <form onSubmit={handleCommandSubmit} className="flex items-center">
          <label htmlFor="command-input" className="flex-shrink-0 text-accent">{currentPrompt}</label>
          <div className="flex-grow relative">
            {authStep === 'password' ? (
                 <input
                    ref={passwordInputRef}
                    id="password-input"
                    type="password"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    autoComplete="new-password"
                    className="absolute top-0 left-0 w-full h-full bg-transparent border-none outline-none text-shadow-glow"
                    aria-label="password input"
                />
            ) : (
                <>
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
                </>
            )}
          </div>
        </form>
      )}
      <div ref={endOfHistoryRef} />
    </div>
  );
}
