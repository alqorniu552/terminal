"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCommand } from '@/hooks/use-command';
import Typewriter from './typewriter';
import { User } from 'firebase/auth';
import { Progress } from "@/components/ui/progress"
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';


interface HistoryItem {
  id: number;
  command: string;
  output: React.ReactNode;
  prompt: string;
}

const BlinkingCursor = () => (
  <span className="w-2.5 h-5 bg-accent inline-block animate-blink ml-1" />
);

const installationFeatures = [
    "Initializing hardware...",
    "Partitioning disk...",
    "Formatting filesystem...",
    "Copying OS files...",
    "Installing kernel...",
    "Configuring network settings...",
    "Installing graphics drivers...",
    "Setting up package manager...",
    "Installing core utilities...",
    "Configuring user environment...",
    "Finalizing installation...",
];


const OSInstaller = ({ os, onFinished }: { os: string, onFinished: () => void }) => {
    const [progress, setProgress] = useState(0);
    const [currentFeature, setCurrentFeature] = useState(installationFeatures[0]);
    
    useEffect(() => {
        const totalDuration = 120000; // 2 minutes in ms
        const intervalTime = totalDuration / 100; // time per percentage point

        const progressInterval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(progressInterval);
                    onFinished();
                    return 100;
                }
                return prev + 1;
            });
        }, intervalTime);

        return () => clearInterval(progressInterval);
    }, [onFinished]);

    useEffect(() => {
        const featureChangeInterval = 120000 / installationFeatures.length;
        let featureIndex = 0;
        const featureInterval = setInterval(() => {
            featureIndex++;
            if (featureIndex < installationFeatures.length) {
                setCurrentFeature(installationFeatures[featureIndex]);
            } else {
                clearInterval(featureInterval);
            }
        }, featureChangeInterval);

        return () => clearInterval(featureInterval);
    }, []);


    return (
        <div className='p-2'>
            <p>Installing {os}...</p>
            <div className="flex items-center gap-2">
              <Progress value={progress} className="w-[60%]" />
              <p>{progress}%</p>
            </div>
            <div className='pt-2'>
                <p>{currentFeature}</p>
            </div>
            {progress === 100 && <p className='pt-2'>Installation complete! You can now use the terminal.</p>}
        </div>
    )
}

export default function Terminal({ user }: { user: User | null | undefined }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [command, setCommand] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const { 
    prompt, 
    processCommand, 
    getWelcomeMessage,
    authStep,
    resetAuth,
    osSelectionStep,
    setOsSelectionStep
  } = useCommand(user);

  const inputRef = useRef<HTMLInputElement>(null);
  const endOfHistoryRef = useRef<HTMLDivElement>(null);
  
  const focusInput = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 768 && !isTyping) {
      inputRef.current?.focus();
    }
  }, [isTyping]);

  useEffect(() => {
    focusInput();
  }, [focusInput]);
  
  useEffect(() => {
    if (osSelectionStep === 'none' && !user) {
        setHistory([]);
    }

    if (osSelectionStep !== 'installing') {
        const loadWelcomeMessage = () => {
            setIsTyping(true);
            const output = getWelcomeMessage();
            const welcomeHistory: HistoryItem = {
                id: 0,
                command: '',
                output: <Typewriter text={output as string} onFinished={() => setIsTyping(false)} />,
                prompt: '',
            };
            setHistory([welcomeHistory]);
            if (!user) {
                resetAuth();
            }
        };
        loadWelcomeMessage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, osSelectionStep]);


  useEffect(() => {
    endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isTyping]);

  const handleCommand = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isTyping || osSelectionStep === 'installing') return;

    const currentCommand = command;
    const currentPrompt = prompt;

    let newHistoryItem: HistoryItem = { 
        id: history.length + 1,
        command: authStep.includes('password') ? '********' : currentCommand, 
        output: '', 
        prompt: `${currentPrompt} ` 
    };

    if (currentCommand.toLowerCase() === 'clear') {
        setHistory([]);
        setCommand('');
        setIsTyping(false);
        if(!user) {
            resetAuth();
             const output = getWelcomeMessage();
             const welcomeHistory: HistoryItem = {
                 id: 0,
                 command: '',
                 output: <Typewriter text={output as string} onFinished={() => setIsTyping(false)} />,
                 prompt: '',
             };
             setHistory([welcomeHistory]);
        } else if (osSelectionStep === 'done' || osSelectionStep === 'prompt') {
            const output = getWelcomeMessage();
            const welcomeHistory: HistoryItem = {
                id: 0,
                command: '',
                output: <Typewriter text={output as string} onFinished={() => setIsTyping(false)} />,
                prompt: '',
            };
            setHistory([welcomeHistory]);
        }
        return;
    }

    setHistory(prev => [...prev, newHistoryItem]);
    setCommand('');
    
    const result = await processCommand(currentCommand);
    
    let output;

    if (typeof result === 'object' && result.type === 'install') {
        setIsTyping(true);
        output = <OSInstaller os={result.os} onFinished={async () => {
            if (user) {
                await updateDoc(doc(db, 'users', user.uid), { osInstalled: true });
            }
            setIsTyping(false);
            setOsSelectionStep('done');
        }} />;
    } else {
        setIsTyping(true);
        output = <Typewriter text={result as string} onFinished={() => setIsTyping(false)} />;
    }
    
    const updatedHistoryItem = { ...newHistoryItem, output };

    setHistory(prev => prev.map(h => h.id === updatedHistoryItem.id ? updatedHistoryItem : h));
  };
  
  const isPasswordInput = authStep.includes('password');
  const showInput = !isTyping && osSelectionStep !== 'installing';


  return (
    <div className="h-screen w-full p-2 md:p-4 font-code text-base md:text-lg text-primary overflow-y-auto" onClick={focusInput}>
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
            <span className="text-shadow-glow">{isPasswordInput ? '*'.repeat(command.length) : command}</span>
            <BlinkingCursor />
            <input
              ref={inputRef}
              id="command-input"
              type={isPasswordInput ? 'password' : 'text'}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              className="absolute top-0 left-0 w-full h-full bg-transparent border-none outline-none text-transparent caret-transparent"
              aria-label="command input"
              disabled={isTyping}
            />
          </div>
        </form>
      )}
      <div ref={endOfHistoryRef} />
    </div>
  );
}
