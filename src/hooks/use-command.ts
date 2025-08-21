
"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { generateCommandHelp } from '@/ai/flows/generate-command-help';
import { databaseQuery } from '@/ai/flows/database-query-flow';
import { concealMessage } from '@/ai/flows/steganography-flow';
import { revealMessage } from '@/ai/flows/steganography-flow';
import { investigateTarget } from '@/ai/flows/osint-investigation-flow';
import { craftPhish } from '@/ai/flows/craft-phish-flow';
import { generateWarlockTaunt } from '@/ai/flows/warlock-threat-flow';
import { forgeTool } from '@/ai/flows/forge-tool-flow';
import { analyzeImage } from '@/ai/flows/analyze-image-flow';
import { getNodeFromPath, getDynamicContent, updateNodeInFilesystem, removeNodeFromFilesystem, getWordlist, installPackage, isPackageInstalled, triggerRansomware, restoreBackup, addNodeToFilesystem } from '@/lib/filesystem';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, WhereFilterOp } from 'firebase/firestore';
import { User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import NanoEditor from '@/components/nano-editor';
import ImageDisplay from '@/components/image-display';
import md5 from 'md5';


const ROOT_USER_EMAIL = 'admin@cyber.dev';
let osintReportCache = ''; // Simple cache for OSINT report

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
  mkdir <dir>         - Create a directory.
  touch <file>        - Create an empty file.
  rm <file>           - Remove a file.
  rm -r <dir>         - Remove a directory.
  cat [file]          - Display file content.
  nano [file]         - Edit a file.
  generate_image "[p]"- Generate an image from a prompt.
  neofetch            - Display system information.
  db "[query]"        - Query the database (e.g., "list all users").
  news                - List or read news articles.
  crack <file> <hash> - Crack a hash using a wordlist file.
  reveal <file>       - Reveal a secret message from an image.
  conceal <file> "[m]"- Conceal a message in an image.
  osint <target>      - Perform OSINT on a target (e.g., an email).
  craft_phish <email> --topic "[t]" - Craft a phishing email.
  forge <file> "[p]"  - Forge a new tool with an AI prompt.
  analyze_image <url> - Use AI to run a forensic analysis on an image.
  clear               - Clear the terminal screen.
  logout              - Log out from the application.
`;
        if (isRoot) {
            helpText += `
Root-only commands:
  apt install <pkg>   - Install a package (e.g., 'nginx').
  restore_system <bak>- Restore system from a backup file.
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
  const [warlockAwareness, setWarlockAwareness] = useState(0);
  const [aliases, setAliases] = useState<{ [key: string]: string }>({});
  
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

  const loadAliases = useCallback(() => {
    const userHome = user ? `/home/${user.email!.split('@')[0]}` : null;
    const bashrcPath = userHome ? `${userHome}/.bashrc` : '/.bashrc';
    const bashrcNode = getNodeFromPath(bashrcPath);
    
    const defaultAliasNode = getNodeFromPath('/.bashrc');
    const newAliases: { [key: string]: string } = {};

    const parseAliases = (content: string) => {
        const lines = content.split('\n');
        lines.forEach(line => {
            const match = line.trim().match(/^alias\s+([^=]+)='([^']*)'/);
            if (match) {
            newAliases[match[1]] = match[2];
            }
        });
    };

    if (defaultAliasNode && defaultAliasNode.type === 'file') {
        parseAliases(getDynamicContent(defaultAliasNode.content));
    }
    if (bashrcNode && bashrcNode.type === 'file') {
        parseAliases(getDynamicContent(bashrcNode.content));
    }

    setAliases(newAliases);
  }, [user]);
  
  // Reset auth flow if user changes
  useEffect(() => {
    resetAuth();
    setIsRoot(false);
    osintReportCache = ''; // Clear OSINT cache on user change
    setWarlockAwareness(0);
    
    // On login, set CWD to user's home directory if it exists, otherwise to root
    if (user) {
        const userHome = `/home/${user.email!.split('@')[0]}`;
        const node = getNodeFromPath(userHome);
        if (node && node.type === 'directory') {
            setCwd(userHome);
        } else {
             // Create home directory if it doesn't exist
            addNodeToFilesystem(userHome, { type: 'directory', children: {} });
            addNodeToFilesystem(`${userHome}/.bashrc`, { type: 'file', content: '# User-specific aliases' });
            setCwd(userHome);
        }
    } else {
        setCwd('/');
    }
    loadAliases();
  }, [user, resetAuth, loadAliases]);


  const getWelcomeMessage = useCallback(() => {
    if (user) {
        if (user.email === ROOT_USER_EMAIL) {
            return `Welcome, administrator ${user.email}! You have root privileges. Type 'su' to elevate.`;
        }
        return `Welcome, ${user.email}! Type 'help' for a list of commands.`;
    }
    return `Welcome to Cyber! Please 'login' or 'register' to continue.`;
  }, [user]);

    const triggerWarlock = useCallback(async (action: string, awarenessIncrease: number): Promise<string | null> => {
        const newAwareness = Math.min(warlockAwareness + awarenessIncrease, 100);
        setWarlockAwareness(newAwareness);

        // Warlock only taunts if awareness crosses certain thresholds
        if ((warlockAwareness < 20 && newAwareness >= 20) || 
            (warlockAwareness < 50 && newAwareness >= 50) || 
            (warlockAwareness < 80 && newAwareness >= 80) ||
            newAwareness === 100) {
            try {
                const result = await generateWarlockTaunt({ action, awareness: newAwareness });
                return `\n\x1b[1;31mWarlock: ${result.taunt}\x1b[0m`;
            } catch (error) {
                console.error("Warlock taunt generation failed:", error);
                return null;
            }
        }
        return null;
    }, [warlockAwareness]);

    const exitEditor = useCallback(() => {
        setEditingFile(null);
        setIsProcessing(false);
    }, []);

    const saveFile = useCallback((newContent: string) => {
        if (editingFile) {
            updateNodeInFilesystem(editingFile.path, newContent);
            if (editingFile.onSaveCallback) {
                editingFile.onSaveCallback();
            }
            triggerWarlock(`Saved file ${editingFile.path}`, 10);
            toast({
              title: "File Saved",
              description: `Saved changes to ${editingFile.path}`,
            });
        }
    }, [editingFile, triggerWarlock, toast]);

  const processCommand = useCallback(async (command: string): Promise<string | React.ReactNode> => {
    if (editingFile) return ''; // Block commands while editing

    setIsProcessing(true);
    let warlockTaunt: string | null = null;

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

    let [cmd, ...args] = command.trim().split(/\s+/);
    
    // Alias expansion
    if (aliases[cmd]) {
        const aliasExpansion = aliases[cmd].split(/\s+/);
        cmd = aliasExpansion[0];
        args = [...aliasExpansion.slice(1), ...args];
    }

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
                warlockTaunt = await triggerWarlock(`User ${email} logged in`, 5);
                setIsProcessing(false);
                return message + (warlockTaunt || '');
            } catch (error: any) {
                resetAuth();
                warlockTaunt = await triggerWarlock(`Failed login for ${email}`, 10);
                setIsProcessing(false);
                return `Error: ${error.message}` + (warlockTaunt || '');
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
    
    const hasPermission = (path: string, operation: 'read' | 'write' = 'read') => {
        if (isRoot) return true;
        if (!user) return false;
        
        const userHome = `/home/${user.email!.split('@')[0]}`;

        if (operation === 'write') {
             // For write, must be within their own home directory.
             if (!path.startsWith(userHome + '/') && path !== userHome) {
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
        warlockTaunt = await triggerWarlock(`neofetch`, 1);
        setIsProcessing(false);
        return getNeofetchOutput(user, isRoot) + (warlockTaunt || '');
      
      case 'ls': {
        const targetPath = args[0] ? resolvePath(cwd, args[0]) : cwd;
        if (!hasPermission(targetPath)) {
            warlockTaunt = await triggerWarlock(`Denied ls on ${targetPath}`, 5);
            setIsProcessing(false);
            return `ls: cannot open directory '${args[0] || '.'}': Permission denied` + (warlockTaunt || '');
        }
        const node = getNodeFromPath(targetPath);
        if (node && node.type === 'directory') {
          setIsProcessing(false);
          return Object.keys(node.children).map(key => {
            const childNode = node.children[key];
            let name = key;
            if (childNode.type === 'directory') name = `\x1b[1;34m${key}/\x1b[0m`;
            // Check for ransomware extension
            if (key.endsWith('.deadbolt')) name = `\x1b[1;31m${key}\x1b[0m`;
            return name;
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
            warlockTaunt = await triggerWarlock(`Denied cd to ${newPath}`, 5);
            setIsProcessing(false);
            return `cd: ${targetArg}: Permission denied` + (warlockTaunt || '');
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
          warlockTaunt = await triggerWarlock(`Denied cat on ${targetPath}`, 5);
          setIsProcessing(false);
          return `cat: ${targetFile}: Permission denied` + (warlockTaunt || '');
        }
        const node = getNodeFromPath(targetPath);
        if (node && node.type === 'file') {
            // Check for logic bomb
            if (node.logicBomb && user) {
                const userHome = `/home/${user.email.split('@')[0]}`;
                const encryptedFiles = triggerRansomware(userHome);
                let output = `\x1b[1;31m[DEADBOLT RANSOMWARE ACTIVATED]\nInitializing encryption protocol...\n\n`;
                output += encryptedFiles.map(f => `Encrypting ${f}...`).join('\n');
                output += `\n\nEncryption complete. Your personal files are now hostage.\nCheck the ransom note in your home directory.`;
                warlockTaunt = await triggerWarlock(`User triggered ransomware!`, 100);
                setIsProcessing(false);
                return output + (warlockTaunt || '');
            }

            if (targetPath.includes('auth.log') || targetPath.includes('shadow.bak')) {
                warlockTaunt = await triggerWarlock(`cat on sensitive file ${targetFile}`, 15);
            } else {
                warlockTaunt = await triggerWarlock(`cat on ${targetFile}`, 2);
            }
            setIsProcessing(false);
            return getDynamicContent(node.content) + (warlockTaunt || '');
        }
        setIsProcessing(false);
        return `cat: ${targetFile}: No such file or directory`;
      }
      
      case 'mkdir': {
          const dirName = args[0];
          if (!dirName) {
              setIsProcessing(false);
              return "mkdir: missing operand";
          }
          const newDirPath = resolvePath(cwd, dirName);
          if (!hasPermission(newDirPath, 'write')) {
              warlockTaunt = await triggerWarlock(`Denied mkdir in ${cwd}`, 5);
              setIsProcessing(false);
              return `mkdir: cannot create directory '${dirName}': Permission denied` + (warlockTaunt || '');
          }
          if (getNodeFromPath(newDirPath)) {
              setIsProcessing(false);
              return `mkdir: cannot create directory '${dirName}': File exists`;
          }
          addNodeToFilesystem(newDirPath, { type: 'directory', children: {} });
          setIsProcessing(false);
          return '';
      }

      case 'touch': {
          const fileName = args[0];
          if (!fileName) {
              setIsProcessing(false);
              return "touch: missing file operand";
          }
          const newFilePath = resolvePath(cwd, fileName);
          if (!hasPermission(newFilePath, 'write')) {
              warlockTaunt = await triggerWarlock(`Denied touch in ${cwd}`, 5);
              setIsProcessing(false);
              return `touch: cannot touch '${fileName}': Permission denied` + (warlockTaunt || '');
          }
          const existingNode = getNodeFromPath(newFilePath);
          if (existingNode && existingNode.type === 'directory') {
              setIsProcessing(false);
              return `touch: cannot touch '${fileName}': Is a directory`;
          }
          // If file doesn't exist, create it. If it exists, do nothing (standard touch behavior).
          if (!existingNode) {
              addNodeToFilesystem(newFilePath, { type: 'file', content: '' });
          }
          setIsProcessing(false);
          return '';
      }

      case 'rm': {
          const isRecursive = args[0] === '-r';
          const targetName = isRecursive ? args[1] : args[0];

          if (!targetName) {
              setIsProcessing(false);
              return "rm: missing operand";
          }
          const targetPath = resolvePath(cwd, targetName);
          if (!hasPermission(targetPath, 'write')) {
              warlockTaunt = await triggerWarlock(`Denied rm on ${targetPath}`, 10);
              setIsProcessing(false);
              return `rm: cannot remove '${targetName}': Permission denied` + (warlockTaunt || '');
          }
          const node = getNodeFromPath(targetPath);
          if (!node) {
              setIsProcessing(false);
              return `rm: cannot remove '${targetName}': No such file or directory`;
          }
          if (node.type === 'directory' && !isRecursive) {
              setIsProcessing(false);
              return `rm: cannot remove '${targetName}': Is a directory`;
          }

          const success = removeNodeFromFilesystem(targetPath);
          if (success) {
              setIsProcessing(false);
              return '';
          } else {
              setIsProcessing(false);
              return `rm: could not remove '${targetName}'`;
          }
      }

      case 'nano': {
        const targetFile = args[0];
        if (!targetFile) {
            setIsProcessing(false);
            return "nano: missing file operand";
        }
        const targetPath = resolvePath(cwd, targetFile);
        if (!hasPermission(targetPath, 'write')) {
            warlockTaunt = await triggerWarlock(`Denied nano on ${targetPath}`, 5);
            setIsProcessing(false);
            return `nano: cannot edit '${targetFile}': Permission denied` + (warlockTaunt || '');
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
        
        let onSaveCallback;
        if (targetPath.endsWith('.bashrc')) {
            onSaveCallback = loadAliases;
        }
        
        setEditingFile({ path: targetPath, content: initialContent, onSaveCallback });
        setIsProcessing(true); // Keep processing until editor is closed
        return '';
      }
      
      case 'generate_image': {
            const imagePromptMatch = command.match(/^generate_image\s+"([^"]+)"/);
            if (!imagePromptMatch || !imagePromptMatch[1]) {
                setIsProcessing(false);
                return 'Usage: generate_image "your image prompt"';
            }
            const imagePrompt = imagePromptMatch[1];
            setIsProcessing(true); // Keep processing while image generates
            return (
                <ImageDisplay 
                    prompt={imagePrompt} 
                    onFinished={() => { setIsProcessing(false); }} 
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
          warlockTaunt = await triggerWarlock(`DB query: ${dbQuery}`, 10);
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
            return "No documents found." + (warlockTaunt || '');
          }
          
          const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setIsProcessing(false);
          return JSON.stringify(results, null, 2) + (warlockTaunt || '');

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
      
          // 1. Check for reading an article by number first.
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
              }
              setIsProcessing(false);
              return `news: invalid article number: ${articleNum}`;
          }
          
          // 2. Check for listing articles (no sub-command).
          if (!subCmd) {
              let output = "Available News:\n";
              articles.forEach((articleFilename, index) => {
                  const node = newsDir.children[articleFilename];
                  let title = articleFilename.replace(/\.txt$/, '').replace(/[-_]/g, ' ');
                  if (node.type === 'file') {
                      const content = getDynamicContent(node.content);
                      const titleMatch = content.match(/^TITLE:\s*(.*)/);
                      if (titleMatch && titleMatch[1]) {
                          title = titleMatch[1];
                      }
                  }
                  output += `[${index + 1}] ${title}\n`;
              });
              output += "\nType 'news <number>' to read an article.";
              setIsProcessing(false);
              return output;
          }
      
          // 3. Check for management commands (root only).
          if (isRoot) {
              switch (subCmd) {
                  case 'add': {
                      const titleMatch = command.match(/^news\s+add\s+"([^"]+)"/);
                      if (!titleMatch || !titleMatch[1]) {
                          setIsProcessing(false);
                          return 'Usage: news add "Title of The Article"';
                      }
                      const title = titleMatch[1];
                      const filename = `${Date.now()}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)}.txt`;
                      const newFilePath = `/var/news/${filename}`;
                      const content = `TITLE: ${title}\nDATE: ${new Date().toISOString().split('T')[0]}\n\n`;
      
                      setEditingFile({ path: newFilePath, content });
                      setIsProcessing(true);
                      return '';
                  }
                  case 'edit': {
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
                          setEditingFile({ path: articlePath, content });
                          setIsProcessing(true);
                          return '';
                      }
                      break;
                  }
                  case 'del': {
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
          }
      
          // 4. If none of the above, it's an invalid command.
          setIsProcessing(false);
          return `news: invalid command or insufficient permissions for '${subCmd}'. Type 'news' to see available articles.`;
      }
      
        case 'crack': {
            const [wordlistFile, hash] = args;
            if (!wordlistFile || !hash) {
                setIsProcessing(false);
                return "Usage: crack <wordlist_file> <hash>";
            }
            const wordlistPath = resolvePath(cwd, wordlistFile);
            if (!hasPermission(wordlistPath)) {
                setIsProcessing(false);
                return `crack: cannot open file '${wordlistFile}': Permission denied`;
            }
            
            const wordlist = getWordlist();
            if (!wordlist) {
                 setIsProcessing(false);
                 return `crack: wordlist file not found at default location.`;
            }
            
            warlockTaunt = await triggerWarlock(`Brute-force attempt with hash ${hash}`, 25);
            for (const password of wordlist) {
                if (md5(password) === hash) {
                    setIsProcessing(false);
                    return `Password found: ${password}` + (warlockTaunt || '');
                }
            }
            setIsProcessing(false);
            return "Password not found in wordlist." + (warlockTaunt || '');
        }

        case 'conceal': {
            const targetFile = args[0];
            const messageMatch = command.match(/conceal\s+\S+\s+"([^"]+)"/);
            if (!targetFile || !messageMatch) {
                setIsProcessing(false);
                return 'Usage: conceal <file> "your secret message"';
            }
            const message = messageMatch[1];
            const targetPath = resolvePath(cwd, targetFile);

            if (!hasPermission(targetPath, 'write')) {
                setIsProcessing(false);
                return `conceal: cannot write to '${targetFile}': Permission denied`;
            }

            const node = getNodeFromPath(targetPath);
            if (!node || node.type !== 'file' || !getDynamicContent(node.content).startsWith('data:image')) {
                setIsProcessing(false);
                return `conceal: '${targetFile}' is not a valid image file.`;
            }

            try {
                warlockTaunt = await triggerWarlock(`Steganography attempt on ${targetFile}`, 20);
                const result = await concealMessage({ imageDataUri: getDynamicContent(node.content), message });
                updateNodeInFilesystem(targetPath, result.newImageDataUri);
                setIsProcessing(false);
                return `Message concealed in ${targetFile}.` + (warlockTaunt || '');
            } catch (error: any) {
                setIsProcessing(false);
                return `Error: ${error.message}`;
            }
        }

        case 'reveal': {
            const targetFile = args[0];
            if (!targetFile) {
                setIsProcessing(false);
                return 'Usage: reveal <file>';
            }
            const targetPath = resolvePath(cwd, targetFile);
            if (!hasPermission(targetPath)) {
                setIsProcessing(false);
                return `reveal: cannot read '${targetFile}': Permission denied`;
            }

            const node = getNodeFromPath(targetPath);
             if (!node || node.type !== 'file' || !getDynamicContent(node.content).startsWith('data:image')) {
                setIsProcessing(false);
                return `reveal: '${targetFile}' is not a valid image file.`;
            }
            
            try {
                warlockTaunt = await triggerWarlock(`Steganography reveal on ${targetFile}`, 20);
                const result = await revealMessage({ imageDataUri: getDynamicContent(node.content) });
                setIsProcessing(false);
                return `Revealed message: ${result.revealedMessage}` + (warlockTaunt || '');
            } catch (error: any) {
                 setIsProcessing(false);
                return `Error: ${error.message}`;
            }
        }
        
        case 'osint': {
            const target = args[0];
            if (!target) {
                setIsProcessing(false);
                return 'Usage: osint <target_email_or_username>';
            }
            try {
                warlockTaunt = await triggerWarlock(`OSINT on ${target}`, 15);
                const result = await investigateTarget({ target });
                osintReportCache = result.report; // Cache the report
                setIsProcessing(false);
                return result.report + (warlockTaunt || '');
            } catch (error: any) {
                setIsProcessing(false);
                return `Error: ${error.message}`;
            }
        }

        case 'craft_phish': {
            const targetEmail = args[0];
            const topicMatch = command.match(/--topic\s+"([^"]+)"/);
            if (!targetEmail || !topicMatch) {
                setIsProcessing(false);
                return 'Usage: craft_phish <target_email> --topic "subject"';
            }
            const topic = topicMatch[1];
            try {
                warlockTaunt = await triggerWarlock(`Phishing craft for ${targetEmail}`, 20);
                const result = await craftPhish({ targetEmail, topic, context: osintReportCache });
                setIsProcessing(false);
                return result.phishingEmail + (warlockTaunt || '');
            } catch (error: any) {
                setIsProcessing(false);
                return `Error: ${error.message}`;
            }
        }

        case 'forge': {
            const forgeMatch = command.match(/^forge\s+(\S+)\s+"([^"]+)"/);
            if (!forgeMatch) {
                setIsProcessing(false);
                return 'Usage: forge <filename> "prompt describing the tool"';
            }
            const [, filename, userPrompt] = forgeMatch;
            const targetPath = resolvePath(cwd, filename);
        
            if (!hasPermission(targetPath, 'write')) {
                warlockTaunt = await triggerWarlock(`Denied forge on ${targetPath}`, 10);
                setIsProcessing(false);
                return `forge: cannot create file '${filename}': Permission denied` + (warlockTaunt || '');
            }
        
            try {
                warlockTaunt = await triggerWarlock(`Tool forging for ${filename}`, 30);
                toast({ title: "AI Tool Forge", description: `Generating code for ${filename}...` });
                const result = await forgeTool({ filename, prompt: userPrompt });
                updateNodeInFilesystem(targetPath, result.code);
                setIsProcessing(false);
                return `Successfully forged ${filename}. You can now run it or 'cat' its content.` + (warlockTaunt || '');
            } catch (error: any) {
                console.error("Tool forging failed:", error);
                toast({
                    variant: "destructive",
                    title: "Tool Forging Failed",
                    description: error.message,
                });
                setIsProcessing(false);
                return `Error: AI failed to forge the tool.`;
            }
        }
        
        case 'analyze_image': {
            const imageUrl = args[0];
            if (!imageUrl) {
                setIsProcessing(false);
                return 'Usage: analyze_image <image_url>';
            }
            
            try {
                warlockTaunt = await triggerWarlock(`Image analysis on ${imageUrl}`, 25);
                toast({ title: "Forensic Analysis", description: "AI is analyzing the image for clues..." });
                const result = await analyzeImage({ imageUrl });
                setIsProcessing(false);
                return `Forensic Report:\n----------------\n${result.analysis}` + (warlockTaunt || '');
            } catch (error: any) {
                console.error("Image analysis failed:", error);
                toast({
                    variant: "destructive",
                    title: "Image Analysis Failed",
                    description: error.message,
                });
                setIsProcessing(false);
                return `Error: AI failed to analyze the image.`;
            }
        }

        case 'apt': {
            if (!isRoot) {
                setIsProcessing(false);
                return `apt: command not found. Did you mean 'cat'?`;
            }
            const [subCmd, pkg] = args;
            if (subCmd !== 'install' || !pkg) {
                setIsProcessing(false);
                return `Usage: apt install <package>`;
            }
            if (pkg === 'nginx') {
                if (isPackageInstalled('nginx')) {
                    setIsProcessing(false);
                    return 'nginx is already the newest version (1.18.0-6ubuntu14.4).';
                }
                setConfirmation({
                    message: `The following NEW packages will be installed:\n  nginx nginx-common nginx-core\nAfter this operation, 8,192 kB of additional disk space will be used.\nDo you want to continue?`,
                    onConfirm: async () => {
                        installPackage('nginx');
                        warlockTaunt = await triggerWarlock(`Installed nginx`, 15);
                        return 'Setting up nginx (1.18.0-6ubuntu14.4) ...\nCreated symlink /etc/systemd/system/multi-user.target.wants/nginx.service → /lib/systemd/system/nginx.service.' + (warlockTaunt || '');
                    },
                });
                setIsProcessing(false);
                return '';
            } else {
                setIsProcessing(false);
                return `E: Unable to locate package ${pkg}`;
            }
        }

        case 'nginx': {
            const flag = args[0];
            if (isPackageInstalled('nginx')) {
                if (flag === '-v') {
                    setIsProcessing(false);
                    return 'nginx version: nginx/1.18.0 (Ubuntu)';
                }
                 if (flag === '-t') {
                    setIsProcessing(false);
                    return 'nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful';
                }
                 setIsProcessing(false);
                return 'Usage: nginx [-v | -t]';
            }
            // Fall through to default if not installed
        }
        
        case 'restore_system': {
            const backupFile = args[0];
            if (!isRoot) {
                setIsProcessing(false);
                return `restore_system: command not found.`;
            }
            if (!backupFile) {
                setIsProcessing(false);
                return "Usage: restore_system <backup_file>";
            }
            const backupPath = resolvePath(cwd, backupFile);
            const backupNode = getNodeFromPath(backupPath);
            if (backupPath !== '/var/backups/snapshot.tgz' || !backupNode) {
                setIsProcessing(false);
                return "restore_system: Backup file not found or invalid.";
            }

            setConfirmation({
                message: "Are you sure you want to restore the system from backup? This will overwrite user files.",
                onConfirm: async () => {
                    if (user) {
                        const userHome = `/home/${user.email.split('@')[0]}`;
                        const success = restoreBackup(userHome);
                        if (success) {
                            warlockTaunt = await triggerWarlock(`System restore initiated.`, -50);
                            return "System restored successfully from snapshot. Ransomware neutralized." + (warlockTaunt || '');
                        }
                    }
                    return "System restore failed. User context not found.";
                },
            });
            setIsProcessing(false);
            return '';
        }

      case 'su': {
        if (isRoot) {
            setIsProcessing(false);
            return "Already root.";
        }
        if (user?.email !== ROOT_USER_EMAIL) {
            warlockTaunt = await triggerWarlock(`Failed 'su' attempt`, 10);
            setIsProcessing(false);
            return "su: Permission denied." + (warlockTaunt || '');
        }
        setIsRoot(true);
        setCwd('/root');
        warlockTaunt = await triggerWarlock(`Root access granted`, 50);
        setIsProcessing(false);
        return '' + (warlockTaunt || '');
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
          warlockTaunt = await triggerWarlock(`Unrecognized command: ${cmd}`, 5);
          const result = await generateCommandHelp({ command: cmd });
          setIsProcessing(false);
          return result.helpMessage + (warlockTaunt || '');
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
  }, [authCommand, authStep, authCredentials, cwd, toast, user, resetAuth, isRoot, editingFile, confirmation, triggerWarlock, aliases, loadAliases, saveFile, exitEditor]);

  return { 
    prompt, 
    processCommand, 
    getWelcomeMessage, 
    authStep,
    isProcessing,
    editingFile,
    saveFile,
    exitEditor,
 };
};
