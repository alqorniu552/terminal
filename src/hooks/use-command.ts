
"use client";

import { useState, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { generateCommandHelp } from '@/ai/flows/generate-command-help';
import { databaseQuery } from '@/ai/flows/database-query-flow';
import { getNodeFromPath, getDynamicContent, updateNodeInFilesystem, removeNodeFromFilesystem } from '@/lib/filesystem';
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
    const username = isRoot ? 'root' : (user?.email?.split('@')[0] || 'guest');
    const hostname = 'cyber';

    const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`;

    const ubuntuLogo = [
        "            .-/+oossssoo+/-.               ",
        "        `:+ssssssssssssssssss+:`           ",
        "      -+ssssssssssssssssssyyssss+-         ",
        "    .ossssssssssssssssssdMMMNysssso.       ",
        "   /ssssssssssshdmmNNmmyNMMMMhssssss/      ",
        "  +ssssssssshmydMMMMMMMNddddyssssssss+     ",
        " /sssssssshNMMMyhhyyyyhmNMMMNhssssssss/    ",
        ".ssssssssdMMMNhsssssssssshNMMMdssssssss.   ",
        "ssssssssMNNsyyyyyyyyyyyyyyyMNNsssssssss",
        "ssssssssNMMs               hMMNsssssssss",
        "-ssssssssMMMy             .MMMdssssssss-",
        " osssssssNMMMy.           dMMMNssssssssso ",
        "  +ssssssssNMMMdyyyyyyyhmMMMMhssssssss+  ",
        "   /sssssssssshdmmNNmmyNMMMMhssssss/      ",
        "    .ossssssssssssssssssdMMMNysssso.       ",
        "      -+ssssssssssssssssssyyssss+-         ",
        "        `:+ssssssssssssssssss+:`           ",
        "            .-/+oossssoo+/-.               "
    ];

    const userInfo = `${username}@${hostname}`;
    const osInfo = `OS: Ubuntu 22.04.3 LTS x86_64 (Emulated)`;
    const hostInfo = `Host: Cyber v1.0`;
    const kernelInfo = `Kernel: 5.15.0-generic (Next.js)`;
    const uptimeInfo = `Uptime: ${uptimeStr}`;
    const shellInfo = `Shell: term-sim (bash 5.1.16)`;
    const resolutionInfo = typeof window !== 'undefined' ? `Resolution: ${window.innerWidth}x${window.innerHeight}` : 'Resolution: N/A';
    const cpuInfo = 'CPU: Intel Core i9 (Emulated)';
    const gpuInfo = 'GPU: NVIDIA GeForce RTX (Emulated)';
    const memoryInfo = 'Memory: 32GiB (Emulated)';

    const infoLines = [
        `\x1b[38;5;208m${userInfo}\x1b[0m`,
        '--------------------',
        `\x1b[38;5;208m${osInfo.split(': ')[0]}\x1b[0m: ${osInfo.split(': ')[1]}`,
        `\x1b[38;5;208m${hostInfo.split(': ')[0]}\x1b[0m: ${hostInfo.split(': ')[1]}`,
        `\x1b[38;5;208m${kernelInfo.split(': ')[0]}\x1b[0m: ${kernelInfo.split(': ')[1]}`,
        `\x1b[38;5;208m${uptimeInfo.split(': ')[0]}\x1b[0m: ${uptimeInfo.split(': ')[1]}`,
        `\x1b[38;5;208m${shellInfo.split(': ')[0]}\x1b[0m: ${shellInfo.split(': ')[1]}`,
        `\x1b[38;5;208m${resolutionInfo.split(': ')[0]}\x1b[0m: ${resolutionInfo.split(': ')[1]}`,
        `\x1b[38;5;208m${cpuInfo.split(': ')[0]}\x1b[0m: ${cpuInfo.split(': ')[1]}`,
        `\x1b[38;5;208m${gpuInfo.split(': ')[0]}\x1b[0m: ${gpuInfo.split(': ')[1]}`,
        `\x1b[38;5;208m${memoryInfo.split(': ')[0]}\x1b[0m: ${memoryInfo.split(': ')[1]}`,
        '', // Spacer
    ];

    let output = '\n';
    for (let i = 0; i < ubuntuLogo.length; i++) {
        const logoLine = `\x1b[38;5;208m${ubuntuLogo[i] || ''}\x1b[0m`;
        const infoLine = infoLines[i] || '';
        output += `${logoLine} ${infoLine}\n`;
    }

    return output;
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
  db "[query]"        - Query the database (e.g., "list all users").
  news                - List or read news articles.
  clear               - Clear the terminal screen.
  logout              - Log out from the application.
`;
        if (isRoot) {
            helpText += `
Root-only news commands:
  news add "title"    - Create a new news article.
  news edit <number>  - Edit an existing news article.
  news del <number>   - Delete a news article.
  exit                - Exit from root user session.

Root has elevated privileges and can access all user directories under /home.`;
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

export const useCommand = (user: User | null | undefined) => {
  const [cwd, setCwd] = useState('/');
  const [isRoot, setIsRoot] = useState(false);
  
  // State for multi-step authentication and confirmation
  const [authCommand, setAuthCommand] = useState<'login' | 'register' | null>(null);
  const [authStep, setAuthStep] = useState<'email' | 'password' | null>(null);
  const [authCredentials, setAuthCredentials] = useState({ email: '', password: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmation, setConfirmation] = useState<{ message: string; onConfirm: () => Promise<string | React.ReactNode> } | null>(null);

  // State for Nano editor
  const [editingFile, setEditingFile] = useState<{ path: string; content: string; onSaveCallback?: () => void } | null>(null);

  const getInitialPrompt = useCallback(() => {
    if (confirmation) return `${confirmation.message} (y/n): `;
    if (authStep === 'email') return 'Email: ';
    if (authStep === 'password') return 'Password: ';
    
    let path;
    const userHome = user ? `/home/${user.email?.split('@')[0]}` : '/';
    
    if (isRoot) {
        path = cwd.startsWith('/root') ? `~${cwd.substring(5)}` : cwd;
        if (path === '') path = '/';
    } else {
        if (cwd === userHome) {
            path = '~';
        } else if (cwd.startsWith(userHome + '/')) {
            path = `~${cwd.substring(userHome.length)}`;
        } else {
            path = cwd;
        }
    }
    
    path = path.replace('//', '/');
    if (path !== '/' && path.endsWith('/')) {
        path = path.slice(0, -1);
    }


    const endChar = isRoot ? '#' : '$';
    const username = isRoot ? 'root' : user?.email?.split('@')[0] || 'guest';
    
    return `${username}@cyber:${path}${endChar} `;

  }, [user, cwd, authStep, isRoot, confirmation]);

  const [prompt, setPrompt] = useState(getInitialPrompt());
  const { toast } = useToast();
  
  useEffect(() => {
    setPrompt(getInitialPrompt());
  }, [user, getInitialPrompt, authStep, isRoot, confirmation]);


  const resetAuth = useCallback(() => {
      setAuthCommand(null);
      setAuthStep(null);
      setAuthCredentials({ email: '', password: '' });
  }, []);
  
  // Reset auth flow if user changes
  useEffect(() => {
    resetAuth();
    setIsRoot(false);
    // On login, set CWD to user's home directory if it exists, otherwise to root
    if (user) {
        const userHome = `/home/${user.email!.split('@')[0]}`;
        const node = getNodeFromPath(userHome);
        if (node && node.type === 'directory') {
            setCwd(userHome);
        } else {
            setCwd('/');
        }
    } else {
        setCwd('/');
    }
  }, [user, resetAuth]);


  const getWelcomeMessage = useCallback(() => {
    if (user) {
        if (user.email === ROOT_USER_EMAIL) {
            return `Welcome, administrator ${user.email}! You have root privileges. Type 'su' to elevate.`;
        }
        return `Welcome, ${user.email}! Type 'help' for a list of commands.`;
    }
    return `Welcome to Cyber! Please 'login' or 'register' to continue.`;
  }, [user]);

  const processCommand = useCallback(async (command: string): Promise<string | React.ReactNode> => {
    if (editingFile) return ''; // Block commands while editing

    setIsProcessing(true);

    if (confirmation) {
        const response = command.trim().toLowerCase();
        const { onConfirm } = confirmation;
        setConfirmation(null);
        if (response === 'y' || response === 'yes') {
            const result = await onConfirm();
            setIsProcessing(false);
            return result;
        }
        setIsProcessing(false);
        return 'Operation cancelled.';
    }

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

    const fullArgString = command.trim().substring(cmd.length).trim();
    
    // Regex to extract prompt from generate_image command and news add
    const imagePromptMatch = command.match(/^generate_image\s+"([^"]+)"/);
    const newsAddMatch = command.match(/^news\s+add\s+"([^"]+)"/);

    const hasPermission = (path: string, operation: 'read' | 'write' = 'read') => {
        if (isRoot) return true;
        if (!user) return false;
        
        // Write operations are more restricted for non-root
        if (operation === 'write') {
             // For now, only allow writing in user's home directory
            const userHome = `/home/${user.email!.split('@')[0]}`;
            if (!path.startsWith(userHome + '/')) {
                return false;
            }
        }

        // Read operations
        if (path.startsWith('/root')) return false;

        const parts = path.split('/').filter(p => p);
        if (parts[0] === 'home' && parts.length > 1 && parts[1] !== user.email!.split('@')[0]) {
            return false;
        }

        return true;
    };


    switch (cmd.toLowerCase()) {
      case 'help':
        setIsProcessing(false);
        return getHelpOutput(true, isRoot);
      case 'neofetch':
        setIsProcessing(false);
        return getNeofetchOutput(user, isRoot);
      
      case 'ls': {
        const targetPath = args[0] ? resolvePath(cwd, args[0]) : cwd;
        if (!hasPermission(targetPath)) {
            setIsProcessing(false);
            return `ls: cannot open directory '${args[0] || '.'}': Permission denied`;
        }
        const node = getNodeFromPath(targetPath);
        if (node && node.type === 'directory') {
          setIsProcessing(false);
          return Object.keys(node.children).map(key => {
            return node.children[key].type === 'directory' ? `${key}/` : key;
          }).join('\n');
        }
        setIsProcessing(false);
        return `ls: cannot access '${args[0] || '.'}': No such file or directory`;
      }

      case 'cd': {
        const homeDir = isRoot ? '/root' : (user ? `/home/${user.email!.split('@')[0]}` : '/');
        const targetArg = args[0];
        if (!targetArg || targetArg === '~') {
          const node = getNodeFromPath(homeDir);
          if (node && node.type === 'directory') {
              setCwd(homeDir);
          } else {
              setCwd('/'); // Fallback to root if home doesn't exist
          }
          setIsProcessing(false);
          return '';
        }
        const newPath = resolvePath(cwd, targetArg);
        if (!hasPermission(newPath)) {
            setIsProcessing(false);
            return `cd: ${targetArg}: Permission denied`;
        }
        const node = getNodeFromPath(newPath);
        if (node && node.type === 'directory') {
          setCwd(newPath);
          setIsProcessing(false);
          return '';
        }
        setIsProcessing(false);
        return `cd: no such file or directory: ${targetArg}`;
      }
      
      case 'cat': {
        const targetFile = args[0];
        if (!targetFile) {
          setIsProcessing(false);
          return 'cat: missing operand';
        }
        const targetPath = resolvePath(cwd, targetFile);
        if (!hasPermission(targetPath)) {
          setIsProcessing(false);
          return `cat: ${targetFile}: Permission denied`;
        }
        const node = getNodeFromPath(targetPath);
        if (node && node.type === 'file') {
          setIsProcessing(false);
          return getDynamicContent(node.content);
        }
        setIsProcessing(false);
        return `cat: ${targetFile}: No such file or directory`;
      }

      case 'nano': {
        const targetFile = args[0];
        if (!targetFile) {
            setIsProcessing(false);
            return "nano: missing file operand";
        }
        const targetPath = resolvePath(cwd, targetFile);
        if (!hasPermission(targetPath, 'write')) {
            setIsProcessing(false);
            return `nano: cannot edit '${targetFile}': Permission denied`;
        }

        const node = getNodeFromPath(targetPath);
        let initialContent = '';
        if (node) {
            if (node.type === 'directory') {
                setIsProcessing(false);
                return `nano: ${targetFile}: is a directory`;
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
        const dbQuery = fullArgString.startsWith('"') && fullArgString.endsWith('"') ? fullArgString.slice(1, -1) : fullArgString;
        if (!dbQuery) {
          setIsProcessing(false);
          return 'db: missing query. Usage: db "your natural language query"';
        }
        try {
          const queryInstruction = await databaseQuery({ query: dbQuery });
          
          let whereClauses;

          if (queryInstruction.where) {
            whereClauses = queryInstruction.where.map(w => where(w[0], w[1] as WhereFilterOp, w[2]));
          } else {
            whereClauses = [];
          }
          
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

      case 'news': {
        const newsDir = getNodeFromPath('/var/news');
        if (!newsDir || newsDir.type !== 'directory') {
          setIsProcessing(false);
          return "News directory not found.";
        }
        const articles = Object.keys(newsDir.children).sort();
        const subCmd = args[0];
        
        // Handle reading article by number first
        const articleNum = parseInt(subCmd, 10);
        if (!isNaN(articleNum)) {
            const articleIndex = articleNum - 1;
            if (articleIndex >= 0 && articleIndex < articles.length) {
                const articleName = articles[articleIndex];
                const articleNode = newsDir.children[articleName];
                if (articleNode.type === 'file') {
                    setIsProcessing(false);
                    return getDynamicContent(articleNode.content);
                }
            } else {
                setIsProcessing(false);
                return `news: invalid article number: ${articleNum}`;
            }
        }
        
        // Root-only commands
        if (isRoot) {
            if (subCmd === 'add') {
                if (!newsAddMatch || !newsAddMatch[1]) {
                    setIsProcessing(false);
                    return 'Usage: news add "Title of The Article"';
                }
                const title = newsAddMatch[1];
                const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;
                const newFilePath = `/var/news/${filename}`;
                
                if (getNodeFromPath(newFilePath)) {
                    setIsProcessing(false);
                    return `Error: An article with a similar title already exists.`;
                }

                setEditingFile({ path: newFilePath, content: `TITLE: ${title}\nDATE: ${new Date().toISOString().split('T')[0]}\n\n` });
                setIsProcessing(false);
                return (
                    <NanoEditor
                        filename={newFilePath}
                        initialContent={`TITLE: ${title}\nDATE: ${new Date().toISOString().split('T')[0]}\n\n`}
                        onSave={(newContent) => {
                            updateNodeInFilesystem(newFilePath, newContent);
                            setEditingFile(null);
                        }}
                        onExit={() => setEditingFile(null)}
                    />
                );
            }

            if (subCmd === 'edit') {
                const editIndex = parseInt(args[1], 10) - 1;
                if (isNaN(editIndex) || editIndex < 0 || editIndex >= articles.length) {
                    setIsProcessing(false);
                    return `news: invalid article number for editing: ${args[1]}`;
                }
                const articleName = articles[editIndex];
                const articlePath = `/var/news/${articleName}`;
                const articleNode = getNodeFromPath(articlePath);

                if (articleNode && articleNode.type === 'file') {
                    const content = getDynamicContent(articleNode.content);
                    setEditingFile({ path: articlePath, content: content });
                    setIsProcessing(false);
                     return (
                        <NanoEditor
                            filename={articlePath}
                            initialContent={content}
                            onSave={(newContent) => {
                                updateNodeInFilesystem(articlePath, newContent);
                                setEditingFile(null);
                            }}
                            onExit={() => setEditingFile(null)}
                        />
                    );
                }
            }

            if (subCmd === 'del') {
                 const delIndex = parseInt(args[1], 10) - 1;
                 if (isNaN(delIndex) || delIndex < 0 || delIndex >= articles.length) {
                    setIsProcessing(false);
                    return `news: invalid article number for deletion: ${args[1]}`;
                 }
                 const articleName = articles[delIndex];
                 const articlePath = `/var/news/${articleName}`;
                 
                 setConfirmation({
                     message: `Are you sure you want to delete "${articleName}"?`,
                     onConfirm: async () => {
                         const success = removeNodeFromFilesystem(articlePath);
                         return success ? `Article "${articleName}" deleted.` : "Failed to delete article.";
                     },
                 });
                 setIsProcessing(false);
                 return '';
            }
        }
        
        // Default action: list articles if no valid subcommand is found or if it's not a root command
        if (!subCmd) {
          let output = "Available News:\n";
          articles.forEach((article, index) => {
            const node = newsDir.children[article];
            let title = article.replace(/-/g, ' ').replace('.txt', ''); // Fallback title
            if (node.type === 'file') {
                const content = getDynamicContent(node.content);
                const titleMatch = content.match(/^TITLE:\s*(.*)/);
                if (titleMatch) {
                    title = titleMatch[1];
                }
            }
            output += `[${index + 1}] ${title}\n`;
          });
          output += "\nType 'news <number>' to read an article.";
          setIsProcessing(false);
          return output;
        }

        setIsProcessing(false);
        return `news: invalid command: ${subCmd}. Type 'news' to see available articles.`;
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
          const userHome = user ? `/home/${user.email!.split('@')[0]}` : '/';
          const node = getNodeFromPath(userHome);
          setCwd(node && node.type === 'directory' ? userHome : '/');
          setIsProcessing(false);
          return '';
        }
        // If not root, logout is more appropriate. But for now, we do nothing.
        setIsProcessing(false);
        return '';
      }

      case 'logout': {
        await auth.signOut();
        setIsProcessing(false);
        // User state change will trigger welcome message
        return '';
      }
      
      case 'clear':
        // The component will handle this by clearing history. Return empty.
        setIsProcessing(false);
        return '';

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
  }, [authCommand, authStep, authCredentials, cwd, toast, user, resetAuth, isRoot, editingFile, confirmation]);

  return { 
    prompt, 
    processCommand, 
    getWelcomeMessage, 
    authStep,
    isProcessing,
    editingFile,
 };
};
