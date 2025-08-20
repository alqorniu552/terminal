"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCommand } from '@/hooks/use-command';
import Typewriter from './typewriter';
import { User } from 'firebase/auth';
import { Progress } from "@/components/ui/progress"
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import NanoEditor from './nano-editor';
import ImageDisplay from './image-display';


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
    "Probing hardware devices...",
    "Loading kernel modules (ext4, vfat, ntfs)...",
    "Setting up disk partitions on /dev/vda...",
    "Formatting /dev/vda1 as ext4...",
    "Mounting filesystems on /...",
    "Unpacking base system image (0%)...",
    "Unpacking base system image (25%)...",
    "Unpacking base system image (50%)...",
    "Unpacking base system image (75%)...",
    "Unpacking base system image (100%)...",
    "Installing kernel: linux-image-generic...",
    "Configuring APT package manager...",
    "Fetching package lists from repositories...",
    "Installing core utilities (coreutils, findutils, grep)...",
    "Setting up networking with netplan...",
    "Configuring system clock (chrony)...",
    "Creating user account and group...",
    "Setting up user environment and home directory...",
    "Installing desktop environment dependencies (GNOME)...",
    "Configuring display manager (GDM3)...",
    "Running post-installation triggers (man-db, desktop-file-utils)...",
    "Cleaning up temporary files...",
    "Finalizing installation...",
    "System will be ready after this step...",
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
    setOsSelectionStep,
    editingFile,
    saveFile,
    exitEditor,
  } = useCommand(user);

  const inputRef = useRef<HTMLInputElement>(null);
  const endOfHistoryRef = useRef<HTMLDivElement>(null);
  
  const focusInput = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 768 && !isTyping && !editingFile) {
      inputRef.current?.focus();
    }
  }, [isTyping, editingFile]);

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  const loadWelcomeMessage = useCallback(() => {
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
    setHistory(h => (h.length === 0 ? [welcomeHistory] : h));
    setIsTyping(true);
  }, [getWelcomeMessage]);

  useEffect(() => {
      loadWelcomeMessage();
  }, [loadWelcomeMessage]);
  
  useEffect(() => {
    if (!user) {
        setHistory([]);
        if (resetAuth) resetAuth();
    }
  }, [user, resetAuth]);

  useEffect(() => {
    endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isTyping]);

  const handleCommand = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isTyping || (osSelectionStep && osSelectionStep === 'installing') || editingFile) return;

    const currentCommand = command;
    const currentPrompt = prompt;
    
    if (currentCommand.toLowerCase() === 'clear') {
        setHistory([]);
        setCommand('');
        return;
    }
    
    let newHistoryItem: HistoryItem = { 
        id: history.length + 1,
        command: authStep && authStep.includes('password') ? '********' : currentCommand, 
        output: '', 
        prompt: `${currentPrompt} ` 
    };

    setHistory(prev => [...prev, newHistoryItem]);
    setCommand('');
    
    setIsTyping(true);
    const result = await processCommand(currentCommand);
    
    let output;
    let onFinishedCallback = () => setIsTyping(false);

    if (result && typeof result === 'object') {
        if ('type' in result && result.type === 'install' && setOsSelectionStep) {
             output = <OSInstaller os={result.os} onFinished={async () => {
                if (user) {
                    await updateDoc(doc(db, 'users', user.uid), { osInstalled: true });
                }
                setOsSelectionStep('done');
                setIsTyping(false);
            }} />;
        } else if ('component' in result && React.isValidElement(result.component)) {
             output = React.cloneElement(result.component as React.ReactElement<{ onFinished: () => void}>, { onFinished: onFinishedCallback });
        } else {
             output = <Typewriter text={JSON.stringify(result, null, 2)} onFinished={onFinishedCallback} />;
        }
    } else if (typeof result === 'string') {
        output = <Typewriter text={result} onFinished={onFinishedCallback} />;
    } else {
        setIsTyping(false);
    }
    
    const updatedHistoryItem = { ...newHistoryItem, output };

    setHistory(prev => prev.map(h => h.id === updatedHistoryItem.id ? updatedHistoryItem : h));
  };
  
  const isPasswordInput = authStep && authStep.includes('password');
  const showInput = !isTyping && (!osSelectionStep || osSelectionStep !== 'installing') && !editingFile;

  if (editingFile) {
    return (
      <NanoEditor
        filename={editingFile.path}
        initialContent={editingFile.content}
        onSave={async (newContent) => {
            if(saveFile) {
                await saveFile(editingFile.path, newContent);
            }
            const saveMessage = `File saved: ${editingFile.path}`;
            const newHistoryItem: HistoryItem = { 
                id: history.length + 1,
                command: '', 
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
