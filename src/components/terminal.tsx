"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCommand, EditingFile, WarlockMessage, AuthStep, AuthCommand } from '@/hooks/use-command';
import Typewriter from './typewriter';
import { User } from 'firebase/auth';
import NanoEditor from './nano-editor';
import { Skeleton } from './ui/skeleton';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { initialFilesystem } from '@/lib/filesystem';

interface HistoryItem {
  id: number;
  command: string;
  output: React.ReactNode;
  prompt: string;
}

const BlinkingCursor = () => (
  <span className="w-2.5 h-5 bg-accent inline-block animate-blink ml-1" />
);

type TerminalState = 'idle' | 'awaiting_confirmation';

export default function Terminal({ user }: { user: User | null | undefined }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [command, setCommand] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  const [authStep, setAuthStep] = useState<AuthStep>('idle');
  const [authCommand, setAuthCommand] = useState<AuthCommand>(null);
  const [authData, setAuthData] = useState<{ email?: string; password?: string }>({});

  const [terminalState, setTerminalState] = useState<TerminalState>('idle');
  const [confirmationCallback, setConfirmationCallback] = useState<{ onConfirm: () => void, onDeny: () => void} | null>(null);
  
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const setAwaitingConfirmation: any = (message: string, onConfirm: () => void, onDeny: () => void) => {
      const newHistoryItem: HistoryItem = { 
          id: Date.now(),
          command: '', 
          output: (
              <div>
                  <div>{message}</div>
                  <div>Proceed? (y/n)</div>
              </div>
          ),
          prompt: ''
      };
      setHistory(prev => [...prev, newHistoryItem]);
      setTerminalState('awaiting_confirmation');
      setConfirmationCallback({ onConfirm, onDeny });
  }

  const { 
    prompt,
    processCommand, 
    getWelcomeMessage,
    editingFile,
    saveFile,
    exitEditor,
    isProcessing,
    warlockMessages,
    clearWarlockMessages,
  } = useCommand(user, isMobile, setAwaitingConfirmation);

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
    resetAuthFlow();
  }, [user, loadWelcomeMessage]);
  
  useEffect(() => {
    if (warlockMessages.length > 0) {
      const messagesAsHistory: HistoryItem[] = warlockMessages.map(msg => ({
        id: msg.id,
        command: '',
        prompt: `> [WARLOCK]:`,
        output: <Typewriter text={msg.text} speed={25} onFinished={() => {}} />
      }));
      setHistory(prev => [...prev, ...messagesAsHistory]);
      clearWarlockMessages();
    }
  }, [warlockMessages, clearWarlockMessages]);

  useEffect(() => {
    endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isTyping, isProcessing]);
  
  const resetAuthFlow = () => {
    setAuthStep('idle');
    setAuthCommand(null);
    setAuthData({});
    setCommand('');
  };
  
  const handleAuthSubmit = async (finalAuthData: { email?: string; password?: string }) => {
      const { email, password } = finalAuthData;
      if (!email || !password || !authCommand) return;
      
      const newHistoryItem: HistoryItem = { 
          id: Date.now(),
          command: '', 
          output: <Skeleton className="h-4 w-32" />,
          prompt: ''
      };
      setHistory(prev => [...prev, newHistoryItem]);
      setIsTyping(true);

      let resultText = '';
      try {
          if (authCommand === 'register') {
              const userCredential = await createUserWithEmailAndPassword(auth, email, password);
              const userDocRef = doc(db, "users", userCredential.user.uid);
              await setDoc(userDocRef, {
                  email: userCredential.user.email,
                  filesystem: initialFilesystem
              });
          } else {
              await signInWithEmailAndPassword(auth, email, password);
          }
           resultText = `${authCommand === 'login' ? 'Login' : 'Registration'} successful. Welcome!`;
      } catch (error: any) {
          resultText = `Authentication Error: ${error.code || error.message}`;
      }
      
      const updatedHistoryItem = { ...newHistoryItem, output: <Typewriter text={resultText} onFinished={() => setIsTyping(false)}/> };
      setHistory(prev => prev.map(h => h.id === updatedHistoryItem.id ? updatedHistoryItem : h));
      
      resetAuthFlow();
  };

  const handleCommandSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isTyping || isProcessing || editingFile) return;

    const currentInput = command.trim();
    setCommand('');

    // --- Confirmation Flow ---
    if (terminalState === 'awaiting_confirmation' && confirmationCallback) {
        setHistory(prev => [...prev, { id: Date.now(), command: currentInput, output: null, prompt: 'y/n> ' }]);
        if (currentInput.toLowerCase() === 'y') {
            confirmationCallback.onConfirm();
        } else {
            confirmationCallback.onDeny();
        }
        setTerminalState('idle');
        setConfirmationCallback(null);
        return;
    }

    // --- Multi-step Auth Flow ---
    if (authStep !== 'idle') {
        const newHistoryPrompt = authStep === 'email' ? 'email: ' : 'password: ';
        const displayInput = authStep === 'password' ? '********' : currentInput;
        setHistory(prev => [...prev, { id: Date.now(), command: displayInput, output: null, prompt: newHistoryPrompt }]);

        if (authStep === 'email') {
            setAuthData({ email: currentInput });
            setAuthStep('password');
        } else if (authStep === 'password') {
            const finalAuthData = { ...authData, password: currentInput };
            await handleAuthSubmit(finalAuthData);
        }
        return;
    }

    // --- Standard Command Processing ---
    if (currentInput.toLowerCase() === 'clear') {
        loadWelcomeMessage();
        return;
    }

    // Intercept login/register to start the flow
    const [cmd] = currentInput.toLowerCase().split(/\s+/);
    if (!user && (cmd === 'login' || cmd === 'register')) {
        setHistory(prev => [...prev, { id: Date.now(), command: currentInput, output: null, prompt: prompt }]);
        setAuthCommand(cmd as 'login' | 'register');
        setAuthStep('email');
        return;
    }
    
    const newHistoryItem: HistoryItem = { 
        id: Date.now(),
        command: currentInput, 
        output: null,
        prompt: prompt 
    };

    setHistory(prev => [...prev, { ...newHistoryItem, output: <Skeleton className="h-4 w-32" /> }]);
    
    const result = await processCommand(currentInput);
    
    let outputNode: React.ReactNode;

    if (result.type === 'component') {
      setIsTyping(true);
      outputNode = React.cloneElement(result.component as React.ReactElement<{ onFinished: () => void, key: number}>, { onFinished: () => setIsTyping(false), key: Date.now() });
    } else if (result.type === 'text') {
      setIsTyping(true);
      outputNode = <Typewriter text={result.text} onFinished={() => setIsTyping(false)} />;
    } else { // 'none'
      outputNode = null;
      setIsTyping(false); 
    }
    
    const updatedHistoryItem = { ...newHistoryItem, output: outputNode };
    setHistory(prev => prev.map(h => h.id === updatedHistoryItem.id ? updatedHistoryItem : h));
  };
  
  const showInput = !isTyping && !isProcessing && !editingFile && authStep === 'idle' && terminalState === 'idle';

  if (editingFile && saveFile && exitEditor) {
    return (
      <NanoEditor
        filename={editingFile.path}
        initialContent={editingFile.content}
        onSave={async (newContent) => {
            const saveMessage = await saveFile(editingFile.path, newContent);
            setHistory(prev => [...prev, {
                id: Date.now(),
                command: `^O (Save File)`,
                output: <Typewriter text={saveMessage} onFinished={() => {}}/>,
                prompt: '' 
            }]);
        }}
        onExit={exitEditor}
      />
    );
  }

  return (
    <div className="h-full w-full p-2 md:p-4 font-code text-base md:text-lg text-primary overflow-y-auto" onClick={focusInput}>
      <div className="text-shadow-glow">
        {history.map((item) => (
          item && (
            <div key={item.id}>
              {item.command || item.prompt ? (
                <div className="flex items-center">
                  <span className="text-accent">{item.prompt}</span>
                  <span>{item.command}</span>
                </div>
              ) : null}
              {item.output && <div className="whitespace-pre-wrap">{item.output}</div>}
            </div>
          )
        ))}
      </div>

      {isProcessing && authStep === 'idle' && terminalState === 'idle' && (
         <div className="flex items-center">
            <span className="text-accent">{prompt}</span>
            <span>{command}</span>
         </div>
      )}

      {authStep === 'email' && (
        <form onSubmit={handleCommandSubmit} className="flex items-center">
            <label htmlFor="command-input" className="flex-shrink-0 text-accent">email: </label>
            <div className="flex-grow relative">
                <span className="text-shadow-glow">{command}</span>
                <BlinkingCursor />
            </div>
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
                aria-label="email input"
                onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
                autoFocus
            />
        </form>
      )}
      
      {authStep === 'password' && (
        <form onSubmit={handleCommandSubmit} className="flex items-center">
            <label htmlFor="password-input" className="flex-shrink-0 text-accent">password: </label>
             <div className="flex-grow relative">
                <span className="text-shadow-glow">{'*'.repeat(command.length)}</span>
                <BlinkingCursor />
            </div>
             <input
                ref={passwordInputRef}
                id="password-input"
                type="password"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                autoComplete="new-password"
                className="absolute top-0 left-0 w-full h-full bg-transparent border-none outline-none text-transparent caret-transparent"
                aria-label="password input"
                onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
                autoFocus
            />
        </form>
      )}

      {terminalState === 'awaiting_confirmation' && !isTyping && (
          <form onSubmit={handleCommandSubmit} className="flex items-center">
            <label htmlFor="command-input-confirm" className="flex-shrink-0 text-accent">y/n&gt; </label>
            <div className="flex-grow relative">
              <span className="text-shadow-glow">{command}</span>
              <BlinkingCursor />
            </div>
            <input
                  ref={inputRef}
                  id="command-input-confirm"
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  autoComplete="off"
                  className="absolute top-0 left-0 w-full h-full bg-transparent border-none outline-none text-transparent caret-transparent"
                  aria-label="confirmation input"
                  autoFocus
              />
          </form>
      )}

      {showInput && (
        <form onSubmit={handleCommandSubmit} className="flex items-center">
          <label htmlFor="command-input-main" className="flex-shrink-0 text-accent">{prompt}</label>
          <div className="flex-grow relative">
            <span className="text-shadow-glow">{command}</span>
            <BlinkingCursor />
          </div>
           <input
                ref={inputRef}
                id="command-input-main"
                type="text"
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
