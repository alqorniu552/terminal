"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { generateCommandHelp } from '@/ai/flows/generate-command-help';
import { databaseQuery } from '@/ai/flows/database-query-flow';
import { askSidekick } from '@/ai/flows/ai-sidekick-flow';
import { initialFilesystem, getDynamicContent, Directory, FilesystemNode, File } from '@/lib/filesystem';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, WhereFilterOp, doc, setDoc, getDoc, updateDoc, writeBatch, orderBy, limit } from 'firebase/firestore';
import { User } from 'firebase/auth';
import ImageDisplay from '@/components/image-display';
import { scanFile } from '@/ai/flows/scan-file-flow';
import { generateAttackPlan } from '@/ai/flows/attack-planner-flow';
import { generateWarlockTaunt } from '@/ai/flows/warlock-threat-flow';
import { analyzeImage } from '@/ai/flows/analyze-image-flow';
import { investigateTarget } from '@/ai/flows/osint-investigation-flow';
import { craftPhish } from '@/ai/flows/craft-phish-flow';
import { forgeTool } from '@/ai/flows/forge-tool-flow';
import { concealMessage, revealMessage } from '@/ai/flows/steganography-flow';
import md5 from 'md5';


// --- Type Definitions ---
export type EditingFile = { path: string; content: string } | null;

export type CommandResultType = 'text' | 'component' | 'none';

export type CommandResult = 
  | { type: 'text', text: string }
  | { type: 'component', component: React.ReactNode }
  | { type: 'none' };
  
export type SetAwaitingConfirmationFn = (
    message: string,
    onConfirm: () => void,
    onDeny: () => void
) => void;

export interface WarlockMessage {
  id: number;
  text: string;
}

export type AuthStep = 'idle' | 'email' | 'password';
export type AuthCommand = 'login' | 'register' | null;

// --- Constants ---
const ROOT_EMAIL = "alqorniu552@gmail.com";
const MONITORED_FILES_FOR_WARLOCK = ['/auth.log', '/shadow.bak', '/var/lib/warlock.core'];

// --- Helper Functions ---
const getNeofetchOutput = (user: {email: string} | null | undefined) => {
    let uptimeString = '1 min';
    if (typeof window !== 'undefined') {
        const up = Math.floor(performance.now() / 1000);
        const days = Math.floor(up / 86400);
        const hours = Math.floor((up % 86400) / 3600);
        const minutes = Math.floor(((up % 86400) % 3600) / 60);
        
        let parts = [];
        if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
        if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
        if (minutes > 0 || (days === 0 && hours === 0)) parts.push(`${minutes} min${minutes > 1 ? 's' : ''}`);
        
        uptimeString = parts.join(', ');
    }
    const email = user?.email || 'guest';

const logo = `
            .-/+oossssoo+/-.
        \`:+ssssssssssssssssss+:\`
      -+ssssssssssssssssssyyssss+-
    .ossssssssssssssssssdsdssssssssso.
   /ssssssssssydssssssssdsdssssssssssss/
  +sssssssssssdmydssssssdsdsssssssssssss+
 /sssssssssssdmydssssssdsdsssssssssssssss/
.sssssssssssdmydssssssdsdssssssssssssssss.
/ssssssssssssmdmdssdsdmdgssssssssssssssss/
+ssssssssssssdmdssdsdmdgsssssssssssssssss+
/ssssssssssssdmdssdsdmdgssssssssssssssss/
.ssssssssssssdmdssdsdmdgssssssssssssssss.
 /sssssssssssdmydssssssdsdsssssssssssssss/
  +sssssssssssdmydssssssdsdsssssssssssss+
   /ssssssssssydssssssssdsdssssssssssss/
    .ossssssssssssssssssdsdssssssssso.
      -+sssssssssssssssssyyyssss+-
        \`:+ssssssssssssssssss+:\`
            .-/+oossssoo+/-.
`;

const output = `
${logo.trim().split('\n').map(line => `${line}`).join('\n')}

${email}@cyber
--------------------
OS: Ubuntu 24.04 LTS x86_64
Host: Command Center v1.0
Kernel: GhostWorks Kernel
Uptime: ${uptimeString}
Packages: 1821 (dpkg), 15 (snap)
Shell: bash 5.2.21
DE: GNOME 46
WM: Mutter
Terminal: command-center
CPU: Intel i9-13900K (24) @ 5.8GHz
GPU: NVIDIA GeForce RTX 4090
Memory: 1450MiB / 31927MiB
`;
return output;
};


const getHelpOutput = (isLoggedIn: boolean, isRoot: boolean, isMobile: boolean) => {
    const formatCommandsToTable = (title: string, commands: { command: string, args: string, description: string }[]): string => {
        if (commands.length === 0) return '';
        let output = `\n${title}\n`;
        const headers = { command: 'Command', args: 'Arguments', description: 'Description' };
        
        const colWidths = {
            command: Math.max(headers.command.length, ...commands.map(c => c.command.length)),
            args: Math.max(headers.args.length, ...commands.map(c => c.args.length)),
            description: 40 
        };

        const pad = (str: string, width: number) => str.padEnd(width);
        
        const drawLine = (left: string, mid1: string, mid2: string, right: string) =>
            `${left}${'─'.repeat(colWidths.command + 2)}${mid1}${'─'.repeat(colWidths.args + 2)}${mid2}${'─'.repeat(colWidths.description + 2)}${right}`;
        
        output += drawLine('┌', '┬', '┬', '┐') + '\n';
        output += `│ ${pad(headers.command, colWidths.command)} │ ${pad(headers.args, colWidths.args)} │ ${pad(headers.description, colWidths.description)} │\n`;
        output += drawLine('├', '┼', '┼', '┤') + '\n';
        
        commands.forEach(c => {
             output += `│ ${pad(c.command, colWidths.command)} │ ${pad(c.args, colWidths.args)} │ ${pad(c.description, colWidths.description)} │\n`;
        });
        
        output += drawLine('└', '┴', '┴', '┘') + '\n';
        return output;
    };
    
    const formatCommandsToList = (title: string, commands: { command: string, args: string, description: string }[]): string => {
        if (commands.length === 0) return '';
        let output = `\n${title}\n`;
        const maxCommandLength = Math.max(...commands.map(c => (c.command + (c.args ? ` ${c.args}` : '')).length));
        commands.forEach(c => {
            const commandStr = (c.command + (c.args ? ` ${c.args}` : '')).padEnd(maxCommandLength + 2, ' ');
            output += `- ${commandStr}: ${c.description}\n`;
        });
        return output;
    };
    
    const formatFn = isMobile ? formatCommandsToList : formatCommandsToTable;

    let output = '';

    if (isLoggedIn) {
        const userCommands = [
          { command: 'ls', args: '[path]', description: 'List directory contents.' },
          { command: 'cd', args: '<path>', description: 'Change directory.' },
          { command: 'cat', args: '<file>', description: 'Display file content.' },
          { command: 'nano', args: '<file>', description: 'Edit a file.' },
          { command: 'mkdir', args: '<dirname>', description: 'Create a directory.' },
          { command: 'touch', args: '<filename>', description: 'Create an empty file.' },
          { command: 'rm', args: '<file/dir>', description: 'Remove a file or directory.' },
          { command: 'neofetch', args: '', description: 'Display system information.' },
          { command: 'clear', args: '', description: 'Clear the terminal screen.' },
          { command: 'logout', args: '', description: 'Log out from the application.' },
          { command: 'python', args: '<file.py>', description: 'Execute a Python script.' },
          { command: 'bash', args: '<file.sh>', description: 'Execute a shell script.' },
        ];
        
        const ctfTools = [
            { command: 'missions', args: '', description: 'List available missions.'},
            { command: 'submit-flag', args: '<flag>', description: 'Submit a found flag.'},
            { command: 'score', args: '', description: 'Check your current score.'},
            { command: 'leaderboard', args: '', description: 'View the top players.'},
            { command: 'ask', args: '"<question>"', description: 'Ask the AI sidekick for a hint.'},
            { command: 'scan', args: '<file>', description: 'Scan a file for vulnerabilities.'},
            { command: 'nmap', args: '<ip>', description: 'Scan a target IP for open ports.'},
            { command: 'imagine', args: '<prompt>', description: 'Generate an image with AI.'},
            { command: 'crack', args: '<hash> --wordlist <file>', description: 'Crack a password hash.'},
            { command: 'reveal', args: '<image_file>', description: 'Reveal secrets in an image.'},
            { command: 'attack', args: '<target> --obj "<goal>"', description: 'Plan & execute an AI attack.'},
            { command: 'analyze-image', args: '<url>', description: 'Analyze an image for clues.' },
            { command: 'investigate', args: '<target>', description: 'Run an OSINT investigation.' },
            { command: 'craft-phish', args: '--to <email>', description: 'Craft a phishing email.' },
            { command: 'forge', args: '<file> --prompt "<desc>"', description: 'Forge a new tool with AI.'},
        ];
        
        const aiVsAiTools = [
            { command: 'warlock-threat', args: '--scan', description: 'Scan for Warlock AI activity.' },
            { command: 'counter-measure', args: '--type <type>', description: 'Launch counter-attack on Warlock.' },
        ];

        const rootCommands = [
            { command: 'db', args: '"query"', description: 'Query the database (admin only).' },
            { command: 'list-users', args: '', description: 'List all registered users.'},
            { command: 'chuser', args: '<email>', description: 'Switch to another user\'s view.'},
            { command: 'conceal', args: '--image <f> --msg "m"', description: 'Hide message in an image.'},
        ];

        output += formatFn('USER COMMANDS', userCommands);
        output += formatFn('CTF & HACKING TOOLS', ctfTools);
        output += formatFn('AI VS. AI WARFARE', aiVsAiTools);

        if (isRoot) {
            output += formatFn('ROOT COMMANDS', rootCommands);
        }

        return output;
    }
    
    const loggedOutCommands = [
      { command: 'help', args: '', description: 'Show this help message.' },
      { command: 'login', args: '', description: 'Log in to your account.' },
      { command: 'register', args: '', description: 'Create a new account.' },
      { command: 'clear', args: '', description: 'Clear the terminal screen.' },
    ];
    output += formatFn('AVAILABLE COMMANDS', loggedOutCommands);
    return output;
};

const virtualHosts: Record<string, string> = {
    '10.10.1.1': 'Open Ports: 22 (SSH), 80 (HTTP)\nHost is running Linux 5.4.',
    '10.10.1.2': 'Open Ports: 21 (FTP), 80 (HTTP), 443 (HTTPS)\nFTP allows anonymous login. Found /gobuster.txt.',
    '192.168.1.100': 'Open Ports: 8080 (web-proxy)\nProxy seems to be misconfigured.',
};

// --- Main Hook ---
export const useCommand = (
    user: User | null | undefined, 
    isMobile: boolean,
    setAwaitingConfirmation: SetAwaitingConfirmationFn
) => {
  // State
  const [cwd, setCwd] = useState('/');
  const [isProcessing, setIsProcessing] = useState(false);
  const [userFilesystem, setUserFilesystem] = useState<Directory>(initialFilesystem);
  const [editingFile, setEditingFile] = useState<EditingFile>(null);
  const [isRoot, setIsRoot] = useState(false);
  const [viewedUser, setViewedUser] = useState<{uid: string, email: string} | null>(null);
  const [aliases, setAliases] = useState<Record<string, string>>({});
  
  // Warlock State
  const [warlockAwareness, setWarlockAwareness] = useState(0);
  const [warlockMessages, setWarlockMessages] = useState<WarlockMessage[]>([]);
  const warlockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warlockIsActive = useRef(true);
  
  const { toast } = useToast();

  // --- Filesystem & Path Helpers ---
  const resolvePath = useCallback((path: string): string => {
    if (path.endsWith('.locked')) {
        path = path.slice(0, -7);
    }
    if (path.startsWith('~/')) {
        path = path.substring(1); 
    }
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
    const resolved = resolvePath(path);
    const parts = resolved.split('/').filter(p => p && p !== '~');
    let currentNode: FilesystemNode = fs;
    for (const part of parts) {
      if (currentNode.type === 'directory' && currentNode.children[part]) {
        currentNode = currentNode.children[part];
      } else {
        return null;
      }
    }
    return currentNode;
  }, [resolvePath]);

  const getParentNodeFromPath = useCallback((path: string, fs: Directory): Directory | null => {
      const resolved = resolvePath(path);
      const parts = resolved.split('/').filter(p => p && p !== '~');
      if (parts.length === 0) return null; // Can't get parent of root
      if (parts.length === 1) return fs; // Parent is root
      const parentPath = '/' + parts.slice(0, -1).join('/');
      const node = getNodeFromPath(parentPath, fs);
      return node?.type === 'directory' ? node : null;
  }, [getNodeFromPath, resolvePath]);

  // --- User & Filesystem Management ---
  const parseAliases = useCallback((fs: Directory) => {
    const newAliases: Record<string, string> = {};
    const bashrcNode = getNodeFromPath('/.bashrc', fs);
    if (bashrcNode && bashrcNode.type === 'file') {
        const content = getDynamicContent(bashrcNode.content, bashrcNode.path || '');
        const lines = content.split('\n');
        lines.forEach(line => {
            if (line.trim().startsWith('alias ')) {
                const match = line.match(/alias\s+([^=]+)='([^']+)'/);
                if (match) {
                    newAliases[match[1]] = match[2];
                }
            }
        });
    }
    setAliases(newAliases);
  }, [getNodeFromPath]);

  const updateFirestoreFilesystem = useCallback(async (newFilesystem: Directory) => {
    if (!viewedUser || !user || viewedUser.uid !== user.uid) {
        toast({ title: "Permission Denied", description: "You are in read-only mode for this user's filesystem." });
        return;
    }
    try {
        const userDocRef = doc(db, 'users', viewedUser.uid);
        await updateDoc(userDocRef, { filesystem: newFilesystem });
        parseAliases(newFilesystem);
    } catch (error) {
        console.error("Error updating filesystem in Firestore:", error);
        toast({
            variant: "destructive",
            title: "Filesystem Error",
            description: "Could not save file changes to the cloud.",
        });
    }
  }, [viewedUser, user, toast, parseAliases]);

  const fetchUserFilesystem = useCallback(async (uid: string | null) => {
    setIsProcessing(true);
    if (uid) {
        const userDocRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().filesystem) {
            const fs = userDoc.data().filesystem;
            warlockIsActive.current = getNodeFromPath('/var/lib/warlock.core', fs) !== null;
            setUserFilesystem(fs);
            parseAliases(fs);
        } else if (user && user.uid === uid) { 
            const userDocData = userDoc.exists() ? userDoc.data() : { email: user.email };
            const newUserDoc = { ...userDocData, filesystem: initialFilesystem };
            await setDoc(userDocRef, newUserDoc, { merge: true });
            warlockIsActive.current = true;
            setUserFilesystem(initialFilesystem);
            parseAliases(initialFilesystem);
        }
    } else {
        warlockIsActive.current = true;
        setUserFilesystem(initialFilesystem);
        parseAliases(initialFilesystem);
    }
    setWarlockAwareness(0);
    setCwd('/');
    setIsProcessing(false);
  }, [user, parseAliases, getNodeFromPath]);

  useEffect(() => {
    if (user) {
        const isUserRoot = user.email === ROOT_EMAIL;
        setIsRoot(isUserRoot);
        if (!viewedUser || viewedUser.uid !== user.uid) {
            setViewedUser({ uid: user.uid, email: user.email! });
        }
    } else {
        setIsRoot(false);
        setViewedUser(null);
    }
  }, [user, viewedUser]);

  useEffect(() => {
    if (viewedUser?.uid) {
      fetchUserFilesystem(viewedUser.uid);
    } else {
      setUserFilesystem(initialFilesystem);
      parseAliases(initialFilesystem);
      setCwd('/');
    }
  }, [viewedUser, fetchUserFilesystem, parseAliases]);
  
  // --- Prompt & Welcome Message ---
  const getPrompt = useCallback(() => {
    if (viewedUser) {
        const username = viewedUser.email.split('@')[0] || 'user';
        const path = cwd === '/' ? '~' : `~${cwd}`;
        const promptChar = (isRoot && viewedUser.uid === user?.uid) ? '#' : '$';
        return `${username}@cyber:${path}${promptChar} `;
    }
    return 'guest@cyber:~$ ';
  }, [user, cwd, isRoot, viewedUser]);
  
  const [prompt, setPrompt] = useState(getPrompt());

  useEffect(() => {
    setPrompt(getPrompt());
  }, [getPrompt]);

  const getWelcomeMessage = useCallback(() => {
    if (user) {
        if (isRoot && user.email === ROOT_EMAIL) {
            return `Welcome, root. System privileges granted. Type 'help' for a list of commands.`;
        }
        return `Welcome back, ${user.email}! Type 'help' for a list of commands.`;
    }
    return `Welcome to Cyber! Please 'login' or 'register' to continue.`;
  }, [user, isRoot]);

    // --- Warlock AI Rival Logic ---
    const triggerWarlockMessage = useCallback(async (action: string) => {
        if (!warlockIsActive.current) return;
        try {
            const { taunt } = await generateWarlockTaunt({ action, awareness: warlockAwareness });
            setWarlockMessages(prev => [...prev, { id: Date.now(), text: taunt }]);
        } catch (e) {
            console.error("Warlock taunt generation failed:", e);
        }
    }, [warlockAwareness]);

    const updateWarlockAwareness = useCallback((amount: number, action: string) => {
        if (!warlockIsActive.current) return;
        
        setWarlockAwareness(prev => {
            const newAwareness = Math.min(100, Math.max(0, prev + amount));

            if (warlockTimeoutRef.current) {
                clearTimeout(warlockTimeoutRef.current);
            }

            if (amount > 0) { // Only trigger taunts on awareness increase
                if (newAwareness > 30 && newAwareness < 60 && Math.random() < 0.2) {
                    triggerWarlockMessage(action);
                } else if (newAwareness >= 60 && newAwareness < 90 && Math.random() < 0.5) {
                    triggerWarlockMessage(action);
                } else if (newAwareness >= 90 && Math.random() < 0.8) {
                    triggerWarlockMessage(action);
                }
            }
            
            warlockTimeoutRef.current = setTimeout(() => {
                setWarlockAwareness(curr => Math.max(0, curr - 10));
            }, 30000); // Decrease awareness every 30 seconds of inactivity

            return newAwareness;
        });
    }, [triggerWarlockMessage]);

    const warlockRetaliate = useCallback(async () => {
        if (!warlockIsActive.current || !user || viewedUser?.uid !== user.uid) return;

        const retaliationOptions = ['lockFile', 'createHoneypot', 'deleteTool'];
        const choice = retaliationOptions[Math.floor(Math.random() * retaliationOptions.length)];

        let message = '';
        const newFs = JSON.parse(JSON.stringify(userFilesystem));

        if (choice === 'lockFile') {
            const sensitiveFiles = ['/auth.log', '/shadow.bak', '/secret.jpg'];
            const targetFile = sensitiveFiles[Math.floor(Math.random() * sensitiveFiles.length)];
            const parentNode = getParentNodeFromPath(targetFile, newFs);
            const filename = targetFile.split('/').pop();
            if (parentNode && filename && parentNode.children[filename] && !filename.endsWith('.locked')) {
                parentNode.children[`${filename}.locked`] = parentNode.children[filename];
                delete parentNode.children[filename];
                message = `locked ${filename}`;
            }
        } else if (choice === 'createHoneypot') {
            const honeypotName = `t_archive_${Math.floor(Math.random() * 900) + 100}`;
            if (!newFs.children[honeypotName]) {
                newFs.children[honeypotName] = { type: 'directory', children: { 'DO_NOT_ENTER.txt': { type: 'file', content: 'TRAP ACTIVATED' } } };
                message = `created honeypot ${honeypotName}`;
            }
        } else if (choice === 'deleteTool') {
            const homeNode = getNodeFromPath('/', newFs);
            if (homeNode?.type === 'directory') {
                const forgedFiles = Object.keys(homeNode.children).filter(name => name.startsWith('forged_'));
                if (forgedFiles.length > 0) {
                    const fileToDelete = forgedFiles[Math.floor(Math.random() * forgedFiles.length)];
                    delete homeNode.children[fileToDelete];
                    message = `deleted user tool ${fileToDelete}`;
                }
            }
        }
        
        if (message) {
            setUserFilesystem(newFs);
            await updateFirestoreFilesystem(newFs);
            await triggerWarlockMessage(message);
            setWarlockAwareness(prev => prev - 25); // Reduce awareness after taking action
        }

    }, [userFilesystem, getParentNodeFromPath, updateFirestoreFilesystem, triggerWarlockMessage, user, viewedUser]);


    useEffect(() => {
        if (warlockAwareness > 80 && Math.random() > 0.4) {
            warlockRetaliate();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [warlockAwareness]);
  
  const clearWarlockMessages = useCallback(() => {
    setWarlockMessages([]);
  }, []);

  // --- Nano Editor Logic ---
  const saveFile = useCallback(async (path: string, content: string): Promise<string> => {
      if (!viewedUser || !user || viewedUser.uid !== user.uid) {
        return "Error: Permission Denied. You are in read-only mode.";
      }
      const newFs = JSON.parse(JSON.stringify(userFilesystem));
      const targetPath = resolvePath(path);
      const parentNode = getParentNodeFromPath(targetPath, newFs);
      const filename = targetPath.split('/').pop();

      if (parentNode && filename) {
          const existingNode = parentNode.children[filename];
          if (existingNode && existingNode.type === 'directory') {
              return `Error: Cannot save file, '${filename}' is a directory.`;
          }
          parentNode.children[filename] = { type: 'file', content: content, path: targetPath };
          setUserFilesystem({ ...newFs });
          await updateFirestoreFilesystem(newFs);
          return `File saved: ${path}`;
      }
      return `Error: Could not save file to path '${path}'.`;
  }, [userFilesystem, resolvePath, getParentNodeFromPath, updateFirestoreFilesystem, viewedUser, user]);

  const exitEditor = useCallback(() => {
      setEditingFile(null);
  }, []);
  
  const executeFile = useCallback((fileNode: FilesystemNode): CommandResult => {
      if (fileNode.type === 'directory') {
          return { type: 'text', text: 'Error: Cannot execute a directory.' };
      }
      const content = getDynamicContent(fileNode.content, fileNode.path || '');
      return { type: 'text', text: content };
  }, []);

    const handleFileSystemCommands = async (cmd: string, args: string[], argString: string): Promise<CommandResult | null> => {
        const checkLogicBomb = (path: string) => {
            const node = getNodeFromPath(path, userFilesystem);
            if (node?.type === 'file' && (node as File).logicBomb) {
                updateWarlockAwareness(-50, 'logic bomb triggered');
                toast({ title: "Logic Bomb Triggered!", description: "Warlock's monitoring system was disrupted. Its awareness has been significantly reduced." });
                const newFs = JSON.parse(JSON.stringify(userFilesystem));
                const nodeToUpdate = getNodeFromPath(path, newFs) as File;
                delete nodeToUpdate.logicBomb;
                setUserFilesystem(newFs);
                updateFirestoreFilesystem(newFs);
            }
        };

        switch (cmd) {
            case 'ls': {
                const targetPath = argString ? resolvePath(argString) : cwd;
                const node = getNodeFromPath(targetPath, userFilesystem);
                if (node && node.type === 'directory') {
                    const content = Object.keys(node.children);
                    if (content.length === 0) return { type: 'text', text: '' };
                    return { type: 'text', text: content.map(name => node.children[name].type === 'directory' ? `${name}/` : name).join('\n') };
                }
                return { type: 'text', text: `ls: cannot access '${argString || '.'}': No such file or directory` };
            }
            case 'cd': {
                if (!argString || argString === '~' || argString === '/') { setCwd('/'); return { type: 'none' }; }
                const newPath = resolvePath(argString);
                const node = getNodeFromPath(newPath, userFilesystem);

                if (node?.type === 'directory' && newPath.includes('honeypot')) {
                    updateWarlockAwareness(50, `entered honeypot directory ${newPath}`);
                }

                if (node && node.type === 'directory') { setCwd(newPath); return { type: 'none' }; }
                return { type: 'text', text: `cd: no such file or directory: ${argString}` };
            }
            case 'cat': {
                if (!argString) return { type: 'text', text: 'cat: missing operand' };
                const targetPath = resolvePath(argString);

                if (MONITORED_FILES_FOR_WARLOCK.includes(targetPath)) {
                    updateWarlockAwareness(10, `accessed ${targetPath}`);
                    checkLogicBomb(targetPath);
                }
                
                const node = getNodeFromPath(targetPath, userFilesystem);
                if (node && node.type === 'file') {
                    const content = getDynamicContent(node.content, node.path || '');
                    return { type: 'text', text: content };
                }
                return { type: 'text', text: `cat: ${argString}: No such file or directory` };
            }
            case 'nano': {
                if (!user || viewedUser?.uid !== user.uid) return { type: 'text', text: `nano: You can only edit your own files.` };
                if (!argString) return { type: 'text', text: 'Usage: nano <filename>' };
                const targetPath = resolvePath(argString);
                const node = getNodeFromPath(targetPath, userFilesystem);
                if (node && node.type === 'directory') return { type: 'text', text: `nano: ${argString}: Is a directory` };
                const content = (node && node.type === 'file') ? getDynamicContent(node.content, node.path || '') : '';
                setEditingFile({ path: targetPath, content: content as string });
                return { type: 'none' };
            }
            case 'mkdir': {
                if (!user || viewedUser?.uid !== user.uid) return { type: 'text', text: `mkdir: Permission denied.` };
                if (!argString) return { type: 'text', text: 'mkdir: missing operand' };
                const newFs = JSON.parse(JSON.stringify(userFilesystem));
                const targetPath = resolvePath(argString);
                if (getNodeFromPath(targetPath, newFs)) return { type: 'text', text: `mkdir: cannot create directory ‘${argString}’: File exists` };
                const parentNode = getParentNodeFromPath(targetPath, newFs);
                const dirname = targetPath.split('/').pop();
                if (parentNode && dirname) {
                    parentNode.children[dirname] = { type: 'directory', children: {} };
                    setUserFilesystem({ ...newFs });
                    await updateFirestoreFilesystem(newFs);
                    return { type: 'none' };
                }
                return { type: 'text', text: `mkdir: cannot create directory ‘${argString}’: No such file or directory` };
            }
            case 'touch': {
                if (!user || viewedUser?.uid !== user.uid) return { type: 'text', text: `touch: Permission denied.` };
                if (!argString) return { type: 'text', text: 'touch: missing file operand' };
                const newFs = JSON.parse(JSON.stringify(userFilesystem));
                const targetPath = resolvePath(argString);
                if (getNodeFromPath(targetPath, newFs)) return { type: 'none' };
                const parentNode = getParentNodeFromPath(targetPath, newFs);
                const filename = targetPath.split('/').pop();
                if (parentNode && filename) {
                    parentNode.children[filename] = { type: 'file', content: '', path: targetPath };
                    setUserFilesystem({ ...newFs });
                    await updateFirestoreFilesystem(newFs);
                    return { type: 'none' };
                }
                return { type: 'text', text: `touch: cannot touch '${argString}': No such file or directory` };
            }
            case 'rm': {
                if (!user || viewedUser?.uid !== user.uid) return { type: 'text', text: `rm: Permission denied.` };
                if (!argString) return { type: 'text', text: 'rm: missing operand' };
                
                const targetPath = resolvePath(argString);
                if (targetPath === '/var/lib/warlock.core') {
                    updateWarlockAwareness(50, 'attempted to delete warlock.core');
                }

                const newFs = JSON.parse(JSON.stringify(userFilesystem));
                if (targetPath === '/') return { type: 'text', text: `rm: cannot remove '/': Is a directory` };
                const parentNode = getParentNodeFromPath(targetPath, newFs);
                const nodeName = targetPath.split('/').pop();
                if (parentNode && nodeName && parentNode.children[nodeName]) {
                    const nodeToRemove = parentNode.children[nodeName];
                    if (nodeToRemove.type === 'directory' && Object.keys(nodeToRemove.children).length > 0 && args[0] !== '-r') {
                        return { type: 'text', text: `rm: cannot remove '${argString}': Directory not empty` };
                    }
                    delete parentNode.children[nodeName];
                    setUserFilesystem({ ...newFs });
                    await updateFirestoreFilesystem(newFs);
                    if (targetPath === '/var/lib/warlock.core') {
                        warlockIsActive.current = false;
                        setWarlockAwareness(0);
                        if (warlockTimeoutRef.current) clearTimeout(warlockTimeoutRef.current);
                        return { type: 'text', text: `SYSTEM INTEGRITY COMPROMISED. WARLOCK CORE OFFLINE.` };
                    }
                    return { type: 'none' };
                }
                return { type: 'text', text: `rm: cannot remove '${argString}': No such file or directory` };
            }
            default:
                return null;
        }
    }

    const handleCtfCommands = async (cmd: string, args: string[], argString: string, isPlannedExecution: boolean): Promise<CommandResult | null> => {
        switch (cmd) {
            case 'imagine': {
                const prompt = argString.startsWith('"') && argString.endsWith('"') ? argString.slice(1, -1) : argString;
                if (!prompt) return { type: 'text', text: 'Usage: imagine "<your prompt>"' };
                return { component: <ImageDisplay prompt={prompt} onFinished={() => { }} />, type: 'component' };
            }
            case 'nmap': {
                if (!argString) return { type: 'text', text: 'Usage: nmap <ip_address>' };
                updateWarlockAwareness(5, `nmap scan on ${argString}`);
                const result = virtualHosts[argString] || `Failed to resolve "${argString}".`;
                return { type: 'text', text: `Starting Nmap...\n${result}` };
            }
            case 'gobuster': { // Simulated command
                if (isPlannedExecution) {
                    updateWarlockAwareness(10, 'gobuster execution');
                    const gobusterNode = getNodeFromPath('/gobuster.txt', userFilesystem);
                    if (gobusterNode && gobusterNode.type === 'file') {
                        const content = getDynamicContent(gobusterNode.content, gobusterNode.path || '');
                        return { type: 'text', text: content };
                    }
                }
                return { type: 'text', text: 'gobuster: command not found' };
            }
            case 'ask': {
                if (!argString.startsWith('"') || !argString.endsWith('"')) return { type: 'text', text: 'Usage: ask "<your question>"' };
                const question = argString.slice(1, -1);
                const currentNode = getNodeFromPath(cwd, userFilesystem);
                const files = (currentNode?.type === 'directory') ? Object.keys(currentNode.children) : [];
                const { answer } = await askSidekick({ question, cwd, files });
                return { type: 'text', text: `Ghost: "${answer}"` };
            }
            case 'scan': {
                if (!argString) return { type: 'text', text: 'Usage: scan <file_path>' };
                updateWarlockAwareness(20, `scanned ${argString}`);
                const node = getNodeFromPath(argString, userFilesystem);
                if (!node) {
                    return { type: 'text', text: `scan: file not found: ${argString}` };
                }
                const content = (node.type === 'file')
                    ? getDynamicContent(node.content, node.path || '')
                    : 'This is a directory.';
                const { report } = await scanFile({ filename: argString, content: content as string });
                return { type: 'text', text: report };
            }
            case 'crack': {
                updateWarlockAwareness(25, `started password cracking`);
                const hashArgIndex = args.findIndex(a => a.length === 32); // Simple md5 check
                const wordlistFlagIndex = args.findIndex(a => a === '--wordlist');

                if (hashArgIndex === -1 || wordlistFlagIndex === -1 || wordlistFlagIndex + 1 >= args.length) {
                    return { type: 'text', text: 'Usage: crack <hash> --wordlist <file_path>' };
                }

                const hash = args[hashArgIndex];
                const wordlistPath = args[wordlistFlagIndex + 1];
                const wordlistNode = getNodeFromPath(wordlistPath, userFilesystem);

                if (!wordlistNode || wordlistNode.type !== 'file') {
                    return { type: 'text', text: `crack: wordlist file not found: ${wordlistPath}` };
                }

                const wordlistContent = getDynamicContent(wordlistNode.content, wordlistNode.path || '');
                const words = wordlistContent.split('\n');

                for (const word of words) {
                    if (md5(word.trim()) === hash) {
                        updateWarlockAwareness(30, `successfully cracked password`);
                        return { type: 'text', text: `Password found: ${word.trim()}\n\nHint: You can now submit this as a flag: FLAG{D1CT10NARY_BRU73_F0RC3}` };
                    }
                }

                return { type: 'text', text: 'Password not found in wordlist.' };
            }
            case 'reveal': {
                if (!argString) return { type: 'text', text: 'Usage: reveal <image_file>' };
                updateWarlockAwareness(15, `steganography attempt on ${argString}`);
                const imageNode = getNodeFromPath(argString, userFilesystem);
                if (!imageNode || imageNode.type !== 'file') {
                    return { type: 'text', text: `reveal: file not found: ${argString}` };
                }
                const imageData = getDynamicContent(imageNode.content, imageNode.path || '');
                const { revealedMessage } = await revealMessage({ imageDataUri: imageData });
                return { type: 'text', text: revealedMessage };
            }
            case 'conceal': {
                if (!isRoot) return { type: 'text', text: `bash: command not found: conceal` };
                const imageFlagIndex = args.findIndex(a => a === '--image');
                const msgFlagIndex = args.findIndex(a => a === '--msg');
                if (imageFlagIndex === -1 || msgFlagIndex === -1 || imageFlagIndex + 1 >= args.length || msgFlagIndex + 1 >= args.length) {
                    return { type: 'text', text: 'Usage: conceal --image <file_path> --msg "<message>"' };
                }
                const imagePath = args[imageFlagIndex + 1];
                const message = argString.split('--msg')[1]?.trim().slice(1, -1) || '';
                const imageNode = getNodeFromPath(imagePath, userFilesystem);
                if (!imageNode || imageNode.type !== 'file') return { type: 'text', text: `conceal: file not found: ${imagePath}` };

                const imageData = getDynamicContent(imageNode.content, imageNode.path || '');
                const { newImageDataUri } = await concealMessage({ imageDataUri: imageData, message });

                const saveResult = await saveFile(imagePath, newImageDataUri);
                return { type: 'text', text: `Message concealed. ${saveResult}` };
            }
            case 'attack': {
                const targetIndex = args.findIndex(arg => !arg.startsWith('--'));
                const objectiveIndex = args.findIndex(arg => arg === '--objective' || arg === '--obj');

                if (targetIndex === -1 || objectiveIndex === -1 || objectiveIndex + 1 >= args.length) {
                    return { type: 'text', text: 'Usage: attack <target> --obj[ective] "<goal>"' };
                }
                const target = args[targetIndex];
                const objective = argString.split(/--obj(?:ective)?/)[1].trim().slice(1, -1);

                updateWarlockAwareness(30, `planned attack on ${target}`);

                const currentNode = getNodeFromPath(cwd, userFilesystem);
                const files = (currentNode?.type === 'directory') ? Object.keys(currentNode.children) : [];

                const { plan, reasoning } = await generateAttackPlan({ target, objective, availableFiles: files });

                if (!plan || plan.length === 0) {
                    return { type: 'text', text: 'Ghost: I could not devise a coherent plan for that objective.' };
                }

                let planString = `Ghost has devised a plan based on the objective: "${objective}"\n`;
                planString += `Reasoning: ${reasoning}\n\n`;
                planString += plan.map((step, index) => `[Step ${index + 1}] ${step.command} ${step.args.join(' ')}`).join('\n');

                setAwaitingConfirmation(planString, async () => {
                    await executeCommandsSequentially(plan);
                }, () => {
                    updateWarlockAwareness(-10, 'user denied attack plan');
                });

                return { type: 'none' };
            }
            case 'missions': {
                const missionsCol = collection(db, 'missions');
                const missionsSnapshot = await getDocs(missionsCol);
                if (missionsSnapshot.empty) return { type: 'text', text: 'No missions available. Check back later, agent.' };
                const missionsList = missionsSnapshot.docs.map(doc => {
                    const data = doc.data();
                    return `- ${data.title} (${data.points} pts): ${data.description}`;
                }).join('\n');
                return { type: 'text', text: `Available Missions:\n${missionsList}` };
            }
            case 'submit-flag': {
                if (!argString) return { type: 'text', text: 'Usage: submit-flag <flag>' };
                const q = query(collection(db, 'missions'), where("flag", "==", argString));
                const missionSnapshot = await getDocs(q);
                if (missionSnapshot.empty) {
                    updateWarlockAwareness(10, `incorrect flag submission`);
                    return {
                        type: 'text', text: 'Incorrect flag. Keep trying.'
                    };
                }

                const missionDoc = missionSnapshot.docs[0];
                const missionId = missionDoc.id;
                const missionData = missionDoc.data();
                if (!user) return { type: 'text', text: 'Error: User not logged in.' };
                const userProgressRef = doc(db, 'user-progress', user.uid);
                const userProgressSnap = await getDoc(userProgressRef);

                if (userProgressSnap.exists() && userProgressSnap.data().completed_missions?.includes(missionId)) {
                    return { type: 'text', text: 'You have already completed this mission.' };
                }

                updateWarlockAwareness(20, `completed mission ${missionData.title}`);

                const batch = writeBatch(db);
                const currentScore = userProgressSnap.exists() ? userProgressSnap.data().score : 0;
                const newScore = currentScore + missionData.points;

                const progressData = {
                    completed_missions: [...(userProgressSnap.data()?.completed_missions || []), missionId],
                    score: newScore,
                    last_completed: new Date(),
                    email: user.email,
                };

                if (userProgressSnap.exists()) {
                    batch.update(userProgressRef, progressData);
                } else {
                    batch.set(userProgressRef, progressData);
                }

                const leaderboardRef = doc(db, 'leaderboard', user.uid);
                batch.set(leaderboardRef, { score: newScore, email: user.email }, { merge: true });
                await batch.commit();

                return { type: 'text', text: `Correct! You earned ${missionData.points} points. Your new score is ${newScore}.` };
            }
            case 'score': {
                if (!user) return { type: 'text', text: 'Error: User not logged in.' };
                const userProgressRef = doc(db, 'user-progress', user.uid);
                const userProgressSnap = await getDoc(userProgressRef);
                const currentScore = userProgressSnap.exists() ? userProgressSnap.data().score : 0;
                return { type: 'text', text: `Your current score is: ${currentScore}` };
            }
            case 'leaderboard': {
                const leaderboardCol = collection(db, 'leaderboard');
                const q = query(leaderboardCol, orderBy('score', 'desc'), limit(10));
                const leaderboardSnapshot = await getDocs(q);
                if (leaderboardSnapshot.empty) return { type: 'text', text: 'Leaderboard is empty. Be the first to score!' };
                const leaderboardList = leaderboardSnapshot.docs.map((doc, index) => {
                    const data = doc.data();
                    return `${index + 1}. ${data.email} - ${data.score} pts`;
                }).join('\n');
                return { type: 'text', text: `--- Top Players ---\n${leaderboardList}` };
            }
            case 'analyze-image': {
                if (!argString) return { type: 'text', text: 'Usage: analyze-image <image_url>' };
                updateWarlockAwareness(15, `analyzed external image: ${argString}`);
                const { analysis } = await analyzeImage({ imageUrl: argString });
                return { type: 'text', text: `Analysis Report:\n${analysis}` };
            }
            case 'investigate': {
                if (!argString) return { type: 'text', text: 'Usage: investigate <target>' };
                updateWarlockAwareness(10, `investigated target: ${argString}`);
                const { report } = await investigateTarget({ target: argString });
                return { type: 'text', text: `OSINT Report:\n${report}` };
            }
            case 'craft-phish': {
                const toIndex = args.findIndex(arg => arg === '--to');
                const topicIndex = args.findIndex(arg => arg === '--topic');
                if (toIndex === -1 || toIndex + 1 >= args.length) {
                    return { type: 'text', text: 'Usage: craft-phish --to <email> [--topic "<topic>"]' };
                }
                const targetEmail = args[toIndex + 1];
                const topic = topicIndex !== -1 && topicIndex + 1 < args.length
                    ? argString.split(/--topic/)[1].trim().slice(1, -1)
                    : 'Action Required';
                updateWarlockAwareness(25, `crafted phish for ${targetEmail}`);
                const { phishingEmail } = await craftPhish({ targetEmail, topic });
                return { type: 'text', text: `Phishing Email Draft:\n\n${phishingEmail}` };
            }
            case 'forge': {
                const promptIndex = args.findIndex(arg => arg === '--prompt');
                const filenameIndex = args.findIndex(arg => !arg.startsWith('--'));
                if (promptIndex === -1 || filenameIndex === -1 || promptIndex + 1 >= args.length) {
                    return { type: 'text', text: 'Usage: forge <filename> --prompt "<description>"' };
                }
                const filename = `forged_${args[filenameIndex]}`;
                const prompt = argString.split(/--prompt/)[1]?.trim().slice(1, -1);
                if (!prompt) {
                    return { type: 'text', text: 'Error: Prompt description cannot be empty.' };
                }
                updateWarlockAwareness(35, 'forged a new tool');
                const { code } = await forgeTool({ filename, prompt });
                const saveResult = await saveFile(resolvePath(filename), code);
                return { type: 'text', text: `Ghost: Tool '${filename}' has been forged.\n${saveResult}` };
            }
            case 'warlock-threat': {
                if (args[0] !== '--scan') return { type: 'text', text: 'Usage: warlock-threat --scan' };
                let report = `Warlock Threat Scan:\n- Current Awareness: ${warlockAwareness}%\n`;
                if (warlockAwareness < 20) report += "- Status: Dormant. No immediate threats detected.";
                else if (warlockAwareness < 70) report += "- Status: Active. System monitoring has increased. Traces found around core system files.";
                else report += "- Status: Hostile. Active countermeasures likely. Extreme caution advised. Threat signatures detected network-wide.";
                return { type: 'text', text: report };
            }
            case 'counter-measure': {
                 if (!user || viewedUser?.uid !== user.uid) return { type: 'text', text: `counter-measure: Permission denied.` };
                const typeIndex = args.findIndex(a => a === '--type');
                const targetIndex = args.findIndex(a => a === '--target');
                if (typeIndex === -1 || typeIndex + 1 >= args.length) {
                    return { type: 'text', text: 'Usage: counter-measure --type <decoy|logic-bomb> --target <path>' };
                }
                const type = args[typeIndex + 1];
                const targetPath = (targetIndex !== -1 && targetIndex + 1 < args.length) ? resolvePath(args[targetIndex + 1]) : cwd;
                
                const newFs = JSON.parse(JSON.stringify(userFilesystem));
                if (type === 'decoy') {
                    const decoyName = `decoy_${Math.random().toString(36).substring(2, 7)}`;
                    const parentNode = getNodeFromPath(targetPath, newFs);
                    if (parentNode?.type !== 'directory') return { type: 'text', text: 'Decoy target must be a directory.' };
                    parentNode.children[decoyName] = { type: 'directory', children: {} };
                    setUserFilesystem(newFs);
                    await updateFirestoreFilesystem(newFs);
                    updateWarlockAwareness(-15, 'decoy deployed');
                    return { type: 'text', text: `Decoy directory '${decoyName}' created at ${targetPath}. Warlock's attention may be diverted.`};
                } else if (type === 'logic-bomb') {
                    const targetNode = getNodeFromPath(targetPath, newFs);
                    if (!targetNode || targetNode.type !== 'file') return { type: 'text', text: 'Logic bomb target must be a file.'};
                    (targetNode as File).logicBomb = true;
                    setUserFilesystem(newFs);
                    await updateFirestoreFilesystem(newFs);
                    return { type: 'text', text: `Logic bomb planted in ${targetPath}. It will trigger if Warlock accesses the file.` };
                }
                return { type: 'text', text: `Invalid counter-measure type: ${type}. Use 'decoy' or 'logic-bomb'.` };
            }
            default:
                return null;
        }
    }

    const handleAdminCommands = async (cmd: string, args: string[], argString: string): Promise<CommandResult | null> => {
        if (!isRoot) return null;
        switch (cmd) {
            case 'db': {
                if (!argString.startsWith('"') || !argString.endsWith('"')) return { type: 'text', text: 'db: query must be enclosed in quotes. Usage: db "your natural language query"' };
                updateWarlockAwareness(5, `queried database`);
                const queryText = argString.slice(1, -1);
                const queryInstruction = await databaseQuery({ query: queryText });
                const whereClauses = queryInstruction.where.map(w => where(w[0], w[1] as WhereFilterOp, w[2]));
                const q = query(collection(db, queryInstruction.collection), ...whereClauses);
                const querySnapshot = await getDocs(q);
                if (querySnapshot.empty) return { type: 'text', text: "No documents found." };
                const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                return { type: 'text', text: JSON.stringify(results, null, 2) };
            }
            case 'list-users': {
                updateWarlockAwareness(10, `listed users`);
                const usersCollection = collection(db, 'users');
                const userSnapshot = await getDocs(usersCollection);
                const userList = userSnapshot.docs.map(doc => doc.data().email);
                return { type: 'text', text: userList.join('\n') };
            }
            case 'chuser': {
                if (!argString) return { type: 'text', text: 'Usage: chuser <email>' };
                if (user && argString === user.email) {
                    setViewedUser({ uid: user.uid, email: user.email! });
                    return { type: 'none' };
                }
                const q = query(collection(db, 'users'), where("email", "==", argString));
                const querySnapshot = await getDocs(q);
                if (querySnapshot.empty) return { type: 'text', text: `User ${argString} not found.` };
                const targetUserDoc = querySnapshot.docs[0];
                setViewedUser({ uid: targetUserDoc.id, email: targetUserDoc.data().email });
                return { type: 'none' };
            }
            default:
                return null;
        }
    }

    const executeCommandsSequentially = useCallback(async (commandsToExecute: { command: string, args: string[] }[]) => {
        setIsProcessing(true);
        for (const cmd of commandsToExecute) {
            const fullCommand = `${cmd.command} ${cmd.args.join(' ')}`;
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            await processCommand(fullCommand, true);
        }
        setIsProcessing(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const processCommand = useCallback(async (command: string, isPlannedExecution: boolean = false): Promise<CommandResult> => {
        setIsProcessing(true);

        const [cmdCandidate, ...initialArgs] = command.trim().split(/\s+/);
        let finalCmd = cmdCandidate;
        let finalArgs = initialArgs;

        if (aliases[cmdCandidate]) {
            const aliasParts = aliases[cmdCandidate].split(/\s+/);
            finalCmd = aliasParts[0];
            finalArgs = [...aliasParts.slice(1), ...initialArgs];
        }

        const argString = finalArgs.join(' ');
        const lowerCaseCmd = finalCmd.toLowerCase();

        if (!user) {
            setIsProcessing(false);
            switch (lowerCaseCmd) {
                case 'help': return { type: 'text', text: getHelpOutput(false, false, isMobile) };
                case '': return { type: 'none' };
                case 'login': case 'register': return { type: 'none' };
                default:
                    updateWarlockAwareness(5, `invalid command: ${lowerCaseCmd}`);
                    return { type: 'text', text: `Command not found: ${finalCmd}. Please 'login' or 'register'.` };
            }
        }

        try {
            const filePathArg = resolvePath(argString);
            if (filePathArg.endsWith('.locked')) {
                updateWarlockAwareness(15, `attempted to access locked file ${filePathArg}`);
                return { type: 'text', text: `Error: Access to ${argString} is blocked by an active security agent.` };
            }

            if (lowerCaseCmd === 'python' || lowerCaseCmd === 'bash' || lowerCaseCmd === 'sh') {
                let filename = finalArgs[0];
                if (!filename) {
                    return { type: 'text', text: `Usage: ${lowerCaseCmd} <filename>` };
                }

                const extension = lowerCaseCmd === 'python' ? '.py' : '.sh';
                if (!filename.endsWith(extension)) {
                    filename = `${filename}${extension}`;
                }

                const node = getNodeFromPath(filename, userFilesystem);
                if (!node) {
                    return { type: 'text', text: `${lowerCaseCmd}: cannot access '${finalArgs[0]}': No such file or directory` };
                }
                return executeFile(node);
            }

            if (lowerCaseCmd === 'help') return { type: 'text', text: getHelpOutput(true, isRoot, isMobile) };
            if (lowerCaseCmd === 'neofetch') return { type: 'text', text: getNeofetchOutput(viewedUser) };
            if (lowerCaseCmd === 'logout') { await auth.signOut(); return { type: 'text', text: 'Logged out successfully.' }; }
            if (lowerCaseCmd === '') return { type: 'none' };

            let result: CommandResult | null = null;

            result = await handleFileSystemCommands(lowerCaseCmd, finalArgs, argString);
            if (result) return result;

            result = await handleCtfCommands(lowerCaseCmd, finalArgs, argString, isPlannedExecution);
            if (result) return result;

            result = await handleAdminCommands(lowerCaseCmd, finalArgs, argString);
            if (result) return result;

            // If no command was matched
            updateWarlockAwareness(5, `failed command: ${finalCmd}`);
            const helpResult = await generateCommandHelp({ command: finalCmd });
            return { type: 'text', text: `bash: command not found: ${finalCmd}\n\n${helpResult.helpMessage}` };

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
    }, [aliases, cwd, executeCommandsSequentially, executeFile, isMobile, isRoot, resolvePath, saveFile, setAwaitingConfirmation, toast, updateWarlockAwareness, user, userFilesystem, viewedUser, fetchUserFilesystem, getParentNodeFromPath, getNodeFromPath, getPrompt]);

    return {
        prompt,
        processCommand,
        getWelcomeMessage,
        isProcessing,
        editingFile,
        saveFile,
        exitEditor,
        warlockMessages,
        clearWarlockMessages,
        isRoot,
        viewedUser,
    };
};
