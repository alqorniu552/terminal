"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { generateCommandHelp } from '@/ai/flows/generate-command-help';
import { databaseQuery } from '@/ai/flows/database-query-flow';
import { initialFilesystem, Directory, FilesystemNode, File } from '@/lib/filesystem';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, WhereFilterOp, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import ImageDisplay from '@/components/image-display';

type EditingFile = { path: string; content: string } | null;
type CommandResult = 
  | { type: 'text', text: string }
  | { type: 'component', component: React.ReactNode }
  | { type: 'none' };

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
    const formatCommandsToTable = (title: string, commands: { command: string, args: string, description: string }[]): string => {
        let output = `\n\x1b[1;33m${title}\x1b[0m\n`;
        const maxLength = Math.max(...commands.map(c => (c.command + (c.args ? ' ' + c.args : '')).length));
        
        commands.forEach(c => {
            const commandStr = (c.command + (c.args ? ' ' + c.args : '')).padEnd(maxLength + 4, ' ');
            output += `  \x1b[1;32m${commandStr}\x1b[0m- ${c.description}\n`;
        });
        return output;
    };

    if (isLoggedIn) {
        const loggedInCommands = [
          { command: 'help', args: '', description: 'Show this help message.' },
          { command: 'ls', args: '[path]', description: 'List directory contents.' },
          { command: 'cd', args: '<path>', description: 'Change directory.' },
          { command: 'cat', args: '<file>', description: 'Display file content.' },
          { command: 'nano', args: '<file>', description: 'Edit a file.' },
          { command: 'mkdir', args: '<dirname>', description: 'Create a directory.' },
          { command: 'touch', args: '<filename>', description: 'Create an empty file.' },
          { command: 'rm', args: '<file/dir>', description: 'Remove a file or directory.' },
          { command: 'neofetch', args: '', description: 'Display system information.' },
          { command: 'db', args: '"query"', description: 'Query the database using natural language.' },
          { command: 'imagine', args: '"prompt"', description: 'Generate an image with AI.'},
          { command: 'clear', args: '', description: 'Clear the terminal screen.' },
          { command: 'logout', args: '', description: 'Log out from the application.' },
        ];
        return formatCommandsToTable('Available Commands', loggedInCommands) + "\nFor unrecognized commands, AI will try to provide assistance.";
    }
    const loggedOutCommands = [
      { command: 'help', args: '', description: 'Show this help message.' },
      { command: 'login', args: 'email password', description: 'Log in to your account.' },
      { command: 'register', args: 'email password', description: 'Create a new account.' },
      { command: 'clear', args: '', description: 'Clear the terminal screen.' },
    ];
    return formatCommandsToTable('Available Commands', loggedOutCommands);
};

export const useCommand = (user: User | null | undefined) => {
  const [cwd, setCwd] = useState('/');
  const [isProcessing, setIsProcessing] = useState(false);
  const [userFilesystem, setUserFilesystem] = useState<Directory>(initialFilesystem);
  const [editingFile, setEditingFile] = useState<EditingFile>(null);
  
  const getPrompt = useCallback(() => {
    if (user) {
        const username = user.email?.split('@')[0] || 'user';
        const path = cwd === '/' ? '~' : `~${cwd}`;
        return `${username}@command-center:${path}$`;
    }
    return 'guest@command-center:~$';
  }, [user, cwd]);

  const [prompt, setPrompt] = useState(getPrompt());
  const { toast } = useToast();
  
  useEffect(() => {
    setPrompt(getPrompt());
  }, [user, cwd, getPrompt]);
  
  const fetchUserFilesystem = useCallback(async () => {
    if (user) {
        setIsProcessing(true);
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().filesystem) {
            setUserFilesystem(userDoc.data().filesystem);
        } else {
            // If user has no filesystem, set the initial one
            const newUserDoc = { email: user.email, filesystem: initialFilesystem };
            await setDoc(userDocRef, newUserDoc, { merge: true });
            setUserFilesystem(initialFilesystem);
        }
        setCwd('/'); // Reset to root dir on user change
        setIsProcessing(false);
    } else {
        // Not logged in, reset to defaults
        setUserFilesystem(initialFilesystem);
        setCwd('/');
    }
  }, [user]);

  useEffect(() => {
    fetchUserFilesystem();
  }, [user, fetchUserFilesystem]);


  const getWelcomeMessage = useCallback(() => {
    if (user) {
        return `Welcome back, ${user.email}! Type 'help' for a list of commands.`;
    }
    return `Welcome to Command Center! Please 'login' or 'register' to continue.`;
  }, [user]);

  const resolvePath = useCallback((path: string): string => {
    if (path.startsWith('/')) {
      return '/' + path.split('/').filter(p => p).join('/');
    }
    const parts = cwd === '/' ? [] : cwd.split('/').filter(p => p);
    for (const part of path.split('/')) {
      if (part === '.' || part === '') continue;
      if (part === '..') {
        parts.pop();
      } else {
        parts.push(part);
      }
    }
    return '/' + parts.join('/');
  }, [cwd]);

  const getNodeFromPath = useCallback((path: string, fs: Directory): FilesystemNode | null => {
    const parts = path.split('/').filter(p => p && p !== '~');
    let currentNode: FilesystemNode = fs;
    for (const part of parts) {
      if (currentNode.type === 'directory' && currentNode.children[part]) {
        currentNode = currentNode.children[part];
      } else {
        return null;
      }
    }
    return currentNode;
  }, []);

  const getParentNodeFromPath = useCallback((path: string, fs: Directory): Directory | null => {
      const parts = path.split('/').filter(p => p && p !== '~');
      if (parts.length <= 1) return fs; // Parent is root
      const parentPath = '/' + parts.slice(0, -1).join('/');
      const node = getNodeFromPath(parentPath, fs);
      return node?.type === 'directory' ? node : null;
  }, [getNodeFromPath]);

  const updateFirestoreFilesystem = useCallback(async (newFilesystem: Directory) => {
    if (user) {
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, { filesystem: newFilesystem });
        } catch (error) {
            console.error("Error updating filesystem in Firestore:", error);
            toast({
                variant: "destructive",
                title: "Filesystem Error",
                description: "Could not save file changes to the cloud.",
            });
        }
    }
  }, [user, toast]);

  const saveFile = useCallback(async (path: string, content: string): Promise<string> => {
      const newFs = JSON.parse(JSON.stringify(userFilesystem));
      const targetPath = resolvePath(path);
      const parentNode = getParentNodeFromPath(targetPath, newFs);
      const filename = targetPath.split('/').pop();

      if (parentNode && filename) {
          const existingNode = parentNode.children[filename];
          if (existingNode && existingNode.type === 'directory') {
              return `Error: Cannot save file, '${filename}' is a directory.`;
          }
          parentNode.children[filename] = { type: 'file', content: content };
          setUserFilesystem({ ...newFs });
          await updateFirestoreFilesystem(newFs);
          return `File saved: ${path}`;
      }
      return `Error: Could not save file to path '${path}'.`;
  }, [userFilesystem, resolvePath, getParentNodeFromPath, updateFirestoreFilesystem]);

  const exitEditor = useCallback(() => {
      setEditingFile(null);
  }, []);

  const processCommand = useCallback(async (command: string): Promise<CommandResult> => {
    setIsProcessing(true);
    const [cmd, ...args] = command.trim().split(/\s+/);
    const argString = args.join(' ');
    const isLoggedIn = !!user;

    const handleAuth = async (authFn: typeof signInWithEmailAndPassword | typeof createUserWithEmailAndPassword) => {
        const [email, password] = args;
        if (!email || !password) {
            return { type: 'text', text: `Usage: ${cmd} [email] [password]` };
        }
        try {
            await authFn(auth, email, password);
            // The user state change will trigger a re-render and welcome message
            return { type: 'none' };
        } catch (error: any) {
            return { type: 'text', text: `Authentication Error: ${error.code}` };
        }
    };

    if (!isLoggedIn) {
        switch (cmd.toLowerCase()) {
            case 'login':
                return await handleAuth(signInWithEmailAndPassword);
            case 'register':
                return await handleAuth(createUserWithEmailAndPassword);
            case 'help':
                return { type: 'text', text: getHelpOutput(false) };
            case '':
                return { type: 'none' };
            default:
                setIsProcessing(false);
                return { type: 'text', text: `Command not found: ${cmd}. Please 'login' or 'register'.` };
        }
    }

    // --- Logged-in commands ---
    try {
        switch (cmd.toLowerCase()) {
          case 'help':
            return { type: 'text', text: getHelpOutput(true) };
          case 'neofetch':
            return { type: 'text', text: getNeofetchOutput(user) };
          
          case 'ls': {
            const targetPath = argString ? resolvePath(argString) : cwd;
            const node = getNodeFromPath(targetPath, userFilesystem);
            if (node && node.type === 'directory') {
              const content = Object.keys(node.children);
              if (content.length === 0) return { type: 'text', text: '' };
              const output = content.map(key => {
                return node.children[key].type === 'directory' ? `\x1b[1;34m${key}/\x1b[0m` : key;
              }).join('\n');
              return { type: 'text', text: output };
            }
            return { type: 'text', text: `ls: cannot access '${argString || '.'}': No such file or directory` };
          }

          case 'cd': {
            if (!argString || argString === '~' || argString === '/') {
              setCwd('/');
              return { type: 'none' };
            }
            const newPath = resolvePath(argString);
            const node = getNodeFromPath(newPath, userFilesystem);
            if (node && node.type === 'directory') {
              setCwd(newPath);
              return { type: 'none' };
            }
            return { type: 'text', text: `cd: no such file or directory: ${argString}` };
          }
          
          case 'cat': {
            if (!argString) return { type: 'text', text: 'cat: missing operand' };
            const targetPath = resolvePath(argString);
            const node = getNodeFromPath(targetPath, userFilesystem);
            if (node && node.type === 'file') {
                const content = typeof node.content === 'function' ? node.content() : node.content;
                return { type: 'text', text: content };
            }
            return { type: 'text', text: `cat: ${argString}: No such file or directory` };
          }
          
          case 'nano': {
            if (!argString) return { type: 'text', text: 'Usage: nano <filename>' };
            const targetPath = resolvePath(argString);
            const node = getNodeFromPath(targetPath, userFilesystem);
            if (node && node.type === 'directory') {
                return { type: 'text', text: `nano: ${argString}: Is a directory` };
            }
            const content = (node && node.type === 'file') ? (typeof node.content === 'function' ? node.content() : node.content) : '';
            setEditingFile({ path: targetPath, content: content as string });
            return { type: 'none' };
          }

          case 'mkdir': {
            if (!argString) return { type: 'text', text: 'mkdir: missing operand' };
            const newFs = JSON.parse(JSON.stringify(userFilesystem));
            const targetPath = resolvePath(argString);
            const parentNode = getParentNodeFromPath(targetPath, newFs);
            const dirname = targetPath.split('/').pop();
            if (parentNode && dirname) {
                if (parentNode.children[dirname]) {
                    return { type: 'text', text: `mkdir: cannot create directory ‘${argString}’: File exists` };
                }
                parentNode.children[dirname] = { type: 'directory', children: {} };
                setUserFilesystem({ ...newFs });
                await updateFirestoreFilesystem(newFs);
                return { type: 'none' };
            }
            return { type: 'text', text: `mkdir: cannot create directory ‘${argString}’: No such file or directory` };
          }

          case 'touch': {
            if (!argString) return { type: 'text', text: 'touch: missing file operand' };
            const newFs = JSON.parse(JSON.stringify(userFilesystem));
            const targetPath = resolvePath(argString);
            const parentNode = getParentNodeFromPath(targetPath, newFs);
            const filename = targetPath.split('/').pop();
            if (parentNode && filename) {
                if (parentNode.children[filename]) {
                    return { type: 'none' }; // Silently do nothing if file exists
                }
                parentNode.children[filename] = { type: 'file', content: '' };
                setUserFilesystem({ ...newFs });
                await updateFirestoreFilesystem(newFs);
                return { type: 'none' };
            }
            return { type: 'text', text: `touch: cannot touch '${argString}': No such file or directory` };
          }

          case 'rm': {
            if (!argString) return { type: 'text', text: 'rm: missing operand' };
            const newFs = JSON.parse(JSON.stringify(userFilesystem));
            const targetPath = resolvePath(argString);
            const parentNode = getParentNodeFromPath(targetPath, newFs);
            const nodeName = targetPath.split('/').pop();
            if (parentNode && nodeName && parentNode.children[nodeName]) {
                const nodeToRemove = parentNode.children[nodeName];
                if (nodeToRemove.type === 'directory' && Object.keys(nodeToRemove.children).length > 0 && !args.includes('-r')) {
                    return { type: 'text', text: `rm: cannot remove '${argString}': Is a directory (and not empty)` };
                }
                delete parentNode.children[nodeName];
                setUserFilesystem({ ...newFs });
                await updateFirestoreFilesystem(newFs);
                return { type: 'none' };
            }
            return { type: 'text', text: `rm: cannot remove '${argString}': No such file or directory` };
          }

          case 'db': {
            if (!argString.startsWith('"') || !argString.endsWith('"')) {
                return { type: 'text', text: 'db: query must be enclosed in quotes. Usage: db "your natural language query"' };
            }
            const queryText = argString.slice(1, -1);
            const queryInstruction = await databaseQuery({ query: queryText });
            
            const whereClauses = queryInstruction.where.map(w => where(w[0], w[1] as WhereFilterOp, w[2]));
            const q = query(collection(db, queryInstruction.collection), ...whereClauses);
            
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                return { type: 'text', text: "No documents found." };
            }
            
            const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return { type: 'text', text: JSON.stringify(results, null, 2) };
          }
          
          case 'imagine': {
             if (!argString.startsWith('"') || !argString.endsWith('"')) {
                return { type: 'text', text: 'imagine: prompt must be enclosed in quotes. Usage: imagine "[your prompt]"' };
            }
            const promptText = argString.slice(1, -1);
            return { component: <ImageDisplay prompt={promptText} onFinished={() => {}} />, type: 'component' };
          }

          case 'logout': {
            await auth.signOut();
            return { type: 'text', text: 'Logged out successfully.' };
          }
          
          case '':
            return { type: 'none' };

          default: {
            const result = await generateCommandHelp({ command: cmd });
            return { type: 'text', text: result.helpMessage };
          }
        }
    } catch (error: any) {
        console.error('Command processing error:', error);
        toast({
            variant: "destructive",
            title: "Command Error",
            description: error.message || "An unexpected error occurred.",
        });
        return { type: 'text', text: `Error: ${error.message}` };
    } finally {
        setIsProcessing(false);
    }
  }, [cwd, toast, user, userFilesystem, resolvePath, getNodeFromPath, getParentNodeFromPath, updateFirestoreFilesystem, saveFile, exitEditor]);

  return { prompt, processCommand, getWelcomeMessage, isProcessing, editingFile, saveFile, exitEditor };
};
