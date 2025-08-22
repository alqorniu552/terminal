"use client";

import React, { useState, useCallback, useEffect, useReducer } from 'react';
import { useToast } from "@/hooks/use-toast";
import { generateCommandHelp } from '@/ai/flows/generate-command-help';
import { databaseQuery } from '@/ai/flows/database-query-flow';
import { askSidekick } from '@/ai/flows/ai-sidekick-flow';
import { scanFile } from '@/ai/flows/scan-file-flow';
import { generateWarlockTaunt } from '@/ai/flows/warlock-threat-flow';
import { revealMessage } from '@/ai/flows/steganography-flow';
import { investigateTarget } from '@/ai/flows/osint-investigation-flow';
import { craftPhish } from '@/ai/flows/craft-phish-flow';
import { forgeTool } from '@/ai/flows/forge-tool-flow';
import { analyzeImage } from '@/ai/flows/analyze-image-flow';
import { generateImage } from '@/ai/flows/generate-image-flow';
import { generateVideo } from '@/ai/flows/generate-video-flow';
import ImageDisplay from '@/components/image-display';
import VideoDisplay from '@/components/video-display';


import { filesystem, Directory, FilesystemNode, File, getDynamicContent, updateNodeInFilesystem, removeNodeFromFilesystem, addNodeToFilesystem, getWordlist } from '@/lib/filesystem';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, WhereFilterOp } from 'firebase/firestore';
import { User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import md5 from 'md5';

// State Management
interface CommandState {
  cwd: string;
  isRoot: boolean;
  warlockAwareness: number;
  isProcessing: boolean;
  commandJustFinished: boolean;
  confirmation: {
    message: string;
    onConfirm: () => Promise<string | React.ReactNode>;
  } | null;
}

type Action =
  | { type: 'SET_CWD'; payload: string }
  | { type: 'SET_IS_ROOT'; payload: boolean }
  | { type: 'SET_WARLOCK_AWARENESS'; payload: number }
  | { type: 'START_PROCESSING' }
  | { type: 'FINISH_PROCESSING' }
  | { type: 'SET_CONFIRMATION'; payload: CommandState['confirmation'] }
  | { type: 'RESET' };

const initialState: CommandState = {
  cwd: '/',
  isRoot: false,
  warlockAwareness: 0,
  isProcessing: false,
  commandJustFinished: false,
  confirmation: null,
};

function commandReducer(state: CommandState, action: Action): CommandState {
  switch (action.type) {
    case 'SET_CWD':
      return { ...state, cwd: action.payload };
    case 'SET_IS_ROOT':
      return { ...state, isRoot: action.payload };
    case 'SET_WARLOCK_AWARENESS':
      return { ...state, warlockAwareness: Math.min(100, action.payload) };
    case 'START_PROCESSING':
        return { ...state, isProcessing: true, commandJustFinished: false };
    case 'FINISH_PROCESSING':
        return { ...state, isProcessing: false, commandJustFinished: true };
    case 'SET_CONFIRMATION':
      return { ...state, confirmation: action.payload };
    case 'RESET':
        return { ...state, confirmation: null, isProcessing: false, commandJustFinished: false };
    default:
      return state;
  }
}

// Helper Functions
const resolvePath = (cwd: string, path: string): string => {
  const newPath = new URL(path, `file://${cwd}/`).pathname;
  return newPath;
};

const getNodeFromPath = (path: string): FilesystemNode | null => {
  const parts = path.split('/').filter(p => p);
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

const getParentPath = (path: string) => {
    const parts = path.split('/').filter(p => p);
    parts.pop();
    return '/' + parts.join('/');
}

const hasPermission = (path: string, type: 'read' | 'write' | 'execute', isRoot: boolean, user: User | null | undefined): boolean => {
    if (isRoot) return true;

    const normalizedPath = resolvePath('/', path);
    const userHome = user ? `/home/${user.email?.split('@')[0]}` : null;

    const readWhitelist = [
        '/',
        '/home',
        '/etc',
        '/var',
        '/var/log',
        '/bin',
        '/lib',
        '/tmp',
        '/a.out',
        '/secret.jpg',
        '/welcome.txt',
    ];

    if (userHome) {
        readWhitelist.push(userHome);
    }
    
    // Add all children of whitelisted directories for read access
    const dynamicReadWhitelist = [...readWhitelist];
    readWhitelist.forEach(p => {
        const node = getNodeFromPath(p);
        if (node && node.type === 'directory') {
            Object.keys(node.children).forEach(child => {
                dynamicReadWhitelist.push(`${p}/${child}`.replace('//', '/'));
            });
        }
    });
    // Add children of user's home directory
    if (userHome) {
        const homeNode = getNodeFromPath(userHome);
        if (homeNode && homeNode.type === 'directory') {
             Object.keys(homeNode.children).forEach(child => {
                dynamicReadWhitelist.push(`${userHome}/${child}`);
            });
        }
    }


    const writeWhitelist = ['/tmp'];
    if (userHome) {
        writeWhitelist.push(userHome);
         const homeNode = getNodeFromPath(userHome);
        if (homeNode && homeNode.type === 'directory') {
             Object.keys(homeNode.children).forEach(child => {
                writeWhitelist.push(`${userHome}/${child}`);
            });
        }
    }

    const executeWhitelist = ['/bin/linpeas.sh'];

    switch (type) {
        case 'read':
            return dynamicReadWhitelist.some(p => normalizedPath === p || normalizedPath.startsWith(p + '/'));
        case 'write':
            return writeWhitelist.some(p => normalizedPath === p || normalizedPath.startsWith(p + '/'));
        case 'execute':
            return executeWhitelist.includes(normalizedPath);
        default:
            return false;
    }
};

// Hook
interface CommandHookProps {
    setEditorState: (state: {filename: string, content: string} | null) => void;
    setIsTyping: (isTyping: boolean) => void;
}

export const useCommand = (user: User | null | undefined, { setEditorState, setIsTyping }: CommandHookProps) => {
  const [state, dispatch] = useReducer(commandReducer, initialState);
  const { cwd, isRoot, warlockAwareness, isProcessing, commandJustFinished, confirmation } = state;
  const { toast } = useToast();

  useEffect(() => {
    // Reset state on user change
    dispatch({ type: 'SET_CWD', payload: '/' });
    dispatch({ type: 'SET_IS_ROOT', payload: false });
  }, [user]);

  const triggerWarlock = useCallback(async (action: string, awarenessIncrement: number) => {
    const newAwareness = warlockAwareness + awarenessIncrement;
    dispatch({ type: 'SET_WARLOCK_AWARENESS', payload: newAwareness });
    if (Math.random() * 100 < newAwareness / 2) { // Chance of taunt increases with awareness
      const { taunt } = await generateWarlockTaunt({ action, awareness: newAwareness });
      toast({
          variant: "destructive",
          title: "Warlock System",
          description: taunt,
      });
    }
  }, [warlockAwareness, toast]);

  const getPrompt = useCallback(() => {
    const path = cwd === '/' ? '~' : `~${cwd}`;
    const userIdentifier = isRoot ? 'root' : user?.email?.split('@')[0] || 'guest';
    const host = 'command-center';
    const terminator = isRoot ? '#' : '$';
    return `${userIdentifier}@${host}:${path}${terminator}`;
  }, [cwd, isRoot, user]);

  const getWelcomeMessage = useCallback(() => {
    if (user) {
      return `Welcome, ${user.email}! Type 'help' for a list of commands.`;
    }
    return `Welcome to Command Center! Please 'login' or 'register' to continue.`;
  }, [user]);

  const getHelpOutput = (isLoggedIn: boolean, isRoot: boolean) => {
        let baseCommands = `
  help          - Show this help message.
  ls [path]     - List directory contents.
  cd [path]     - Change directory.
  cat [file]    - Display file content.
  neofetch      - Display system information.
  db "[query]"  - Query the database using natural language.
  clear         - Clear the terminal screen.
  ask "[query]" - Ask your AI sidekick for a cryptic hint.
    `;
    
        if (isLoggedIn) {
            baseCommands += `
  mkdir [dir]   - Create a directory.
  touch [file]  - Create an empty file.
  rm [file/dir] - Remove a file or directory.
  nano [file]   - Edit a file in a simple text editor.
  scan <file>   - Scan a file for vulnerabilities.
  crack <file>  - Attempt to crack a password hash file.
  reveal <img_file> - Reveal secrets hidden in an image.
  osint <target>- Conduct OSINT on a target (e.g., email).
  phish <email> - Craft a phishing email for a target.
  forge <tool> "[prompt]" - Generate a tool with AI.
  analyze <url> - Analyze an image from a URL for clues.
  generate_image "[prompt]" - Generate an image with AI.
  generate_video "[prompt]" - Generate a video with AI.
  logout        - Log out from the application.
  su [user]     - Switch user (e.g., su root).
    `;
        } else {
            baseCommands += `
  login [email] [password] - Log in to your account.
  register [email] [password] - Create a new account.
    `;
        }

        if (isRoot) {
            baseCommands += `
  exit          - Exit root shell.
    `;
        }

        return `Available commands:${baseCommands}\nFor unrecognized commands, AI will try to provide assistance.`;
    }
    

  const processCommand = useCallback(async (command: string): Promise<string | React.ReactNode> => {
    try {
        const [cmd, ...args] = command.trim().split(/\s+/);
        const isLoggedIn = !!user;

        if (confirmation) {
            if (cmd.toLowerCase() === 'y' || cmd.toLowerCase() === 'yes') {
                const result = await confirmation.onConfirm();
                dispatch({ type: 'SET_CONFIRMATION', payload: null });
                return result;
            } else {
                dispatch({ type: 'SET_CONFIRMATION', payload: null });
                return 'Operation cancelled.';
            }
        }
        
        // --- Auth Commands (Not logged in) ---
        if (!isLoggedIn) {
            switch (cmd.toLowerCase()) {
                case 'login': {
                    const [email, password] = args;
                    if (!email || !password) return `Usage: login [email] [password]`;
                    try {
                        await signInWithEmailAndPassword(auth, email, password);
                        return 'Login successful.';
                    } catch (error: any) {
                        return `Error: ${error.message}`;
                    }
                }
                case 'register': {
                    const [email, password] = args;
                    if (!email || !password) return `Usage: register [email] [password]`;
                    try {
                        await createUserWithEmailAndPassword(auth, email, password);
                        return 'Registration successful.';
                    } catch (error: any) {
                        return `Error: ${error.message}`;
                    }
                }
                case 'help': return getHelpOutput(false, false);
                case '': return '';
                default: return `Command not found: ${cmd}. Please 'login' or 'register'.`;
            }
        }

        // --- Logged In Commands ---
        const argString = args.join(' ');

        switch (cmd.toLowerCase()) {
            // Internal command to handle editor save
            case '__save_buffer__': {
                const [filePath, encodedContent] = args;
                const decodedContent = atob(encodedContent);
                const fullPath = resolvePath(cwd, filePath);
                if (!hasPermission(fullPath, 'write', isRoot, user)) {
                    return `Permission denied: ${filePath}`;
                }
                updateNodeInFilesystem(fullPath, decodedContent);
                return `File saved: ${filePath}`;
            }

            // Standard commands
            case 'help': return getHelpOutput(true, isRoot);
            case 'neofetch': {
                let uptime = 0;
                if (typeof window !== 'undefined') {
                    uptime = Math.floor(performance.now() / 1000);
                }
                const email = user?.email || 'guest';
                const userIdentifier = isRoot ? 'root' : email.split('@')[0];
                return `
${userIdentifier}@command-center
--------------------
OS: Web Browser (Simulated)
Host: Command Center v1.0
Kernel: Next.js/React
Uptime: ${uptime} seconds
Shell: term-sim
Root: ${isRoot}
Awareness: ${warlockAwareness}%
`;
            }

            // Filesystem commands
            case 'ls': {
                const targetPath = argString ? resolvePath(cwd, argString) : cwd;
                if (!hasPermission(targetPath, 'read', isRoot, user)) {
                     await triggerWarlock(`denied ls on ${targetPath}`, 2);
                    return `ls: cannot access '${argString || '.'}': Permission denied`;
                }
                const node = getNodeFromPath(targetPath);
                if (node && node.type === 'directory') {
                     await triggerWarlock(`ls on ${targetPath}`, 0.5);
                    return Object.keys(node.children).map(key => {
                        return node.children[key].type === 'directory' ? `\x1b[1;34m${key}/\x1b[0m` : key;
                    }).join('\n');
                }
                return `ls: cannot access '${argString || '.'}': No such file or directory`;
            }
            case 'cd': {
                if (!argString || argString === '~') {
                    const homePath = user ? `/home/${user.email?.split('@')[0]}` : '/';
                     if (!getNodeFromPath(homePath)) {
                        addNodeToFilesystem('/home', user.email!.split('@')[0], { type: 'directory', children: {} });
                    }
                    dispatch({ type: 'SET_CWD', payload: homePath });
                    return '';
                }
                const newPath = resolvePath(cwd, argString);
                const node = getNodeFromPath(newPath);
                if (node && node.type === 'directory') {
                    if (!hasPermission(newPath, 'read', isRoot, user)) {
                        await triggerWarlock(`denied cd to ${newPath}`, 2);
                        return `cd: permission denied: ${argString}`;
                    }
                    dispatch({ type: 'SET_CWD', payload: newPath });
                    return '';
                }
                return `cd: no such file or directory: ${argString}`;
            }
            case 'cat': {
                if (!argString) return 'cat: missing operand';
                const targetPath = resolvePath(cwd, argString);
                 if (!hasPermission(targetPath, 'read', isRoot, user)) {
                    await triggerWarlock(`denied cat on ${targetPath}`, 3);
                    return `cat: ${argString}: Permission denied`;
                }
                const node = getNodeFromPath(targetPath);
                if (node && node.type === 'file') {
                    await triggerWarlock(`cat ${targetPath}`, 1);
                    return getDynamicContent(node);
                }
                if (node && node.type === 'directory') {
                    return `cat: ${argString}: Is a directory`;
                }
                return `cat: ${argString}: No such file or directory`;
            }
            case 'mkdir': {
                if (!argString) return 'mkdir: missing operand';
                const newDirPath = resolvePath(cwd, argString);
                const parentPath = getParentPath(newDirPath);
                if (!hasPermission(parentPath, 'write', isRoot, user)) {
                    return `mkdir: cannot create directory ‘${argString}’: Permission denied`;
                }
                if (getNodeFromPath(newDirPath)) {
                    return `mkdir: cannot create directory ‘${argString}’: File exists`;
                }
                const dirName = newDirPath.split('/').pop()!;
                const newDir: Directory = { type: 'directory', children: {} };
                addNodeToFilesystem(parentPath, dirName, newDir);
                return '';
            }
            case 'touch': {
                 if (!argString) return 'touch: missing operand';
                const newFilePath = resolvePath(cwd, argString);
                const parentPath = getParentPath(newFilePath);
                if (!hasPermission(parentPath, 'write', isRoot, user)) {
                    return `touch: cannot touch ‘${argString}’: Permission denied`;
                }
                if (getNodeFromPath(newFilePath)) {
                    // Just update timestamp, but here we do nothing.
                    return '';
                }
                const fileName = newFilePath.split('/').pop()!;
                const newFile: File = { type: 'file', content: '' };
                addNodeToFilesystem(parentPath, fileName, newFile);
                return '';
            }
             case 'rm': {
                if (!argString) return 'rm: missing operand';
                const targetPath = resolvePath(cwd, argString);
                const node = getNodeFromPath(targetPath);
                if (!node) {
                    return `rm: cannot remove '${argString}': No such file or directory`;
                }
                if (!hasPermission(targetPath, 'write', isRoot, user)) {
                    await triggerWarlock(`denied rm on ${targetPath}`, 5);
                    return `rm: cannot remove '${argString}': Permission denied`;
                }

                const onConfirm = async () => {
                    removeNodeFromFilesystem(targetPath);
                    await triggerWarlock(`removed ${targetPath}`, 5);
                    return '';
                };

                const isDirectory = node.type === 'directory';
                const hasChildren = isDirectory && Object.keys(node.children).length > 0;
                const isRecursive = args.includes('-r') || args.includes('-R');

                if (isDirectory && hasChildren && !isRecursive) {
                    return `rm: cannot remove '${argString}': Is a directory. Use -r to remove recursively.`;
                }
                
                dispatch({
                    type: 'SET_CONFIRMATION',
                    payload: {
                        message: `rm: remove ${isDirectory ? 'directory' : 'file'} '${argString}'? (y/N)`,
                        onConfirm
                    }
                });
                return `rm: remove ${isDirectory ? 'directory' : 'file'} '${argString}'? (y/N)`;
            }
            case 'nano': {
                if (!argString) return 'nano: missing file operand';
                const filePath = resolvePath(cwd, argString);
                 if (!hasPermission(getParentPath(filePath), 'write', isRoot, user)) {
                    return `nano: Permission denied: ${argString}`;
                }
                const node = getNodeFromPath(filePath);
                let content = '';
                if (node) {
                    if (node.type === 'directory') {
                        return `nano: ${argString}: Is a directory`;
                    }
                     if (!hasPermission(filePath, 'read', isRoot, user)) {
                        return `nano: Permission denied: ${argString}`;
                    }
                    content = getDynamicContent(node);
                }
                setEditorState({ filename: argString, content });
                return ''; // No output, the editor will open
            }

            // User management
            case 'logout': {
                await auth.signOut();
                dispatch({ type: 'SET_CWD', payload: '/' });
                dispatch({ type: 'SET_IS_ROOT', payload: false });
                return 'Logged out successfully.';
            }
            case 'su': {
                const targetUser = argString;
                if (targetUser === 'root') {
                    if (isRoot) return 'Already root.';
                    dispatch({ type: 'SET_IS_ROOT', payload: true });
                    dispatch({ type: 'SET_CWD', payload: '/root' });
                    return '';
                } else if(targetUser === user?.email?.split('@')[0]) {
                     if (!isRoot) return 'Already logged in as this user.';
                     dispatch({ type: 'SET_IS_ROOT', payload: false });
                     const homePath = `/home/${user.email!.split('@')[0]}`;
                     dispatch({ type: 'SET_CWD', payload: homePath });
                     return '';
                } else {
                    return `su: user ${targetUser} does not exist`;
                }
            }
            case 'exit': {
                if(isRoot) {
                    dispatch({ type: 'SET_IS_ROOT', payload: false });
                    const homePath = user ? `/home/${user.email?.split('@')[0]}` : '/';
                    dispatch({ type: 'SET_CWD', payload: homePath });
                    return 'exit';
                }
                return `command not found: exit`;
            }


            // AI Commands
            case 'db': {
                if (!argString) return 'db: missing query. Usage: db "your natural language query"';
                try {
                    const queryInstruction = await databaseQuery({ query: argString });
                    const whereClauses = queryInstruction.where.map(w => where(w[0], w[1] as WhereFilterOp, w[2]));
                    const q = query(collection(db, queryInstruction.collection), ...whereClauses);
                    const querySnapshot = await getDocs(q);
                    if (querySnapshot.empty) return "No documents found.";
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
            case 'ask': {
                if (!argString) return 'Usage: ask "[question]"';
                const node = getNodeFromPath(cwd);
                const files = (node?.type === 'directory') ? Object.keys(node.children) : [];
                const { answer } = await askSidekick({ question: argString, cwd, files });
                return answer;
            }
             case 'scan': {
                if (!argString) return 'Usage: scan <file>';
                const targetPath = resolvePath(cwd, argString);
                const node = getNodeFromPath(targetPath);
                if (!node || node.type !== 'file') return 'scan: target is not a file';
                 if (!hasPermission(targetPath, 'read', isRoot, user)) return `scan: Permission denied`;
                
                await triggerWarlock(`scanned ${targetPath}`, 5);
                const { report } = await scanFile({ filename: argString, content: getDynamicContent(node) });
                return `Scan report for ${argString}:\n${report}`;
            }
             case 'crack': {
                if (!argString) return 'Usage: crack <file>';
                const targetPath = resolvePath(cwd, argString);
                const node = getNodeFromPath(targetPath);
                 if (!node || node.type !== 'file') return 'crack: target is not a file';
                 if (!hasPermission(targetPath, 'read', isRoot, user)) return `crack: Permission denied`;

                const content = getDynamicContent(node);
                const wordlist = getWordlist();
                if (!wordlist) return 'Error: a wordlist could not be found at /lib/wordlist.txt';

                await triggerWarlock(`attempted crack on ${targetPath}`, 10);
                setIsTyping(true); // Manually set typing for the delay simulation

                return new Promise(resolve => {
                    setTimeout(() => {
                        const hashes = content.split('\n').filter(Boolean);
                        const results: string[] = [];
                        let found = false;
                        for(const hash of hashes) {
                             for(const word of wordlist) {
                                if(md5(word) === hash) {
                                    results.push(`SUCCESS: Hash ${hash} => ${word}`);
                                    found = true;
                                    break;
                                }
                            }
                            if(!found) {
                                results.push(`FAILURE: Hash ${hash} => No match found in wordlist.`);
                            }
                            found = false;
                        }

                        resolve(`Cracking process finished.\n${results.join('\n')}`);
                    }, 2000); // Simulate cracking time
                });
            }
             case 'reveal': {
                if (!argString) return 'Usage: reveal <image_file>';
                const targetPath = resolvePath(cwd, argString);
                const node = getNodeFromPath(targetPath);
                if (!node || node.type !== 'file') return 'reveal: target is not a valid file.';
                if (!hasPermission(targetPath, 'read', isRoot, user)) return 'reveal: Permission denied.';

                const content = getDynamicContent(node);
                if (!content.startsWith('data:image')) return 'reveal: target is not an image file.';
                
                await triggerWarlock(`used steganography tool on ${targetPath}`, 15);
                const { revealedMessage } = await revealMessage({ imageDataUri: content });
                return `Analysis complete. Result: ${revealedMessage}`;
            }
            case 'osint': {
                if (!argString) return 'Usage: osint <target>';
                await triggerWarlock(`ran OSINT on ${argString}`, 8);
                const { report } = await investigateTarget({ target: argString });
                return `OSINT Report for ${argString}:\n${report}`;
            }
            case 'phish': {
                if (!argString) return 'Usage: phish <target_email>';
                await triggerWarlock(`crafted phish for ${argString}`, 12);
                const { phishingEmail } = await craftPhish({ targetEmail: argString, topic: 'Urgent Security Alert' });
                return `--- CRAFTED PHISHING EMAIL ---\n${phishingEmail}`;
            }
            case 'analyze': {
                 if (!argString) return 'Usage: analyze <image_url>';
                 try {
                     new URL(argString);
                 } catch(_) {
                     return 'analyze: invalid URL provided.';
                 }
                 await triggerWarlock(`analyzed external URL ${argString}`, 20);
                 const { analysis } = await analyzeImage({ imageUrl: argString });
                 return `--- FORENSIC IMAGE ANALYSIS ---\n${analysis}`;
            }
            case 'forge': {
                const [filename, ...promptParts] = args;
                const prompt = promptParts.join(' ');
                if(!filename || !prompt) return 'Usage: forge <filename> "[prompt]"';
                
                const { code } = await forgeTool({ filename, prompt });
                
                const newFilePath = resolvePath(cwd, filename);
                const parentPath = getParentPath(newFilePath);
                if (!hasPermission(parentPath, 'write', isRoot, user)) {
                    return `forge: cannot create file ‘${filename}’: Permission denied`;
                }
                
                if (getNodeFromPath(newFilePath)) {
                    updateNodeInFilesystem(newFilePath, code);
                    return `Tool '${filename}' has been updated.`;
                } else {
                    const newFile: File = { type: 'file', content: code };
                    addNodeToFilesystem(parentPath, filename, newFile);
                    return `Tool '${filename}' forged successfully.`;
                }
            }
            case 'generate_image': {
                 if (!argString) return 'Usage: generate_image "[prompt]"';
                 await triggerWarlock(`generated an image`, 10);
                 return React.createElement(ImageDisplay, { prompt: argString, onFinished: () => dispatch({type: 'FINISH_PROCESSING'}) });
            }
             case 'generate_video': {
                if (!argString) return 'Usage: generate_video "[prompt]"';
                await triggerWarlock(`generated a video`, 25);
                return React.createElement(VideoDisplay, { prompt: argString, onFinished: () => dispatch({type: 'FINISH_PROCESSING'}) });
            }

            // Default
            case '': return '';
            default: {
                if (!hasPermission(`${cwd}/${cmd}`, 'execute', isRoot, user)) {
                    await triggerWarlock(`failed command: ${cmd}`, 1);
                    const result = await generateCommandHelp({ command: cmd, args: args });
                    return result.helpMessage;
                }
                // It's an executable file
                const node = getNodeFromPath(`${cwd}/${cmd}`);
                if (node && node.type === 'file') {
                    await triggerWarlock(`executed ${cmd}`, 2);
                    return getDynamicContent(node);
                }
                 const result = await generateCommandHelp({ command: cmd, args: args });
                 return result.helpMessage;
            }
        }
    } catch (error: any) {
        console.error('Command processing failed:', error);
        toast({
            variant: "destructive",
            title: "Command Execution Error",
            description: error.message || "An unexpected error occurred.",
        });
        return `Error: Command failed to execute.`;
    } finally {
        // For commands that don't return a component that handles its own state.
         if (!command.startsWith('generate_image') && !command.startsWith('generate_video')) {
            dispatch({ type: 'FINISH_PROCESSING' });
         }
    }
  }, [user, cwd, isRoot, toast, confirmation, warlockAwareness, triggerWarlock, setEditorState, setIsTyping]);

  return {
      prompt: getPrompt(),
      processCommand,
      getWelcomeMessage,
      isProcessing,
      commandJustFinished,
      startProcessing: () => dispatch({ type: 'START_PROCESSING' }),
      resetCommandState: () => dispatch({ type: 'RESET' }),
  };
};
