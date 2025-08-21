
"use client";

import { useState, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { generateCommandHelp } from '@/ai/flows/generate-command-help';
import { databaseQuery } from '@/ai/flows/database-query-flow';
import { initialFilesystem as filesystem, Directory, FilesystemNode, getDynamicContent } from '@/lib/filesystem';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, WhereFilterOp } from 'firebase/firestore';
import { User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import NanoEditor from '@/components/nano-editor';
import ImageDisplay from '@/components/image-display';


const ROOT_USER_EMAIL = 'admin@cyber.dev';

const getNeofetchOutput = (user: User | null | undefined, isRoot: boolean) => {
    let uptime = 0;
    if (typeof window !== 'undefined') {
        uptime = Math.floor(performance.now() / 1000);
    }
    const email = isRoot ? 'root' : (user?.email || 'guest');

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

const getHelpOutput = (isLoggedIn: boolean, isRoot: boolean) => {
    if (isLoggedIn) {
        let helpText = `
Available commands:
  help                - Show this help message.
  ls [path]           - List directory contents.
  cd [path]           - Change directory.
  cat [file]          - Display file content.
  nano [file]         - Edit a file.
  generate_image "[p]"- Generate an image from a prompt.
  neofetch            - Display system information.
  db "[query]"        - Query the database using natural language.
  clear               - Clear the terminal screen.
  logout              - Log out from the application.
`;
        if (isRoot) {
            helpText += `  exit                - Exit from root user session.\n`;
        } else {
            helpText += `  su                  - Switch to root user (requires admin privileges).\n`;
        }
        helpText += `
For unrecognized commands, AI will try to provide assistance.
`;
        return helpText;
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

// Helper to update the filesystem in memory
const updateNodeInFilesystem = (path: string, newContent: string) => {
    const parts = path.split('/').filter(p => p);
    let currentNode: FilesystemNode = filesystem;
    let parentNode: Directory | null = null;
    let lastPart = '';

    for (const part of parts) {
        if (currentNode.type === 'directory') {
            parentNode = currentNode;
            if (!currentNode.children[part]) {
                 // If the file doesn't exist, create it.
                 currentNode.children[part] = { type: 'file', content: newContent, path };
                 return true;
            }
            currentNode = currentNode.children[part];
            lastPart = part;
        } else {
            return false; // Path goes through a file
        }
    }
    
    if (currentNode.type === 'file') {
        currentNode.content = newContent;
        return true;
    } else if (parentNode && lastPart) { // Create a new file in a directory
        parentNode.children[lastPart] = { type: 'file', content: newContent, path };
        return true;
    }

    return false;
};

export const useCommand = (user: User | null | undefined) => {
  const [cwd, setCwd] = useState('/');
  const [isRoot, setIsRoot] = useState(false);
  
  // State for multi-step authentication
  const [authCommand, setAuthCommand] = useState<'login' | 'register' | null>(null);
  const [authStep, setAuthStep] = useState<'email' | 'password' | null>(null);
  const [authCredentials, setAuthCredentials] = useState({ email: '', password: '' });
  const [isProcessing, setIsProcessing] = useState(false);

  // State for Nano editor
  const [editingFile, setEditingFile] = useState<{ path: string; content: string; } | null>(null);

  const getInitialPrompt = useCallback(() => {
    if (authStep === 'email') return 'Email: ';
    if (authStep === 'password') return 'Password: ';
    
    let path;
    if (isRoot) {
        path = cwd;
    } else {
        path = cwd === '/' ? '~' : `~${cwd}`;
    }

    const endChar = isRoot ? '#' : '$';
    const username = isRoot ? 'root' : user?.email?.split('@')[0] || 'guest';
    
    return `${username}@cyber:${path}${endChar} `;

  }, [user, cwd, authStep, isRoot]);

  const [prompt, setPrompt] = useState(getInitialPrompt());
  const { toast } = useToast();
  
  useEffect(() => {
    setPrompt(getInitialPrompt());
  }, [user, getInitialPrompt, authStep, isRoot]);


  const resetAuth = useCallback(() => {
      setAuthCommand(null);
      setAuthStep(null);
      setAuthCredentials({ email: '', password: '' });
  }, []);
  
  // Reset auth flow if user changes
  useEffect(() => {
    resetAuth();
    setIsRoot(false);
    setCwd('/');
  }, [user, resetAuth]);


  const getWelcomeMessage = useCallback(() => {
    if (user) {
        if (user.email === ROOT_USER_EMAIL) {
            return `Welcome, administrator ${user.email}! You have root privileges. Type 'su' to elevate.`;
        }
        return `Welcome, ${user.email}! Type 'help' for a list of commands.`;
    }
    return `Welcome to Command Center! Please 'login' or 'register' to continue.`;
  }, [user]);

  const processCommand = useCallback(async (command: string): Promise<string | React.ReactNode> => {
    if (editingFile) return ''; // Block commands while editing

    setIsProcessing(true);
    const [cmd, ...args] = command.trim().split(/\s+/);
    const isLoggedIn = !!user;

    // Multi-step authentication logic
    if (authCommand && authStep) {
        if (command.trim().toLowerCase() === 'exit') {
            resetAuth();
            setIsProcessing(false);
            return '';
        }

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
                return getHelpOutput(false, false);
            case 'clear':
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
    
    // Regex to extract prompt from generate_image command
    const imagePromptMatch = command.match(/^generate_image\s+"([^"]+)"/);


    switch (cmd.toLowerCase()) {
      case 'help':
        setIsProcessing(false);
        return getHelpOutput(true, isRoot);
      case 'neofetch':
        setIsProcessing(false);
        return getNeofetchOutput(user, isRoot);
      
      case 'ls': {
        const targetPath = arg ? resolvePath(cwd, arg) : cwd;
        if (targetPath.startsWith('/root') && !isRoot) {
            setIsProcessing(false);
            return `ls: cannot open directory '${targetPath}': Permission denied`;
        }
        const node = getNodeFromPath(targetPath);
        if (node && node.type === 'directory') {
          setIsProcessing(false);
          return Object.keys(node.children).map(key => {
            return node.children[key].type === 'directory' ? `\x1b[1;34m${key}/\x1b[0m` : key;
          }).join('\n');
        }
        setIsProcessing(false);
        return `ls: cannot access '${arg || '.'}': No such file or directory`;
      }

      case 'cd': {
        if (!arg || arg === '~') {
          // root user's home is /root, regular user's is /
          const homeDir = isRoot ? '/root' : '/';
          setCwd(homeDir);
          setIsProcessing(false);
          return '';
        }
        const newPath = resolvePath(cwd, arg);
        const node = getNodeFromPath(newPath);
        if (node && node.type === 'directory') {
          if (newPath.startsWith('/root') && !isRoot) {
            setIsProcessing(false);
            return 'cd: permission denied: /root';
          }
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
        if (targetPath.startsWith('/root') && !isRoot) {
          setIsProcessing(false);
          return `cat: ${arg}: Permission denied`;
        }
        const node = getNodeFromPath(targetPath);
        if (node && node.type === 'file') {
          setIsProcessing(false);
          return getDynamicContent(node.content);
        }
        setIsProcessing(false);
        return `cat: ${arg}: No such file or directory`;
      }

      case 'nano': {
        if (!arg) {
            setIsProcessing(false);
            return "nano: missing file operand";
        }
        const targetPath = resolvePath(cwd, arg);
        if (targetPath.startsWith('/root') && !isRoot) {
            setIsProcessing(false);
            return `nano: cannot edit '${arg}': Permission denied`;
        }

        const node = getNodeFromPath(targetPath);
        let initialContent = '';
        if (node) {
            if (node.type === 'directory') {
                setIsProcessing(false);
                return `nano: ${arg}: is a directory`;
            }
            initialContent = getDynamicContent(node.content);
        }
        
        setEditingFile({ path: targetPath, content: initialContent });

        setIsProcessing(false);
        return (
            <NanoEditor
                filename={targetPath}
                initialContent={initialContent}
                onSave={(newContent) => {
                    updateNodeInFilesystem(targetPath, newContent);
                    setEditingFile(null);
                }}
                onExit={() => {
                    setEditingFile(null);
                }}
            />
        );
      }
      
      case 'generate_image': {
            if (!imagePromptMatch || !imagePromptMatch[1]) {
                setIsProcessing(false);
                return 'Usage: generate_image "your image prompt"';
            }
            const imagePrompt = imagePromptMatch[1];
            setIsProcessing(false);
            return (
                <ImageDisplay 
                    prompt={imagePrompt} 
                    onFinished={() => { /* Potentially re-enable prompt here if needed */}} 
                />
            );
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

      case 'su': {
        if (isRoot) {
            setIsProcessing(false);
            return "Already root.";
        }
        if (user?.email !== ROOT_USER_EMAIL) {
            setIsProcessing(false);
            return "su: Permission denied.";
        }
        setIsRoot(true);
        setCwd('/root');
        setIsProcessing(false);
        return '';
      }

      case 'exit': {
        if (isRoot) {
          setIsRoot(false);
          setCwd('/');
        }
        setIsProcessing(false);
        return '';
      }

      case 'logout': {
        await auth.signOut();
        // The user state change will trigger a useEffect to reset everything.
        setIsProcessing(false);
        return '';
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
  }, [authCommand, authStep, authCredentials, cwd, toast, user, resetAuth, isRoot, getWelcomeMessage, editingFile]);

  return { 
    prompt, 
    processCommand, 
    getWelcomeMessage, 
    authStep,
    isProcessing,
    editingFile,
 };
};
