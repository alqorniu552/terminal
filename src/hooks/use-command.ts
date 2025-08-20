
"use client";

import { useState, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { generateCommandHelp } from '@/ai/flows/generate-command-help';
import { databaseQuery } from '@/ai/flows/database-query-flow';
import { initialFilesystem as filesystem, Directory, FilesystemNode } from '@/lib/filesystem';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, WhereFilterOp } from 'firebase/firestore';
import { User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

const getNeofetchOutput = (user: User | null | undefined) => {
    let uptime = 0;
    if (typeof window !== 'undefined') {
        uptime = Math.floor(performance.now() / 1000);
    }
    const email = user?.email || 'guest';

return `
${email}@cyber
--------------------
OS: Web Browser
Host: Command Center v1.0
Kernel: Next.js
Uptime: ${uptime} seconds
Shell: term-sim
`;
};

const getHelpOutput = (isLoggedIn: boolean) => {
    if (isLoggedIn) {
        return `
Available commands:
  help          - Show this help message.
  ls [path]     - List directory contents.
  cd [path]     - Change directory.
  cat [file]    - Display file content.
  neofetch      - Display system information.
  db "[query]"  - Query the database using natural language.
  clear         - Clear the terminal screen.
  logout        - Log out from the application.

For unrecognized commands, AI will try to provide assistance.
`;
    }
    return `
Available commands:
  help          - Show this help message.
  login         - Log in to your account.
  register      - Create a new account.
  clear         - Clear the terminal screen.
`;
}


const resolvePath = (cwd: string, path: string): string => {
  if (path.startsWith('/')) {
    const newParts = path.split('/').filter(p => p);
    return '/' + newParts.join('/');
  }

  const parts = cwd === '/' ? [] : cwd.split('/').filter(p => p);
  const newParts = path.split('/').filter(p => p);

  for (const part of newParts) {
    if (part === '.') continue;
    if (part === '..') {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return '/' + parts.join('/');
};

const getNodeFromPath = (path: string): FilesystemNode | null => {
  const parts = path.split('/').filter(p => p && p !== '~');
  let currentNode: FilesystemNode = filesystem;

  for (const part of parts) {
    if (currentNode.type === 'directory' && currentNode.children[part]) {
      currentNode = currentNode.children[part];
    } else {
      return null;
    }
  }
  return currentNode;
};

export const useCommand = (user: User | null | undefined) => {
  const [cwd, setCwd] = useState('/');
  
  // State for multi-step authentication
  const [authCommand, setAuthCommand] = useState<'login' | 'register' | null>(null);
  const [authStep, setAuthStep] = useState<'email' | 'password' | null>(null);
  const [authCredentials, setAuthCredentials] = useState({ email: '', password: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  const getInitialPrompt = useCallback(() => {
    if (authStep === 'email') return 'Email: ';
    if (authStep === 'password') return 'Password: ';
    if (user) {
        const path = cwd === '/' ? '~' : `~${cwd}`;
        return `${user.email?.split('@')[0]}@cyber:${path}$`;
    }
    return 'guest@cyber:~$';
  }, [user, cwd, authStep]);

  const [prompt, setPrompt] = useState(getInitialPrompt());
  const { toast } = useToast();
  
  useEffect(() => {
    setPrompt(getInitialPrompt());
  }, [user, getInitialPrompt, authStep]);


  const resetAuth = useCallback(() => {
      setAuthCommand(null);
      setAuthStep(null);
      setAuthCredentials({ email: '', password: '' });
  }, []);
  
  // Reset auth flow if user changes
  useEffect(() => {
    resetAuth();
  }, [user, resetAuth]);


  const getWelcomeMessage = useCallback(() => {
    if (user) {
        return `Welcome, ${user.email}! Type 'help' for a list of commands.`;
    }
    return `Welcome to Command Center! Please 'login' or 'register' to continue.`;
  }, [user]);

  const processCommand = useCallback(async (command: string): Promise<string | React.ReactNode> => {
    setIsProcessing(true);
    const [cmd, ...args] = command.trim().split(/\s+/);
    const isLoggedIn = !!user;

    // Multi-step authentication logic
    if (authCommand && authStep) {
        if (authStep === 'email') {
            setAuthCredentials({ ...authCredentials, email: command.trim() });
            setAuthStep('password');
            setIsProcessing(false);
            return '';
        }

        if (authStep === 'password') {
            const { email } = authCredentials;
            const password = command.trim();
            const authFn = authCommand === 'login' ? signInWithEmailAndPassword : createUserWithEmailAndPassword;
            
            try {
                await authFn(auth, email, password);
                const message = authCommand === 'login' ? 'Login successful.' : 'Registration successful.';
                resetAuth();
                setIsProcessing(false);
                return message;
            } catch (error: any) {
                resetAuth();
                setIsProcessing(false);
                return `Error: ${error.message}`;
            }
        }
    }


    if (!isLoggedIn) {
        switch (cmd.toLowerCase()) {
            case 'login':
            case 'register':
                setAuthCommand(cmd.toLowerCase() as 'login' | 'register');
                setAuthStep('email');
                setIsProcessing(false);
                return '';
            case 'help':
                setIsProcessing(false);
                return getHelpOutput(false);
            case 'clear':
                 // This is handled in the terminal component, but we need to stop processing.
                 setIsProcessing(false);
                 return '';
            case '':
                 setIsProcessing(false);
                return '';
            default:
                setIsProcessing(false);
                return `Command not found: ${cmd}. Please 'login' or 'register'.`;
        }
    }

    const arg = args.join(' ');

    switch (cmd.toLowerCase()) {
      case 'help':
        setIsProcessing(false);
        return getHelpOutput(true);
      case 'neofetch':
        setIsProcessing(false);
        return getNeofetchOutput(user);
      
      case 'ls': {
        const targetPath = arg ? resolvePath(cwd, arg) : cwd;
        const node = getNodeFromPath(targetPath);
        if (node && node.type === 'directory') {
          setIsProcessing(false);
          return Object.keys(node.children).map(key => {
            return node.children[key].type === 'directory' ? `${key}/` : key;
          }).join('\n');
        }
        setIsProcessing(false);
        return `ls: cannot access '${arg || '.'}': No such file or directory`;
      }

      case 'cd': {
        if (!arg || arg === '~') {
          setCwd('/');
          setIsProcessing(false);
          return '';
        }
        const newPath = resolvePath(cwd, arg);
        const node = getNodeFromPath(newPath);
        if (node && node.type === 'directory') {
          setCwd(newPath);
          setIsProcessing(false);
          return '';
        }
        setIsProcessing(false);
        return `cd: no such file or directory: ${arg}`;
      }
      
      case 'cat': {
        if (!arg) {
          setIsProcessing(false);
          return 'cat: missing operand';
        }
        const targetPath = resolvePath(cwd, arg);
        const node = getNodeFromPath(targetPath);
        if (node && node.type === 'file') {
            if (typeof node.content === 'function') {
                setIsProcessing(false);
                return node.content();
            }
          setIsProcessing(false);
          return node.content;
        }
        setIsProcessing(false);
        return `cat: ${arg}: No such file or directory`;
      }

      case 'db': {
        if (!arg) {
          setIsProcessing(false);
          return 'db: missing query. Usage: db "your natural language query"';
        }
        try {
          const queryInstruction = await databaseQuery({ query: arg });
          
          const whereClauses = queryInstruction.where.map(w => where(w[0], w[1] as WhereFilterOp, w[2]));
          const q = query(collection(db, queryInstruction.collection), ...whereClauses);
          
          const querySnapshot = await getDocs(q);
          if (querySnapshot.empty) {
            setIsProcessing(false);
            return "No documents found.";
          }
          
          const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setIsProcessing(false);
          return JSON.stringify(results, null, 2);

        } catch (error) {
          console.error('Database query failed:', error);
          toast({
            variant: "destructive",
            title: "Database Query Error",
            description: "Could not process your database query.",
          });
          setIsProcessing(false);
          return `Error: Could not query database.`;
        }
      }

      case 'logout': {
        await auth.signOut();
        resetAuth();
        setCwd('/');
        setIsProcessing(false);
        return ''; // Welcome message will be handled by the component
      }
      
      case '':
        setIsProcessing(false);
        return '';

      default: {
        try {
          const result = await generateCommandHelp({ command: cmd });
          setIsProcessing(false);
          return result.helpMessage;
        } catch (error) {
          console.error('AI command help failed:', error);
          toast({
            variant: "destructive",
            title: "AI Assistant Error",
            description: "Could not get help for the command.",
          });
          setIsProcessing(false);
          return `command not found: ${cmd}`;
        }
      }
    }
  }, [authCommand, authStep, authCredentials, cwd, toast, user, resetAuth]);

  return { 
    prompt, 
    processCommand, 
    getWelcomeMessage, 
    authStep,
    isProcessing,
 };
};
