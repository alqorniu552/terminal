"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { databaseQuery } from '@/ai/flows/database-query-flow';
import { askSidekick } from '@/ai/flows/ai-sidekick-flow';
import { initialFilesystem, Directory, FilesystemNode } from '@/lib/filesystem';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, WhereFilterOp, doc, setDoc, getDoc, updateDoc, writeBatch, orderBy, limit } from 'firebase/firestore';
import { User } from 'firebase/auth';
import ImageDisplay from '@/components/image-display';
import { generateCommandHelp } from '@/ai/flows/generate-command-help';
import { useIsMobile } from './use-mobile';

type EditingFile = { path: string; content: string } | null;
type CommandResult = 
  | { type: 'text', text: string }
  | { type: 'component', component: React.ReactNode }
  | { type: 'none' };

const ROOT_EMAIL = "alqorniu552@gmail.com";

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
Host: Cyber v1.0
Kernel: Next.js
Uptime: ${uptime} seconds
Shell: bash
`;
};

const getHelpOutput = (isLoggedIn: boolean, isRoot: boolean, isMobile: boolean) => {
    const skullIcon = `
                      .-.
                     (o.o)
                      |=|
                     _|=|_
                   //\`.---.\`\\\\
                  // /  -  \\ \\\\
                 | | ' -- ' | |
                  \\ \\_.___./ /
                   \\//\`---\`\\\\/
                    \`-------\`
`;

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
            { command: 'nmap', args: '<ip>', description: 'Scan a target IP for open ports.'},
        ];
        
        const rootCommands = [
            { command: 'db', args: '"query"', description: 'Query the database (admin only).' },
            { command: 'list-users', args: '', description: 'List all registered users.'},
            { command: 'chuser', args: '<email>', description: 'Switch to another user\'s view.'},
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
    '10.10.1.2': 'Open Ports: 21 (FTP), 80 (HTTP), 443 (HTTPS)\nFTP allows anonymous login. Found config.php.bak.',
    '192.168.1.100': 'Open Ports: 8080 (web-proxy)\nProxy seems to be misconfigured.',
};

export const useCommand = (user: User | null | undefined, isMobile: boolean) => {
  const [cwd, setCwd] = useState('/');
  const [isProcessing, setIsProcessing] = useState(false);
  const [userFilesystem, setUserFilesystem] = useState<Directory>(initialFilesystem);
  const [editingFile, setEditingFile] = useState<EditingFile>(null);
  const [isRoot, setIsRoot] = useState(false);
  const [viewedUser, setViewedUser] = useState<{uid: string, email: string} | null>(null);
  
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
  
  const fetchUserFilesystem = useCallback(async (uid: string | null) => {
    setIsProcessing(true);
    if (uid) {
        const userDocRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().filesystem) {
            setUserFilesystem(userDoc.data().filesystem);
        } else if (user) { // If user exists but has no filesystem, create one
            const userDocData = userDoc.exists() ? userDoc.data() : { email: user.email };
            const newUserDoc = { ...userDocData, filesystem: initialFilesystem };
            await setDoc(userDocRef, newUserDoc, { merge: true });
            setUserFilesystem(initialFilesystem);
        }
    } else {
        setUserFilesystem(initialFilesystem);
    }
    setCwd('/');
    setIsProcessing(false);
  }, [user]);

  useEffect(() => {
    if (user) {
        const isUserRoot = user.email === ROOT_EMAIL;
        setIsRoot(isUserRoot);
        // If the user's view hasn't been set, or if the logged-in user changes, default to self-view.
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
      setCwd('/');
    }
  }, [viewedUser, fetchUserFilesystem]);

  const getWelcomeMessage = useCallback(() => {
    if (user) {
        if (isRoot) {
            return `Welcome, root. System privileges granted. Type 'help' for a list of commands.`;
        }
        return `Welcome back, ${user.email}! Type 'help' for a list of commands.`;
    }
    return `Welcome to Cyber! Please 'login' or 'register' to continue.`;
  }, [user, isRoot]);

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
      if (parts.length === 0) return null; // Can't get parent of root
      if (parts.length === 1) return fs; // Parent is root
      const parentPath = '/' + parts.slice(0, -1).join('/');
      const node = getNodeFromPath(parentPath, fs);
      return node?.type === 'directory' ? node : null;
  }, [getNodeFromPath]);

  const updateFirestoreFilesystem = useCallback(async (newFilesystem: Directory) => {
    if (!viewedUser || !user || viewedUser.uid !== user.uid) {
        toast({ title: "Permission Denied", description: "You are in read-only mode for this user's filesystem." });
        return;
    }
    try {
        const userDocRef = doc(db, 'users', viewedUser.uid);
        await updateDoc(userDocRef, { filesystem: newFilesystem });
    } catch (error) {
        console.error("Error updating filesystem in Firestore:", error);
        toast({
            variant: "destructive",
            title: "Filesystem Error",
            description: "Could not save file changes to the cloud.",
        });
    }
  }, [viewedUser, user, toast]);

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

  const processCommand = useCallback(async (command: string): Promise<CommandResult> => {
    setIsProcessing(true);
    const [cmd, ...args] = command.trim().split(/\s+/);
    const argString = args.join(' ');
    const isLoggedIn = !!user;

    if (!isLoggedIn) {
      setIsProcessing(false); // Stop processing early for guests
      switch (cmd.toLowerCase()) {
        case 'help':
          return { type: 'text', text: getHelpOutput(false, false, isMobile) };
        case '':
          return { type: 'none' };
        case 'login':
        case 'register':
          // These are handled by the terminal component's auth flow
          return { type: 'none' };
        default:
          return { type: 'text', text: `Command not found: ${cmd}. Please 'login' or 'register'.` };
      }
    }

    try {
        switch (cmd.toLowerCase()) {
          case 'help':
            return { type: 'text', text: getHelpOutput(true, isRoot, isMobile) };
          case 'neofetch':
            return { type: 'text', text: getNeofetchOutput(viewedUser) };
          
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
                return { type: 'text', text: content as string };
            }
            return { type: 'text', text: `cat: ${argString}: No such file or directory` };
          }
          
          case 'nano': {
            if (!user || viewedUser?.uid !== user.uid) {
                return { type: 'text', text: `nano: You can only edit your own files.` };
            }
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
            if (!user || viewedUser?.uid !== user.uid) return { type: 'text', text: `mkdir: Permission denied.` };
            if (!argString) return { type: 'text', text: 'mkdir: missing operand' };
            const newFs = JSON.parse(JSON.stringify(userFilesystem));
            const targetPath = resolvePath(argString);
            if (getNodeFromPath(targetPath, newFs)) {
              return { type: 'text', text: `mkdir: cannot create directory ‘${argString}’: File exists` };
            }
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
            if (getNodeFromPath(targetPath, newFs)) {
                // In unix, touch on existing file updates timestamp, here we do nothing.
                return { type: 'none' };
            }
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
            const newFs = JSON.parse(JSON.stringify(userFilesystem));
            const targetPath = resolvePath(argString);
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
                return { type: 'none' };
            }
            return { type: 'text', text: `rm: cannot remove '${argString}': No such file or directory` };
          }
          
          case 'imagine': {
             if (!argString.startsWith('"') || !argString.endsWith('"')) {
                return { type: 'text', text: 'imagine: prompt must be enclosed in quotes. Usage: imagine "[your prompt]"' };
            }
            const promptText = argString.slice(1, -1);
            return { component: <ImageDisplay prompt={promptText} onFinished={() => {}} />, type: 'component' };
          }

          case 'nmap': {
              if (!argString) return { type: 'text', text: 'Usage: nmap <ip_address>' };
              const result = virtualHosts[argString] || `Failed to resolve "${argString}".`;
              return { type: 'text', text: `Starting Nmap...\n${result}`};
          }

          case 'ask': {
             if (!argString.startsWith('"') || !argString.endsWith('"')) {
                return { type: 'text', text: 'Usage: ask "<your question>"' };
            }
            const question = argString.slice(1, -1);
            const { answer } = await askSidekick({ question });
            return { type: 'text', text: `Ghost: "${answer}"` };
          }

          case 'missions': {
              const missionsCol = collection(db, 'missions');
              const missionsSnapshot = await getDocs(missionsCol);
              if (missionsSnapshot.empty) {
                  return { type: 'text', text: 'No missions available. Check back later, agent.'};
              }
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
                    return { type: 'text', text: 'Incorrect flag. Keep trying.' };
                }
                
                const missionDoc = missionSnapshot.docs[0];
                const missionId = missionDoc.id;
                const missionData = missionDoc.data();
                const userProgressRef = doc(db, 'user-progress', user.uid);
                const userProgressSnap = await getDoc(userProgressRef);

                if (userProgressSnap.exists() && userProgressSnap.data().completed_missions?.includes(missionId)) {
                    return { type: 'text', text: 'You have already completed this mission.' };
                }

                const batch = writeBatch(db);
                const currentScore = userProgressSnap.exists() ? userProgressSnap.data().score : 0;
                const newScore = currentScore + missionData.points;
                
                const progressData = {
                    completed_missions: [...(userProgressSnap.data()?.completed_missions || []), missionId],
                    score: newScore,
                    last_completed: new Date(),
                    email: user.email, // Add email to progress for consistency
                };
                
                if (userProgressSnap.exists()) {
                    batch.update(userProgressRef, progressData);
                } else {
                    batch.set(userProgressRef, progressData);
                }

                const leaderboardRef = doc(db, 'leaderboard', user.uid);
                batch.set(leaderboardRef, {
                    score: newScore,
                    email: user.email
                }, { merge: true });

                await batch.commit();

                return { type: 'text', text: `Correct! You earned ${missionData.points} points. Your new score is ${newScore}.` };
            }
            
            case 'score': {
                const userProgressRef = doc(db, 'user-progress', user.uid);
                const userProgressSnap = await getDoc(userProgressRef);
                const currentScore = userProgressSnap.exists() ? userProgressSnap.data().score : 0;
                return { type: 'text', text: `Your current score is: ${currentScore}` };
            }
            
            case 'leaderboard': {
                const leaderboardCol = collection(db, 'leaderboard');
                const q = query(leaderboardCol, orderBy('score', 'desc'), limit(10));
                const leaderboardSnapshot = await getDocs(q);
                if (leaderboardSnapshot.empty) {
                    return { type: 'text', text: 'Leaderboard is empty. Be the first to score!' };
                }
                const leaderboardList = leaderboardSnapshot.docs.map((doc, index) => {
                    const data = doc.data();
                    return `${index + 1}. ${data.email} - ${data.score} pts`;
                }).join('\n');
                return { type: 'text', text: `--- Top Players ---\n${leaderboardList}` };
            }

          case 'db': {
            if (!isRoot) return { type: 'text', text: `db: command not found` };
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

          case 'list-users': {
              if (!isRoot) return { type: 'text', text: `command not found: ${cmd}` };
              const usersCollection = collection(db, 'users');
              const userSnapshot = await getDocs(usersCollection);
              const userList = userSnapshot.docs.map(doc => doc.data().email);
              return { type: 'text', text: userList.join('\n') };
          }

          case 'chuser': {
              if (!isRoot) return { type: 'text', text: `command not found: ${cmd}` };
              if (!argString) return { type: 'text', text: 'Usage: chuser <email>' };
              if (user && argString === user.email) {
                  setViewedUser({ uid: user.uid, email: user.email! });
                  return { type: 'none' };
              }
              const q = query(collection(db, 'users'), where("email", "==", argString));
              const querySnapshot = await getDocs(q);
              if (querySnapshot.empty) {
                  return { type: 'text', text: `User ${argString} not found.` };
              }
              const targetUserDoc = querySnapshot.docs[0];
              setViewedUser({ uid: targetUserDoc.id, email: targetUserDoc.data().email });
              return { type: 'none' };
          }

          case 'logout': {
            await auth.signOut();
            return { type: 'text', text: 'Logged out successfully.' };
          }
          
          case '':
            return { type: 'none' };

          default: {
            const result = await generateCommandHelp({ command: cmd });
            return { type: 'text', text: `bash: command not found: ${cmd}\n\n${result.helpMessage}`};
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
  }, [cwd, toast, user, userFilesystem, resolvePath, getNodeFromPath, getParentNodeFromPath, updateFirestoreFilesystem, saveFile, exitEditor, isRoot, viewedUser, isMobile, getPrompt, fetchUserFilesystem]);

  return { prompt, processCommand, getWelcomeMessage, isProcessing, editingFile, saveFile, exitEditor };
};
