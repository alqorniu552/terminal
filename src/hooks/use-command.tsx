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
${email}@command-center
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
  prompt [value]- Set a new prompt.
  db "[query]"  - Query the database using natural language.
  clear         - Clear the terminal screen.
  logout        - Log out from the application.

For unrecognized commands, AI will try to provide assistance.
`;
    }
    return `
Available commands:
  help          - Show this help message.
  login [email] [password] - Log in to your account.
  register [email] [password] - Create a new account.
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
  const [warlockMessages, setWarlockMessages] = useState<any[]>([]);

  const getInitialPrompt = useCallback(() => {
    if (user) {
        return `${user.email?.split('@')[0]}@command-center:~$`;
    }
    return 'guest@command-center:~$';
  }, [user]);

  const [prompt, setPrompt] = useState(getInitialPrompt());
  const { toast } = useToast();
  
  useEffect(() => {
    setPrompt(getInitialPrompt());
  }, [user, getInitialPrompt]);

  const resetPrompt = useCallback(() => {
      setPrompt(getInitialPrompt());
  }, [getInitialPrompt]);

  const getWelcomeMessage = useCallback(() => {
    if (user) {
        return `Welcome, ${user.email}! Type 'help' for a list of commands.`;
    }
    return `Welcome to Command Center! Please 'login' or 'register' to continue.`;
  }, [user]);

  const clearWarlockMessages = useCallback(() => {
    setWarlockMessages([]);
  }, []);

  const processCommand = useCallback(async (command: string): Promise<string | React.ReactNode> => {
    const [cmd, ...args] = command.trim().split(/\s+/);
    const isLoggedIn = !!user;

    const handleAuth = async (authFn: typeof signInWithEmailAndPassword | typeof createUserWithEmailAndPassword) => {
        const [email, password] = args;
        if (!email || !password) {
            return `Usage: ${cmd} [email] [password]`;
        }
        try {
            await authFn(auth, email, password);
            return authFn === signInWithEmailAndPassword ? 'Login successful.' : 'Registration successful.';
        } catch (error: any) {
            return `Error: ${error.message}`;
        }
    }

    if (!isLoggedIn) {
        switch (cmd.toLowerCase()) {
            case 'login':
                return handleAuth(signInWithEmailAndPassword);
            case 'register':
                return handleAuth(createUserWithEmailAndPassword);
            case 'help':
                return getHelpOutput(false);
            case '':
                return '';
            default:
                return `Command not found: ${cmd}. Please 'login' or 'register'.`;
        }
    }

    const arg = args.join(' ');

    switch (cmd.toLowerCase()) {
      case 'help':
        return getHelpOutput(true);
      case 'neofetch':
        return getNeofetchOutput(user);
      
      case 'ls': {
        const targetPath = arg ? resolvePath(cwd, arg) : cwd;
        const node = getNodeFromPath(targetPath);
        if (node && node.type === 'directory') {
          return Object.keys(node.children).map(key => {
            return node.children[key].type === 'directory' ? `${key}/` : key;
          }).join('\n');
        }
        return `ls: cannot access '${arg || '.'}': No such file or directory`;
      }

      case 'cd': {
        if (!arg || arg === '~') {
          setCwd('/');
          setPrompt(`${user.email?.split('@')[0]}@command-center:~$`);
          return '';
        }
        const newPath = resolvePath(cwd, arg);
        const node = getNodeFromPath(newPath);
        if (node && node.type === 'directory') {
          setCwd(newPath);
          const newPromptPath = newPath === '/' ? '~' : `~${newPath}`;
          setPrompt(`${user.email?.split('@')[0]}@command-center:${newPromptPath}$`);
          return '';
        }
        return `cd: no such file or directory: ${arg}`;
      }
      
      case 'cat': {
        if (!arg) {
          return 'cat: missing operand';
        }
        const targetPath = resolvePath(cwd, arg);
        const node = getNodeFromPath(targetPath);
        if (node && node.type === 'file') {
            if (typeof node.content === 'function') {
                return node.content();
            }
          return node.content;
        }
        return `cat: ${arg}: No such file or directory`;
      }

      case 'db': {
        if (!arg) {
          return 'db: missing query. Usage: db "your natural language query"';
        }
        try {
          const queryInstruction = await databaseQuery({ query: arg });
          
          const whereClauses = queryInstruction.where.map(w => where(w[0], w[1] as WhereFilterOp, w[2]));
          const q = query(collection(db, queryInstruction.collection), ...whereClauses);
          
          const querySnapshot = await getDocs(q);
          if (querySnapshot.empty) {
            return "No documents found.";
          }
          
          const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          return JSON.stringify(results, null, 2);

        } catch (error) {
          console.error('Database query failed:', error);
          toast({
            variant: "destructive",
            title: "Database Query Error",
            description: "Could not process your database query.",
          });
          return `Error: Could not query database.`;
        }
      }

      case 'logout': {
        await auth.signOut();
        return 'Logged out successfully.';
      }
      
      case '':
        return '';

      default: {
        try {
          const result = await generateCommandHelp({ command: cmd });
          return result.helpMessage;
        } catch (error) {
          console.error('AI command help failed:', error);
          toast({
            variant: "destructive",
            title: "AI Assistant Error",
            description: "Could not get help for the command.",
          });
          return `command not found: ${cmd}`;
        }
      }
    }
  }, [cwd, toast, user, prompt]);

  return { 
    prompt, 
    setPrompt, 
    processCommand, 
    resetPrompt, 
    getWelcomeMessage, 
    warlockMessages, 
    clearWarlockMessages,
    editingFile: null,
    exitEditor: () => {},
    saveFile: async () => "not implemented",
    isProcessing: false,
 };
};
