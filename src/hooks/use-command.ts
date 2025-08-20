'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { databaseQuery } from '@/ai/flows/database-query-flow';
import { askSidekick } from '@/ai/flows/ai-sidekick-flow';
import { initialFilesystem, Directory, FilesystemNode } from '@/lib/filesystem';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, WhereFilterOp, doc, setDoc, getDoc, updateDoc, writeBatch, orderBy, limit } from 'firebase/firestore';
import { User } from 'firebase/auth';
import ImageDisplay from '@/components/image-display';
import { generateCommandHelp } from '@/ai/flows/generate-command-help';
import { scanFile } from '@/ai/flows/scan-file-flow';
import { generateAttackPlan } from '@/ai/flows/attack-planner-flow';
import { generateWarlockTaunt } from '@/ai/flows/warlock-threat-flow';
import { analyzeImage } from '@/ai/flows/analyze-image-flow';
import { investigateTarget } from '@/ai/flows/investigation-flow';
import { craftPhish } from '@/ai/flows/craft-phish-flow';
import { forgeTool } from '@/ai/flows/forge-tool-flow';
import { concealMessage, revealMessage } from '@/ai/flows/steganography-flow';

type EditingFile = { path: string; content: string } | null;
type CommandResult = 
  | { type: 'text', text: string }
  | { type: 'component', component: React.ReactNode }
  | { type: 'none' };

type SetAwaitingConfirmationFn = (
    message: string,
    onConfirm: () => void,
    onDeny: () => void
) => void;

interface WarlockMessage {
  id: number;
  text: string;
}

const ROOT_EMAIL = "alqorniu552@gmail.com";

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
        ];
        
        const ctfTools = [
            { command: 'missions', args: '', description: 'List available missions.'},
            { command: 'submit-flag', args: '<flag>', description: 'Submit a found flag.'},
            { command: 'score', args: '', description: 'Check your current score.'},
            { command: 'leaderboard', args: '', description: 'View the top players.'},
            { command: 'ask', args: '"<question>"', description: 'Ask the AI sidekick for a hint.'},
            { command: 'scan', args: '<file>', description: 'Scan a file for vulnerabilities.'},
            { command: 'nmap', args: '<ip>', description: 'Scan a target IP for open ports.'},
            { command: 'imagine', args: '"<prompt>"', description: 'Generate an image with AI.'},
            { command: 'crack', args: '<hash> --wordlist <file>', description: 'Crack a password hash.'},
            { command: 'reveal', args: '<image_file>', description: 'Reveal secrets in an image.'},
            { command: 'attack', args: '<target> --obj "<goal>"', description: 'Plan & execute an AI attack.'},
            { command: 'analyze-image', args: '<url>', description: 'Analyze an image for clues.' },
            { command: 'investigate', args: '<target>', description: 'Run an OSINT investigation.' },
            { command: 'craft-phish', args: '--to <email>', description: 'Craft a phishing email.' },
            { command: 'forge', args: '<file> --prompt "<desc>"', description: 'Forge a new tool with AI.'},
        ];
        
        const rootCommands = [
            { command: 'db', args: '"query"', description: 'Query the database (admin only).' },
            { command: 'list-users', args: '', description: 'List all registered users.'},
            { command: 'chuser', args: '<email>', description: 'Switch to another user\'s view.'},
            { command: 'conceal', args: '--image <f> --msg "m"', description: 'Hide message in an image.'},
        ];

        output += formatFn('USER COMMANDS', userCommands);
        output += formatFn('CTF & HACKING TOOLS', ctfTools);

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

export const useCommand = (
    user: User | null | undefined, 
    isMobile: boolean,
    setAwaitingConfirmation: SetAwaitingConfirmationFn
) => {
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
  const { toast } = useToast();

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
          const newAwareness = Math.min(100, prev + amount);

          if (warlockTimeoutRef.current) {
              clearTimeout(warlockTimeoutRef.current);
          }

          if (newAwareness > 30 && newAwareness < 60 && Math.random() < 0.2) {
              triggerWarlockMessage(action);
          } else if (newAwareness >= 60 && newAwareness < 90 && Math.random() < 0.5) {
              triggerWarlockMessage(action);
          } else if (newAwareness >= 90 && Math.random() < 0.8) {
              triggerWarlockMessage(action);
          }

          warlockTimeoutRef.current = setTimeout(() => {
              setWarlockAwareness(curr => Math.max(0, curr - 10));
          }, 30000); // Decrease awareness every 30 seconds of inactivity

          return newAwareness;
      });
  }, [triggerWarlockMessage]);
  
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

  const parseAliases = useCallback((fs: Directory) => {
    const newAliases: Record<string, string> = {};
    const bashrcNode = getNodeFromPath('/.bashrc', fs);
    if (bashrcNode && bashrcNode.type === 'file') {
        const content = typeof bashrcNode.content === 'function' ? bashrcNode.content() : bashrcNode.content;
        const lines = (content as string).split('\n');
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
  
  const warlockFileLock = useCallback(async (filePath: string) => {
      if (!warlockIsActive.current) return;
      const newFs = JSON.parse(JSON.stringify(userFilesystem));
      const parentNode = getParentNodeFromPath(filePath, newFs);
      const filename = filePath.split('/').pop();

      if (parentNode && filename && parentNode.children[filename]) {
          const originalNode = parentNode.children[filename];
          delete parentNode.children[filename];
          parentNode.children[`${filename}.locked`] = originalNode;
          
          setUserFilesystem({ ...newFs });
          await updateFirestoreFilesystem(newFs);
          await triggerWarlockMessage(`locked ${filename}`);
      }
  }, [userFilesystem, getParentNodeFromPath, updateFirestoreFilesystem, triggerWarlockMessage]);

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
    setPrompt(getPrompt());
  }, [getPrompt]);

  useEffect(() => {
    if (viewedUser?.uid) {
      fetchUserFilesystem(viewedUser.uid);
    } else {
      setUserFilesystem(initialFilesystem);
      parseAliases(initialFilesystem);
      setCwd('/');
    }
  }, [viewedUser, fetchUserFilesystem, parseAliases]);

  const getWelcomeMessage = useCallback(() => {
    if (user) {
        if (isRoot && user.email === ROOT_EMAIL) {
            return `Welcome, root. System privileges granted. Type 'help' for a list of commands.`;
        }
        return `Welcome back, ${user.email}! Type 'help' for a list of commands.`;
    }
    return `Welcome to Cyber! Please 'login' or 'register' to continue.`;
  }, [user, isRoot]);


  useEffect(() => {
      if (warlockAwareness > 75 && Math.random() > 0.5) {
          const sensitiveFiles = ['/auth.log', '/shadow.bak', '/secret.jpg'];
          const targetFile = sensitiveFiles[Math.floor(Math.random() * sensitiveFiles.length)];
          const node = getNodeFromPath(targetFile, userFilesystem);
          if (node) {
              warlockFileLock(targetFile);
              setWarlockAwareness(prev => prev - 20); // Reduce awareness after taking action
          }
      }
  }, [warlockAwareness, warlockFileLock, userFilesystem, getNodeFromPath]);

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
          parentNode.children[filename] = { type: 'file', content: content };
          setUserFilesystem({ ...newFs });
          await updateFirestoreFilesystem(newFs);
          return `File saved: ${path}`;
      }
      return `Error: Could not save file to path '${path}'.`;
  }, [userFilesystem, resolvePath, getParentNodeFromPath, updateFirestoreFilesystem, viewedUser, user]);

  const exitEditor = useCallback(() => {
      setEditingFile(null);
  }, []);

  const executeCommandsSequentially = useCallback(async (commandsToExecute: { command: string, args: string[] }[]) => {
      setIsProcessing(true);
      for (const cmd of commandsToExecute) {
          const fullCommand = `${cmd.command} ${cmd.args.join(' ')}`;
          // This is a simplification. A real implementation might need to update the Terminal component's state directly.
          console.log(`Executing planned command: ${fullCommand}`);
          // The processCommand function is defined below and will be in scope.
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          await processCommand(fullCommand, true); 
      }
      setIsProcessing(false);
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
    const isLoggedIn = !!user;

    if (!isLoggedIn) {
      setIsProcessing(false); 
      switch (finalCmd.toLowerCase()) {
        case 'help': return { type: 'text', text: getHelpOutput(false, false, isMobile) };
        case '': return { type: 'none' };
        case 'login': case 'register': return { type: 'none' };
        default: 
            updateWarlockAwareness(5, `invalid command: ${finalCmd}`);
            return { type: 'text', text: `Command not found: ${finalCmd}. Please 'login' or 'register'.` };
      }
    }
    
    try {
        const filePathArg = resolvePath(argString);
        if (filePathArg.endsWith('.locked')) {
            updateWarlockAwareness(15, `attempted to access locked file ${filePathArg}`);
            return { type: 'text', text: `Error: Access to ${argString} is blocked by an active security agent.`};
        }

        switch (finalCmd.toLowerCase()) {
          case 'help': return { type: 'text', text: getHelpOutput(true, isRoot, isMobile) };
          case 'neofetch': return { type: 'text', text: getNeofetchOutput(viewedUser) };
          case 'ls': {
            const targetPath = argString ? resolvePath(argString) : cwd;
            const node = getNodeFromPath(targetPath, userFilesystem);
            if (node && node.type === 'directory') {
              const content = Object.keys(node.children);
              if (content.length === 0) return { type: 'text', text: '' };
              const output = content.map(key => {
                const childNode = node.children[key];
                const isLocked = key.endsWith('.locked');
                const displayName = isLocked ? key : (childNode.type === 'directory' ? `${key}/` : key);
                return displayName;
              }).join('\n');
              return { type: 'text', text: output };
            }
            return { type: 'text', text: `ls: cannot access '${argString || '.'}': No such file or directory` };
          }
          case 'cd': {
            if (!argString || argString === '~' || argString === '/') { setCwd('/'); return { type: 'none' }; }
            const newPath = resolvePath(argString);
            const node = getNodeFromPath(newPath, userFilesystem);
            if (node && node.type === 'directory') { setCwd(newPath); return { type: 'none' }; }
            return { type: 'text', text: `cd: no such file or directory: ${argString}` };
          }
          case 'cat': {
            if (!argString) return { type: 'text', text: 'cat: missing operand' };
            if (argString.includes('auth.log')) updateWarlockAwareness(10, 'accessed auth.log');
            if (argString.includes('shadow.bak')) updateWarlockAwareness(15, 'accessed shadow.bak');
            const targetPath = resolvePath(argString);
            const node = getNodeFromPath(targetPath, userFilesystem);
            if (node && node.type === 'file') {
                const content = typeof node.content === 'function' ? node.content() : node.content;
                return { type: 'text', text: content as string };
            }
            return { type: 'text', text: `cat: ${argString}: No such file or directory` };
          }
          case 'nano': {
            if (!user || viewedUser?.uid !== user.uid) return { type: 'text', text: `nano: You can only edit your own files.` };
            if (!argString) return { type: 'text', text: 'Usage: nano <filename>' };
            const targetPath = resolvePath(argString);
            const node = getNodeFromPath(targetPath, userFilesystem);
            if (node && node.type === 'directory') return { type: 'text', text: `nano: ${argString}: Is a directory` };
            const content = (node && node.type === 'file') ? (typeof node.content === 'function' ? node.content() : node.content) : '';
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
                parentNode.children[filename] = { type: 'file', content: '' };
                setUserFilesystem({ ...newFs });
                await updateFirestoreFilesystem(newFs);
                return { type: 'none' };
            }
            return { type: 'text', text: `touch: cannot touch '${argString}': No such file or directory` };
          }
          case 'rm': {
            if (!user || viewedUser?.uid !== user.uid) return { type: 'text', text: `rm: Permission denied.` };
            if (!argString) return { type: 'text', text: 'rm: missing operand' };
            
            if (resolvePath(argString) === '/var/lib/warlock.core') {
                 updateWarlockAwareness(50, 'attempted to delete warlock.core');
            }

            const newFs = JSON.parse(JSON.stringify(userFilesystem));
            const targetPath = resolvePath(argString);
            if (targetPath === '/') return { type: 'text', text: `rm: cannot remove '/': Is a directory` };
            const parentNode = getParentNodeFromPath(targetPath, newFs);
            const nodeName = targetPath.split('/').pop();
            if (parentNode && nodeName && parentNode.children[nodeName]) {
                const nodeToRemove = parentNode.children[nodeName];
                if (nodeToRemove.type === 'directory' && Object.keys(nodeToRemove.children).length > 0 && finalArgs[0] !== '-r') {
                    return { type: 'text', text: `rm: cannot remove '${argString}': Directory not empty` };
                }
                delete parentNode.children[nodeName];
                setUserFilesystem({ ...newFs });
                await updateFirestoreFilesystem(newFs);
                 if (resolvePath(argString) === '/var/lib/warlock.core') {
                    warlockIsActive.current = false;
                    setWarlockAwareness(0);
                    if (warlockTimeoutRef.current) clearTimeout(warlockTimeoutRef.current);
                    return { type: 'text', text: `SYSTEM INTEGRITY COMPROMISED. WARLOCK CORE OFFLINE.`};
                }
                return { type: 'none' };
            }
            return { type: 'text', text: `rm: cannot remove '${argString}': No such file or directory` };
          }
          case 'imagine': {
            const prompt = argString.startsWith('"') && argString.endsWith('"') ? argString.slice(1, -1) : argString;
            if (!prompt) return { type: 'text', text: 'Usage: imagine <your prompt>' };
            return { component: <ImageDisplay prompt={prompt} onFinished={() => {}} />, type: 'component' };
          }
          case 'nmap': {
              if (!argString) return { type: 'text', text: 'Usage: nmap <ip_address>' };
              updateWarlockAwareness(5, `nmap scan on ${argString}`);
              const result = virtualHosts[argString] || `Failed to resolve "${argString}".`;
              return { type: 'text', text: `Starting Nmap...\n${result}`};
          }
          case 'gobuster': { // Simulated command
              if (isPlannedExecution) {
                 updateWarlockAwareness(10, 'gobuster execution');
                 const gobusterNode = getNodeFromPath('/gobuster.txt', userFilesystem);
                 if (gobusterNode && gobusterNode.type === 'file') {
                     return { type: 'text', text: (typeof gobusterNode.content === 'function' ? gobusterNode.content() : gobusterNode.content) as string };
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
            const content = (node.type === 'file' && typeof node.content === 'function') 
              ? node.content() 
              : (node.type === 'file' ? node.content : 'This is a directory.');
            const { report } = await scanFile({ filename: argString, content: content as string });
            return { type: 'text', text: report };
          }
          case 'crack': {
            updateWarlockAwareness(25, `started password cracking`);
            const hashArgIndex = finalArgs.findIndex(a => a.startsWith(""));
            const wordlistFlagIndex = finalArgs.findIndex(a => a === '--wordlist');
            if (hashArgIndex === -1 || wordlistFlagIndex === -1 || wordlistFlagIndex + 1 >= finalArgs.length) {
              return { type: 'text', text: 'Usage: crack <hash> --wordlist <file_path>' };
            }
            const hash = finalArgs[hashArgIndex];
            const wordlistPath = finalArgs[wordlistFlagIndex + 1];
            const wordlistNode = getNodeFromPath(wordlistPath, userFilesystem);
            if (!wordlistNode || wordlistNode.type !== 'file') {
              return { type: 'text', text: `crack: wordlist file not found: ${wordlistPath}` };
            }
            const wordlistContent = typeof wordlistNode.content === 'function' ? wordlistNode.content() : wordlistNode.content as string;
            const words = wordlistContent.split('\n');
            for (const word of words) {
              if (md5(word.trim()) === hash) {
                 updateWarlockAwareness(30, `successfully cracked password`);
                return { type: 'text', text: `Password found: ${word}` };
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
            const imageData = (typeof imageNode.content === 'function' ? imageNode.content() : imageNode.content) as string;
            const { revealedMessage } = await revealMessage({ imageDataUri: imageData });
            return { type: 'text', text: revealedMessage };
          }
          case 'conceal': {
            if (!isRoot) return { type: 'text', text: `bash: command not found: conceal` };
            const imageFlagIndex = finalArgs.findIndex(a => a === '--image');
            const msgFlagIndex = finalArgs.findIndex(a => a === '--msg');
            if (imageFlagIndex === -1 || msgFlagIndex === -1 || imageFlagIndex + 1 >= finalArgs.length || msgFlagIndex + 1 >= finalArgs.length) {
                return { type: 'text', text: 'Usage: conceal --image <file_path> --msg "<message>"' };
            }
            const imagePath = finalArgs[imageFlagIndex + 1];
            const message = argString.split('--msg')[1]?.trim().slice(1, -1) || '';
            const imageNode = getNodeFromPath(imagePath, userFilesystem);
            if (!imageNode || imageNode.type !== 'file') return { type: 'text', text: `conceal: file not found: ${imagePath}` };

            const imageData = (typeof imageNode.content === 'function' ? imageNode.content() : imageNode.content) as string;
            const { newImageDataUri } = await concealMessage({ imageDataUri: imageData, message });
            
            const saveResult = await saveFile(imagePath, newImageDataUri);
            return { type: 'text', text: `Message concealed. ${saveResult}` };
          }
          case 'attack': {
              const targetIndex = finalArgs.findIndex(arg => !arg.startsWith('--'));
              const objectiveIndex = finalArgs.findIndex(arg => arg === '--objective' || arg === '--obj');

              if (targetIndex === -1 || objectiveIndex === -1 || objectiveIndex + 1 >= finalArgs.length) {
                  return { type: 'text', text: 'Usage: attack <target> --obj[ective] "<goal>"' };
              }
              const target = finalArgs[targetIndex];
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
              if (missionsSnapshot.empty) return { type: 'text', text: 'No missions available. Check back later, agent.'};
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
                    return { type: 'text', text: 'Incorrect flag. Keep trying.' 
                };
                }
                
                const missionDoc = missionSnapshot.docs[0];
                const missionId = missionDoc.id;
                const missionData = missionDoc.data();
                if (!user) return {type: 'text', text: 'Error: User not logged in.'};
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
                if (!user) return {type: 'text', text: 'Error: User not logged in.'};
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
            const toIndex = finalArgs.findIndex(arg => arg === '--to');
            const topicIndex = finalArgs.findIndex(arg => arg === '--topic');
            if (toIndex === -1 || toIndex + 1 >= finalArgs.length) {
              return { type: 'text', text: 'Usage: craft-phish --to <email> [--topic "<topic>"]' };
            }
            const targetEmail = finalArgs[toIndex + 1];
            const topic = topicIndex !== -1 && topicIndex + 1 < finalArgs.length
              ? argString.split(/--topic/)[1].trim().slice(1, -1)
              : 'Action Required';
            updateWarlockAwareness(25, `crafted phish for ${targetEmail}`);
            const { phishingEmail } = await craftPhish({ targetEmail, topic });
            return { type: 'text', text: `Phishing Email Draft:\n\n${phishingEmail}` };
          }
          case 'forge': {
            const promptIndex = finalArgs.findIndex(arg => arg === '--prompt');
            if (promptIndex === -1 || finalArgs.length <= 1) {
              return { type: 'text', text: 'Usage: forge <filename> --prompt "<description>"' };
            }
            const filename = finalArgs[0];
            const prompt = argString.split(/--prompt/)[1]?.trim().slice(1, -1);
            if (!prompt) {
              return { type: 'text', text: 'Error: Prompt description cannot be empty.' };
            }
            updateWarlockAwareness(35, 'forged a new tool');
            const { code } = await forgeTool({ filename, prompt });
            const saveResult = await saveFile(resolvePath(filename), code);
            return { type: 'text', text: `Ghost: Tool '${filename}' has been forged.\n${saveResult}` };
          }
          case 'db': {
            if (!isRoot) return { type: 'text', text: `bash: command not found: db` };
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
              if (!isRoot) return { type: 'text', text: `bash: command not found: ${finalCmd}` };
              updateWarlockAwareness(10, `listed users`);
              const usersCollection = collection(db, 'users');
              const userSnapshot = await getDocs(usersCollection);
              const userList = userSnapshot.docs.map(doc => doc.data().email);
              return { type: 'text', text: userList.join('\n') };
          }
          case 'chuser': {
              if (!isRoot) return { type: 'text', text: `bash: command not found: ${finalCmd}` };
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
          case 'logout': { await auth.signOut(); return { type: 'text', text: 'Logged out successfully.' }; }
          case '': return { type: 'none' };
          default: {
            updateWarlockAwareness(5, `failed command: ${finalCmd}`);
            const result = await generateCommandHelp({ command: finalCmd });
            return { type: 'text', text: `bash: command not found: ${finalCmd}\n\n${result.helpMessage}`};
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
  }, [aliases, cwd, getParentNodeFromPath, getPrompt, getNodeFromPath, isMobile, isRoot, resolvePath, saveFile, setAwaitingConfirmation, toast, updateWarlockAwareness, user, userFilesystem, viewedUser, fetchUserFilesystem, executeCommandsSequentially]);
  
  const clearWarlockMessages = useCallback(() => {
    setWarlockMessages([]);
  }, []);

  return { prompt, processCommand, getWelcomeMessage, isProcessing, editingFile, saveFile, exitEditor, warlockMessages, clearWarlockMessages };
};
