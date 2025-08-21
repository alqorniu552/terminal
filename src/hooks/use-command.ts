
"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { generateCommandHelp } from '@/ai/flows/generate-command-help';
import { databaseQuery } from '@/ai/flows/database-query-flow';
import { concealMessage, revealMessage } from '@/ai/flows/steganography-flow';
import { investigateTarget } from '@/ai/flows/osint-investigation-flow';
import { craftPhish } from '@/ai/flows/craft-phish-flow';
import { generateWarlockTaunt } from '@/ai/flows/warlock-threat-flow';
import { forgeTool } from '@/ai/flows/forge-tool-flow';
import { analyzeImage } from '@/ai/flows/analyze-image-flow';
import { generateAttackPlan } from '@/ai/flows/attack-planner-flow';
import { 
    getNodeFromPath, 
    getDynamicContent, 
    updateNodeInFilesystem, 
    removeNodeFromFilesystem, 
    getWordlist, 
    installPackage, 
    isPackageInstalled, 
    triggerRansomware, 
    restoreBackup, 
    addNodeToFilesystem,
    getMachine,
    network
} from '@/lib/filesystem';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, WhereFilterOp } from 'firebase/firestore';
import { User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import ImageDisplay from '@/components/image-display';
import md5 from 'md5';

const ROOT_USER_EMAIL = 'admin@cyber.dev';
let osintReportCache = '';

type CommandHandler = (args: string[], fullCommand: string) => Promise<string | React.ReactNode>;
type Command = { handler: CommandHandler; rootOnly: boolean };
type CommandMap = { [key: string]: Command };

const getNeofetchOutput = (user: User | null | undefined, isRoot: boolean, hostname: string) => {
    let uptime = 0;
    if (typeof window !== 'undefined') {
        uptime = Math.floor(performance.now() / 1000);
    }
    const username = isRoot ? 'root' : (user?.email?.split('@')[0] || 'guest');
    
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
    const hostInfo = `Host: ${hostname}`;
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
  ifconfig / ip a     - Display network configuration.
  nmap <ip>           - Scan a target for open ports.
  ssh <user@ip>       - Connect to a remote host.
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
  plan "[objective]"  - Generate a multi-step attack plan.
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
  const [currentHost, setCurrentHost] = useState(Object.keys(network)[0]);
  const [isRoot, setIsRoot] = useState(false);
  const [warlockAwareness, setWarlockAwareness] = useState(0);
  const [aliases, setAliases] = useState<{ [key: string]: string }>({});
  
  const [authCommand, setAuthCommand] = useState<'login' | 'register' | null>(null);
  const [authStep, setAuthStep] = useState<'email' | 'password' | 'ssh_password' | null>(null);
  const [authCredentials, setAuthCredentials] = useState({ email: '', password: '' });
  const [sshCredentials, setSshCredentials] = useState({ user: '', host: '', password: ''});
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmation, setConfirmation] = useState<{ message: string; onConfirm: () => Promise<string | React.ReactNode> } | null>(null);
  const [editingFile, setEditingFile] = useState<{ path: string; content: string; onSaveCallback?: () => void } | null>(null);
  
  const { toast } = useToast();

  const getInitialPrompt = useCallback(() => {
    if (confirmation) return `${confirmation.message} (y/n): `;
    if (authStep === 'email') return 'Email: ';
    if (authStep === 'password') return 'Password: ';
    if (authStep === 'ssh_password') return `Password for ${sshCredentials.user}@${sshCredentials.host}: `;
    
    const machine = getMachine(currentHost);
    const hostname = machine?.hostname || 'cyber';
    const userHome = user ? `/home/${user.email?.split('@')[0]}` : '/';
    const rootHome = '/root';
    
    let path;
    if (isRoot) {
      path = cwd === rootHome ? '~' : (cwd.startsWith(rootHome + '/') ? `~${cwd.substring(rootHome.length)}` : cwd);
    } else {
      path = cwd === userHome ? '~' : (cwd.startsWith(userHome + '/') ? `~${cwd.substring(userHome.length)}` : cwd);
    }
    
    path = path.replace('//', '/');
    if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
    if (path === '') path = '/';

    const endChar = isRoot ? '#' : '$';
    const username = isRoot ? 'root' : user?.email?.split('@')[0] || 'guest';
    
    return `${username}@${hostname}:${path}${endChar} `;
  }, [user, cwd, authStep, isRoot, confirmation, currentHost, sshCredentials]);

  const [prompt, setPrompt] = useState(getInitialPrompt());
  
  useEffect(() => {
    setPrompt(getInitialPrompt());
  }, [getInitialPrompt]);

  const hasPermission = useCallback((path: string, operation: 'read' | 'write' = 'read'): boolean => {
    if (isRoot) return true;
    if (!user) return false; // Guest has no permissions
    
    const rootHome = '/root';
    const userHome = `/home/${user.email!.split('@')[0]}`;
    
    if (operation === 'write') {
      // Allow write only within their own home directory or /tmp
      return path.startsWith(userHome) || path.startsWith('/tmp');
    }
    
    // Read operation
    if (path.startsWith(rootHome)) return false;
    
    const parts = path.split('/').filter(p => p);
    if (parts[0] === 'home' && parts.length > 1 && parts[1] !== user.email!.split('@')[0]) {
      // Deny reading other users' home directories
      return false;
    }
    
    return true;
  }, [isRoot, user]);


  const triggerWarlock = useCallback(async (action: string, awarenessIncrease: number): Promise<string | null> => {
    const newAwareness = Math.min(warlockAwareness + awarenessIncrease, 100);
    setWarlockAwareness(newAwareness);
    if ((warlockAwareness < 20 && newAwareness >= 20) || 
        (warlockAwareness < 50 && newAwareness >= 50) || 
        (warlockAwareness < 80 && newAwareness >= 80) ||
        newAwareness === 100) {
      try {
        const result = await generateWarlockTaunt({ action, awareness: newAwareness });
        return `\n\x1b[1;31mWarlock: ${result.taunt}\x1b[0m`;
      } catch (error) {
        console.error("Warlock taunt generation failed:", error);
      }
    }
    return null;
  }, [warlockAwareness]);

  const exitEditor = useCallback(() => {
    setEditingFile(null);
  }, []);

  const saveFile = useCallback((newContent: string) => {
    if (editingFile) {
      updateNodeInFilesystem(editingFile.path, newContent, currentHost);
      if (editingFile.onSaveCallback) {
        editingFile.onSaveCallback();
      }
      triggerWarlock(`Saved file ${editingFile.path}`, 10);
      toast({ title: "File Saved", description: `Saved changes to ${editingFile.path}` });
    }
  }, [editingFile, currentHost, triggerWarlock, toast]);
  
  const resetAuth = useCallback(() => {
    setAuthCommand(null);
    setAuthStep(null);
    setAuthCredentials({ email: '', password: '' });
    setSshCredentials({ user: '', host: '', password: ''});
  }, []);
  
  const loadAliases = useCallback(() => {
    const userHome = user ? `/home/${user.email!.split('@')[0]}` : null;
    const bashrcPath = userHome ? `${userHome}/.bashrc` : '/.bashrc';
    const bashrcNode = getNodeFromPath(bashrcPath, currentHost);
    
    const defaultAliasNode = getNodeFromPath('/.bashrc', currentHost);
    const newAliases: { [key: string]: string } = {};

    const parseAliases = (content: string) => {
      content.split('\n').forEach(line => {
        const match = line.trim().match(/^alias\s+([^=]+)='([^']*)'/);
        if (match) newAliases[match[1]] = match[2];
      });
    };

    if (defaultAliasNode?.type === 'file') parseAliases(getDynamicContent(defaultAliasNode.content));
    if (bashrcNode?.type === 'file') parseAliases(getDynamicContent(bashrcNode.content));
    setAliases(newAliases);
  }, [user, currentHost]);
  
  useEffect(() => {
    resetAuth();
    setIsRoot(false);
    setCurrentHost(Object.keys(network)[0]);
    osintReportCache = '';
    setWarlockAwareness(0);
    if (user) {
      const userHome = `/home/${user.email!.split('@')[0]}`;
      // Ensure user home directory exists on registration/login
      if (!getNodeFromPath(userHome, currentHost)) {
          addNodeToFilesystem(userHome, { type: 'directory', children: {} }, currentHost);
          addNodeToFilesystem(`${userHome}/.bashrc`, { type: 'file', content: '# User-specific aliases\n' }, currentHost);
      }
      setCwd(userHome);
    } else {
      setCwd('/');
    }
    loadAliases();
  }, [user, resetAuth, loadAliases, currentHost]);


  const getWelcomeMessage = useCallback(() => {
    if (user) {
      if (user.email === ROOT_USER_EMAIL) return `Welcome, administrator ${user.email}! You have root privileges. Type 'su' to elevate.`;
      return `Welcome, ${user.email}! Type 'help' for a list of commands.`;
    }
    return `Welcome to Cyber! Please 'login' or 'register' to continue.`;
  }, [user]);

  // Command Handlers
  const handleHelp = async (): Promise<string> => getHelpOutput(!!user, isRoot);
  const handleNeofetch = async (): Promise<string> => {
    const machine = getMachine(currentHost);
    const taunt = await triggerWarlock('neofetch', 1);
    return getNeofetchOutput(user, isRoot, machine?.hostname || 'cyber') + (taunt || '');
  };
  const handleLs = async (args: string[]): Promise<string> => {
    const targetPath = args[0] ? resolvePath(cwd, args[0]) : cwd;
    if (!hasPermission(targetPath)) {
      const taunt = await triggerWarlock(`Denied ls on ${targetPath}`, 5);
      return `ls: cannot open directory '${args[0] || '.'}': Permission denied` + (taunt || '');
    }
    const node = getNodeFromPath(targetPath, currentHost);
    if (node?.type === 'directory') {
      return Object.keys(node.children).map(key => {
        const childNode = node.children[key];
        let name = key;
        if (childNode.type === 'directory') name = `\x1b[1;34m${key}/\x1b[0m`;
        if (key.endsWith('.deadbolt')) name = `\x1b[1;31m${key}\x1b[0m`;
        return name;
      }).join('\n');
    }
    return `ls: cannot access '${args[0] || '.'}': No such file or directory`;
  };
  const handleCd = async (args: string[]): Promise<string> => {
    const homeDir = isRoot ? '/root' : (user ? `/home/${user.email!.split('@')[0]}` : '/');
    const targetArg = args[0];
    if (!targetArg || targetArg === '~') {
      const node = getNodeFromPath(homeDir, currentHost);
      setCwd(node?.type === 'directory' ? homeDir : '/');
      return '';
    }
    const newPath = resolvePath(cwd, targetArg);
    if (!hasPermission(newPath)) {
      const taunt = await triggerWarlock(`Denied cd to ${newPath}`, 5);
      return `cd: ${targetArg}: Permission denied` + (taunt || '');
    }
    const node = getNodeFromPath(newPath, currentHost);
    if (node?.type === 'directory') {
      setCwd(newPath);
      return '';
    }
    return `cd: no such file or directory: ${targetArg}`;
  };
  const handleCat = async (args: string[]): Promise<string> => {
    const targetFile = args[0];
    if (!targetFile) return 'cat: missing operand';
    const targetPath = resolvePath(cwd, targetFile);
    if (!hasPermission(targetPath)) {
      const taunt = await triggerWarlock(`Denied cat on ${targetPath}`, 5);
      return `cat: ${targetFile}: Permission denied` + (taunt || '');
    }
    const node = getNodeFromPath(targetPath, currentHost);
    if (node?.type === 'file') {
      if (node.logicBomb && user) {
        const userHome = `/home/${user.email!.split('@')[0]}`;
        const encryptedFiles = triggerRansomware(userHome, currentHost);
        let output = `\x1b[1;31m[DEADBOLT RANSOMWARE ACTIVATED]\nInitializing encryption protocol...\n\n`;
        output += encryptedFiles.map(f => `Encrypting ${f}...`).join('\n');
        output += `\n\nEncryption complete. Your personal files are now hostage.\nCheck the ransom note in your home directory.`;
        const taunt = await triggerWarlock('User triggered ransomware!', 100);
        return output + (taunt || '');
      }
      const taunt = await triggerWarlock(`cat on ${targetFile}`, targetPath.includes('auth.log') || targetPath.includes('shadow.bak') ? 15 : 2);
      return getDynamicContent(node.content) + (taunt || '');
    }
    return `cat: ${targetFile}: No such file or directory`;
  };
  const handleMkdir = async (args: string[]): Promise<string> => {
    const dirName = args[0];
    if (!dirName) return "mkdir: missing operand";
    const newDirPath = resolvePath(cwd, dirName);
    if (!hasPermission(newDirPath, 'write')) {
      const taunt = await triggerWarlock(`Denied mkdir in ${cwd}`, 5);
      return `mkdir: cannot create directory '${dirName}': Permission denied` + (taunt || '');
    }
    if (getNodeFromPath(newDirPath, currentHost)) return `mkdir: cannot create directory '${dirName}': File exists`;
    addNodeToFilesystem(newDirPath, { type: 'directory', children: {} }, currentHost);
    return '';
  };
  const handleTouch = async (args: string[]): Promise<string> => {
    const fileName = args[0];
    if (!fileName) return "touch: missing file operand";
    const newFilePath = resolvePath(cwd, fileName);
    if (!hasPermission(newFilePath, 'write')) {
      const taunt = await triggerWarlock(`Denied touch in ${cwd}`, 5);
      return `touch: cannot touch '${fileName}': Permission denied` + (taunt || '');
    }
    const existingNode = getNodeFromPath(newFilePath, currentHost);
    if (existingNode?.type === 'directory') return `touch: cannot touch '${fileName}': Is a directory`;
    if (!existingNode) addNodeToFilesystem(newFilePath, { type: 'file', content: '' }, currentHost);
    return '';
  };
  const handleRm = async (args: string[]): Promise<string> => {
    const isRecursive = args[0] === '-r';
    const targetName = isRecursive ? args[1] : args[0];
    if (!targetName) return "rm: missing operand";
    const targetPath = resolvePath(cwd, targetName);
    if (!hasPermission(targetPath, 'write')) {
      const taunt = await triggerWarlock(`Denied rm on ${targetPath}`, 10);
      return `rm: cannot remove '${targetName}': Permission denied` + (taunt || '');
    }
    const node = getNodeFromPath(targetPath, currentHost);
    if (!node) return `rm: cannot remove '${targetName}': No such file or directory`;
    if (node.type === 'directory' && !isRecursive) return `rm: cannot remove '${targetName}': Is a directory`;
    return removeNodeFromFilesystem(targetPath, currentHost) ? '' : `rm: could not remove '${targetName}'`;
  };
  const handleNano = async (args: string[]): Promise<string | React.ReactNode> => {
    const targetFile = args[0];
    if (!targetFile) return "nano: missing file operand";
    const targetPath = resolvePath(cwd, targetFile);
    if (!hasPermission(targetPath, 'write')) {
      const taunt = await triggerWarlock(`Denied nano on ${targetPath}`, 5);
      return `nano: cannot edit '${targetFile}': Permission denied` + (taunt || '');
    }
    const node = getNodeFromPath(targetPath, currentHost);
    if (node?.type === 'directory') return `nano: ${targetFile}: is a directory`;
    
    const initialContent = node ? getDynamicContent(node.content) : '';
    setEditingFile({ 
        path: targetPath, 
        content: initialContent, 
        onSaveCallback: targetPath.endsWith('.bashrc') ? loadAliases : undefined 
    });
    return null; // Null indicates to Terminal component to render Nano
  };
  const handleGenerateImage = async (_: string[], fullCommand: string): Promise<string | React.ReactNode> => {
    const match = fullCommand.match(/^generate_image\s+"([^"]+)"/);
    if (!match?.[1]) return 'Usage: generate_image "your image prompt"';
    return <ImageDisplay prompt={match[1]} onFinished={() => setIsProcessing(false)} />;
  };
  const handleDb = async (_: string[], fullCommand: string): Promise<string> => {
    const match = fullCommand.match(/^db\s+"([^"]+)"/);
    const dbQuery = match ? match[1] : fullCommand.substring(3).trim();
    if (!dbQuery) return 'db: missing query. Usage: db "your natural language query"';
    try {
      const taunt = await triggerWarlock(`DB query: ${dbQuery}`, 10);
      const instruction = await databaseQuery({ query: dbQuery });
      const clauses = instruction.where ? instruction.where.map(w => where(w[0], w[1] as WhereFilterOp, w[2])) : [];
      const q = query(collection(db, instruction.collection), ...clauses);
      const snapshot = await getDocs(q);
      if (snapshot.empty) return "No documents found." + (taunt || '');
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return JSON.stringify(results, null, 2) + (taunt || '');
    } catch (error) {
      console.error('Database query failed:', error);
      toast({ variant: "destructive", title: "Database Query Error", description: "Could not process your database query." });
      return `Error: Could not query database.`;
    }
  };
  const handleNews = async (args: string[], fullCommand: string): Promise<string | React.ReactNode> => {
    const newsDir = getNodeFromPath('/var/news', currentHost);
    if (newsDir?.type !== 'directory') return "News directory not found.";
    const articles = Object.keys(newsDir.children).sort();
    const subCmd = args[0];
    
    const articleNum = parseInt(subCmd, 10);
    if (!isNaN(articleNum)) {
      const index = articleNum - 1;
      if (index >= 0 && index < articles.length) {
        const node = newsDir.children[articles[index]];
        if (node.type === 'file') return getDynamicContent(node.content);
      }
      return `news: invalid article number: ${articleNum}`;
    }
    
    if (!subCmd) {
      let output = "Available News:\n";
      articles.forEach((name, index) => {
        const node = newsDir.children[name];
        let title = name.replace(/\.txt$/, '').replace(/[-_]/g, ' ');
        if (node.type === 'file') {
          const content = getDynamicContent(node.content);
          const titleMatch = content.match(/^TITLE:\s*(.*)/);
          if (titleMatch?.[1]) title = titleMatch[1];
        }
        output += `[${index + 1}] ${title}\n`;
      });
      return output + "\nType 'news <number>' to read an article.";
    }

    if (isRoot) {
      switch (subCmd) {
        case 'add': {
          const match = fullCommand.match(/^news\s+add\s+"([^"]+)"/);
          if (!match?.[1]) return 'Usage: news add "Title"';
          const title = match[1];
          const filename = `${Date.now()}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50)}.txt`;
          const path = `/var/news/${filename}`;
          const content = `TITLE: ${title}\nDATE: ${new Date().toISOString().split('T')[0]}\n\n`;
          setEditingFile({ path, content });
          return null;
        }
        case 'edit': {
          const index = parseInt(args[1], 10) - 1;
          if (isNaN(index) || index < 0 || index >= articles.length) return `news: invalid article number: ${args[1]}`;
          const path = `/var/news/${articles[index]}`;
          const node = getNodeFromPath(path, currentHost);
          if (node?.type === 'file') {
            setEditingFile({ path, content: getDynamicContent(node.content) });
            return null;
          }
          break;
        }
        case 'del': {
          const index = parseInt(args[1], 10) - 1;
          if (isNaN(index) || index < 0 || index >= articles.length) return `news: invalid article number: ${args[1]}`;
          const articleName = articles[index];
          const path = `/var/news/${articleName}`;
          setConfirmation({
            message: `Are you sure you want to delete "${articleName}"?`,
            onConfirm: async () => removeNodeFromFilesystem(path, currentHost) ? `Article "${articleName}" deleted.` : "Failed to delete article.",
          });
          return '';
        }
      }
    }

    return `news: invalid command or insufficient permissions for '${subCmd}'.`;
  };
  const handleCrack = async (args: string[]): Promise<string> => {
    const [wordlistFile, hash] = args;
    if (!wordlistFile || !hash) return "Usage: crack <wordlist_file> <hash>";
    const wordlistPath = resolvePath(cwd, wordlistFile);
    if (!hasPermission(wordlistPath)) return `crack: cannot open file '${wordlistFile}': Permission denied`;
    const wordlist = getWordlist(currentHost);
    if (!wordlist) return `crack: wordlist file not found at default location.`;
    const taunt = await triggerWarlock(`Brute-force attempt with hash ${hash}`, 25);
    for (const password of wordlist) if (md5(password) === hash) return `Password found: ${password}` + (taunt || '');
    return "Password not found in wordlist." + (taunt || '');
  };
  const handleConceal = async (args: string[], fullCommand: string): Promise<string> => {
    const targetFile = args[0];
    const match = fullCommand.match(/conceal\s+\S+\s+"([^"]+)"/);
    if (!targetFile || !match) return 'Usage: conceal <file> "your secret message"';
    const message = match[1];
    const path = resolvePath(cwd, targetFile);
    if (!hasPermission(path, 'write')) return `conceal: cannot write to '${targetFile}': Permission denied`;
    const node = getNodeFromPath(path, currentHost);
    if (node?.type !== 'file' || !getDynamicContent(node.content).startsWith('data:image')) return `conceal: '${targetFile}' is not a valid image file.`;
    try {
      const taunt = await triggerWarlock(`Steganography attempt on ${targetFile}`, 20);
      const result = await concealMessage({ imageDataUri: getDynamicContent(node.content), message });
      updateNodeInFilesystem(path, result.newImageDataUri, currentHost);
      return `Message concealed in ${targetFile}.` + (taunt || '');
    } catch (e: any) { return `Error: ${e.message}`; }
  };
  const handleReveal = async (args: string[]): Promise<string> => {
    const targetFile = args[0];
    if (!targetFile) return 'Usage: reveal <file>';
    const path = resolvePath(cwd, targetFile);
    if (!hasPermission(path)) return `reveal: cannot read '${targetFile}': Permission denied`;
    const node = getNodeFromPath(path, currentHost);
    if (node?.type !== 'file' || !getDynamicContent(node.content).startsWith('data:image')) return `reveal: '${targetFile}' is not a valid image file.`;
    try {
      const taunt = await triggerWarlock(`Steganography reveal on ${targetFile}`, 20);
      const result = await revealMessage({ imageDataUri: getDynamicContent(node.content) });
      return `Revealed message: ${result.revealedMessage}` + (taunt || '');
    } catch (e: any) { return `Error: ${e.message}`; }
  };
  const handleOsint = async (args: string[]): Promise<string> => {
    const target = args[0];
    if (!target) return 'Usage: osint <target_email_or_username>';
    try {
      const taunt = await triggerWarlock(`OSINT on ${target}`, 15);
      const result = await investigateTarget({ target });
      osintReportCache = result.report;
      return result.report + (taunt || '');
    } catch (e: any) { return `Error: ${e.message}`; }
  };
  const handleCraftPhish = async (args: string[], fullCommand: string): Promise<string> => {
    const targetEmail = args[0];
    const match = fullCommand.match(/--topic\s+"([^"]+)"/);
    if (!targetEmail || !match) return 'Usage: craft_phish <email> --topic "subject"';
    const topic = match[1];
    try {
      const taunt = await triggerWarlock(`Phishing craft for ${targetEmail}`, 20);
      const result = await craftPhish({ targetEmail, topic, context: osintReportCache });
      return result.phishingEmail + (taunt || '');
    } catch (e: any) { return `Error: ${e.message}`; }
  };
  const handleForge = async (_: string[], fullCommand: string): Promise<string> => {
    const match = fullCommand.match(/^forge\s+(\S+)\s+"([^"]+)"/);
    if (!match) return 'Usage: forge <filename> "prompt for tool"';
    const [, filename, userPrompt] = match;
    const path = resolvePath(cwd, filename);
    if (!hasPermission(path, 'write')) {
      const taunt = await triggerWarlock(`Denied forge on ${path}`, 10);
      return `forge: cannot create file '${filename}': Permission denied` + (taunt || '');
    }
    try {
      const taunt = await triggerWarlock(`Tool forging for ${filename}`, 30);
      toast({ title: "AI Tool Forge", description: `Generating code for ${filename}...` });
      const result = await forgeTool({ filename, prompt: userPrompt });
      updateNodeInFilesystem(path, result.code, currentHost);
      return `Successfully forged ${filename}.` + (taunt || '');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Tool Forging Failed", description: e.message });
      return `Error: AI failed to forge the tool.`;
    }
  };
  const handleAnalyzeImage = async (args: string[]): Promise<string> => {
    const imageUrl = args[0];
    if (!imageUrl) return 'Usage: analyze_image <image_url>';
    try {
      const taunt = await triggerWarlock(`Image analysis on ${imageUrl}`, 25);
      toast({ title: "Forensic Analysis", description: "AI is analyzing the image..." });
      const result = await analyzeImage({ imageUrl });
      return `Forensic Report:\n----------------\n${result.analysis}` + (taunt || '');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Image Analysis Failed", description: e.message });
      return `Error: AI failed to analyze the image.`;
    }
  };
  const handleApt = async (args: string[]): Promise<string> => {
    const [subCmd, pkg] = args;
    if (subCmd !== 'install' || !pkg) return 'Usage: apt install <package>';
    if (pkg === 'nginx') {
      if (isPackageInstalled('nginx', currentHost)) return 'nginx is already the newest version (1.18.0).';
      setConfirmation({
        message: `The following NEW packages will be installed:\n  nginx nginx-common nginx-core\nDo you want to continue?`,
        onConfirm: async () => {
          installPackage('nginx', currentHost);
          const taunt = await triggerWarlock('Installed nginx', 15);
          return 'Setting up nginx (1.18.0)... Done.' + (taunt || '');
        },
      });
      return '';
    }
    return `E: Unable to locate package ${pkg}`;
  };
  const handleNginx = async (args: string[]): Promise<string> => {
    const flag = args[0];
    if (isPackageInstalled('nginx', currentHost)) {
      if (flag === '-v') return 'nginx version: nginx/1.18.0 (Ubuntu)';
      if (flag === '-t') return 'nginx: configuration file /etc/nginx/nginx.conf test is successful';
      return 'Usage: nginx [-v | -t]';
    }
    return `Command 'nginx' not found, but can be installed with: apt install nginx`;
  };
  const handleRestoreSystem = async (args: string[]): Promise<string> => {
    const backupFile = args[0];
    if (!backupFile) return "Usage: restore_system <backup_file>";
    const path = resolvePath(cwd, backupFile);
    if (path !== '/var/backups/snapshot.tgz' || !getNodeFromPath(path, currentHost)) return "restore_system: Backup file not found or invalid.";
    setConfirmation({
      message: "Are you sure you want to restore the system from backup?",
      onConfirm: async () => {
        if (user) {
          const success = restoreBackup(`/home/${user.email!.split('@')[0]}`, currentHost);
          if (success) {
            const taunt = await triggerWarlock('System restore initiated.', -50);
            return "System restored from snapshot. Ransomware neutralized." + (taunt || '');
          }
        }
        return "System restore failed. User context not found.";
      },
    });
    return '';
  };
  const handleIp = async (args: string[]): Promise<string> => {
    if (args[0] !== 'a' && args[0] !== 'addr') return handleAICommand('ip', args);
    const machine = getMachine(currentHost);
    if (machine) {
      return `eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST> mtu 1500
      inet ${machine.ip} netmask 255.255.255.0 broadcast 192.168.1.255
      ether 00:1a:2b:3c:4d:5e txqueuelen 1000 (Ethernet)`;
    }
    return 'Error: Could not determine network configuration.';
  };
  const handleIfconfig = async (): Promise<string> => handleIp([], '');
  const handleNmap = async (args: string[]): Promise<string> => {
    const targetIp = args[0];
    if (!targetIp) return 'Usage: nmap <target_ip>';
    const machine = getMachine(targetIp);
    if (!machine) return `Host discovery disabled (-Pn). All ports on ${targetIp} are in ignored states.`;
    let output = `Starting Nmap 7.80 ( https://nmap.org ) at ${new Date().toUTCString()}\n`;
    output += `Nmap scan report for ${machine.hostname} (${machine.ip})\n`;
    output += `Host is up (0.0020s latency).\nNot showing: ${1000 - machine.openPorts.length} closed ports\n`;
    output += 'PORT   STATE SERVICE\n';
    machine.openPorts.forEach(port => {
      const service = { 21: 'ftp', 22: 'ssh', 80: 'http', 443: 'https' }[port] || 'unknown';
      output += `${port}/tcp open  ${service}\n`;
    });
    return output;
  };
  const handleSsh = async (args: string[]): Promise<string> => {
    const target = args[0];
    if (!target?.includes('@')) return 'Usage: ssh <user@host>';
    const [sshUser, sshHost] = target.split('@');
    const machine = getMachine(sshHost);
    if (!machine) return `ssh: Could not resolve hostname ${sshHost}: Name or service not known`;
    if (machine.credentials[sshUser] !== undefined) {
      setAuthStep('ssh_password');
      setSshCredentials({ user: sshUser, host: sshHost, password: '' });
      return '';
    }
    return 'Permission denied (publickey,password).';
  };
  const handleSu = async (): Promise<string> => {
    if (isRoot) return "Already root.";
    if (user?.email !== ROOT_USER_EMAIL) {
      const taunt = await triggerWarlock(`Failed 'su' attempt`, 10);
      return "su: Permission denied." + (taunt || '');
    }
    setIsRoot(true);
    setCwd('/root');
    const taunt = await triggerWarlock('Root access granted', 50);
    return '' + (taunt || '');
  };
  const handleExit = async (): Promise<string> => {
    if (currentHost !== Object.keys(network)[0]) {
      setCurrentHost(Object.keys(network)[0]);
      const userHome = user ? `/home/${user.email!.split('@')[0]}` : '/';
      setCwd(userHome);
      setIsRoot(false);
      return 'Connection to remote host closed.';
    }
    if (isRoot) {
      setIsRoot(false);
      const userHome = user ? `/home/${user.email!.split('@')[0]}` : '/';
      setCwd(userHome);
      return '';
    }
    return '';
  };
  const handleLogout = async (): Promise<string | null> => { 
      await auth.signOut(); 
      return null; 
  };
  const handlePlan = async (_: string[], fullCommand: string): Promise<string> => {
    const match = fullCommand.match(/^plan\s+"([^"]+)"/);
    const objective = match ? match[1] : fullCommand.substring(5).trim();
    if (!objective) return 'Usage: plan "[objective]"';
    const node = getNodeFromPath(cwd, currentHost);
    const availableFiles = node?.type === 'directory' ? Object.keys(node.children) : [];
    const result = await generateAttackPlan({ target: currentHost, objective, availableFiles });
    let planOutput = `Attack Plan Reasoning: ${result.reasoning}\n\nCommands:\n`;
    result.plan.forEach((step, index) => {
      planOutput += `${index + 1}. ${step.command} ${step.args.join(' ')}\n`;
    });
    return planOutput;
  };
  const handleAICommand = async (cmd: string, args: string[]): Promise<string> => {
    try {
      const taunt = await triggerWarlock(`Unrecognized command: ${cmd}`, 5);
      const result = await generateCommandHelp({ command: cmd, args });
      return result.helpMessage + (taunt || '');
    } catch (error: any) {
      toast({ variant: "destructive", title: "AI Assistant Error", description: "Could not get help." });
      return `command not found: ${cmd}`;
    }
  };

  const commands: CommandMap = {
    help: { handler: handleHelp, rootOnly: false },
    neofetch: { handler: handleNeofetch, rootOnly: false },
    ls: { handler: handleLs, rootOnly: false },
    cd: { handler: handleCd, rootOnly: false },
    cat: { handler: handleCat, rootOnly: false },
    mkdir: { handler: handleMkdir, rootOnly: false },
    touch: { handler: handleTouch, rootOnly: false },
    rm: { handler: handleRm, rootOnly: false },
    nano: { handler: handleNano, rootOnly: false },
    generate_image: { handler: handleGenerateImage, rootOnly: false },
    db: { handler: handleDb, rootOnly: false },
    news: { handler: handleNews, rootOnly: false },
    crack: { handler: handleCrack, rootOnly: false },
    conceal: { handler: handleConceal, rootOnly: false },
    reveal: { handler: handleReveal, rootOnly: false },
    osint: { handler: handleOsint, rootOnly: false },
    craft_phish: { handler: handleCraftPhish, rootOnly: false },
    forge: { handler: handleForge, rootOnly: false },
    analyze_image: { handler: handleAnalyzeImage, rootOnly: false },
    ip: { handler: handleIp, rootOnly: false },
    ifconfig: { handler: handleIfconfig, rootOnly: false },
    nmap: { handler: handleNmap, rootOnly: false },
    ssh: { handler: handleSsh, rootOnly: false },
    su: { handler: handleSu, rootOnly: false },
    exit: { handler: handleExit, rootOnly: false },
    logout: { handler: handleLogout, rootOnly: false },
    plan: { handler: handlePlan, rootOnly: false },
    nginx: { handler: handleNginx, rootOnly: false },
    apt: { handler: handleApt, rootOnly: true },
    restore_system: { handler: handleRestoreSystem, rootOnly: true },
  };

  const processCommand = useCallback(async (command: string): Promise<string | React.ReactNode | null> => {
    setIsProcessing(true);
    let result: string | React.ReactNode | null = '';

    if (confirmation) {
      const response = command.trim().toLowerCase();
      const { onConfirm } = confirmation;
      setConfirmation(null);
      result = (response === 'y' || response === 'yes') ? await onConfirm() : 'Operation cancelled.';
    } else if (authStep) {
      if (command.trim().toLowerCase() === 'exit') {
        resetAuth();
      } else if (authStep === 'email') {
        setAuthCredentials({ ...authCredentials, email: command.trim() });
        setAuthStep('password');
        result = '';
      } else if (authStep === 'password') {
        const { email } = authCredentials;
        const password = command.trim();
        const authFn = authCommand === 'login' ? signInWithEmailAndPassword : createUserWithEmailAndPassword;
        try {
          const userCredential = await authFn(auth, email, password);
          if (authCommand === 'register') {
            const userHome = `/home/${userCredential.user.email!.split('@')[0]}`;
            addNodeToFilesystem(userHome, { type: 'directory', children: {} }, currentHost);
          }
          result = authCommand === 'login' ? 'Login successful.' : 'Registration successful.';
          const taunt = await triggerWarlock(`User ${email} logged in`, 5);
          if (taunt) result += taunt;
        } catch (error: any) {
          result = `Error: ${error.message}`;
          const taunt = await triggerWarlock(`Failed login for ${email}`, 10);
          if (taunt) result += taunt;
        }
        resetAuth();
      } else if (authStep === 'ssh_password') {
        const { user: sshUser, host: sshHost } = sshCredentials;
        const machine = getMachine(sshHost);
        if (machine?.credentials[sshUser] === command.trim()) {
          setCurrentHost(sshHost);
          setCwd(sshUser === 'root' ? '/root' : `/home/${sshUser}`);
          setIsRoot(sshUser === 'root');
          result = `Connected to ${sshHost}.`;
        } else {
          result = 'Permission denied, wrong password.';
        }
        resetAuth();
      }
    } else if (!user) {
        const cmd = command.trim().toLowerCase();
        if (cmd === 'login' || cmd === 'register') {
            setAuthCommand(cmd);
            setAuthStep('email');
            result = '';
        } else if (cmd === 'help') {
            result = getHelpOutput(false, false);
        } else if (cmd !== '' && cmd !== 'clear') {
            result = `Command not found: ${cmd}. Please 'login' or 'register'.`;
        }
    } else {
      let [cmd, ...args] = command.trim().split(/\s+/);
      const aliasExpansion = aliases[cmd];
      if (aliasExpansion) {
        [cmd, ...args] = [...aliasExpansion.split(/\s+/), ...args];
      }

      if (cmd) {
        const commandDef = commands[cmd];
        if (commandDef) {
          if (commandDef.rootOnly && !isRoot) {
            result = `${cmd}: command not found. (try 'su')`;
          } else {
            result = await commandDef.handler(args, command);
          }
        } else {
          result = await handleAICommand(cmd, args);
        }
      }
    }
    
    if (!confirmation && !editingFile && authStep === null) {
      setIsProcessing(false);
    }
    
    return result;
  }, [
    confirmation, authStep, authCredentials, authCommand, sshCredentials, user, 
    isRoot, aliases, cwd, currentHost,
    resetAuth, triggerWarlock, toast, hasPermission,
    editingFile // ensure it's a dependency
  ]);

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
