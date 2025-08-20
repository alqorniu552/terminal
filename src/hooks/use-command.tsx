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
Shell: term-sim
`;
};

const getHelpOutput = (isLoggedIn: boolean, isRoot: boolean) => {
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
        const userCommands = [
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
        
        const ctfTools = [
            { command: 'exiftool', args: '<file>', description: 'Read file metadata.'},
            { command: 'strings', args: '<file>', description: 'Print the strings of printable characters in files.'},
            { command: 'hash-identifier', args: '', description: 'Identify hash types.'},
            { command: 'john', args: '<hash>', description: 'Password cracker.'},
            { command: 'steghide', args: 'extract -sf <file>', description: 'Extract hidden data from a file.'},
            { command: 'gdb', args: '<file>', description: 'The GNU Debugger.'},
            { command: 'sudo', args: '<command>', description: 'Execute a command with superuser privileges.'},
        ];
        
        const rootCommands = [
            { command: 'list-users', args: '', description: 'List all registered users.'},
            { command: 'chuser', args: '<email>', description: 'Switch to another user\'s filesystem view.'},
        ];

        let output = formatCommandsToTable('Available Commands', userCommands);
        output += formatCommandsToTable('CTF Tools', ctfTools);

        if (isRoot) {
            output += formatCommandsToTable('Root Commands', rootCommands);
        }

        return output + "\nFor unrecognized commands, AI will try to provide assistance.";
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
  const [isRoot, setIsRoot] = useState(false);
  const [viewedUser, setViewedUser] = useState<{uid: string, email: string} | null>(null);
  
  useEffect(() => {
    if (user) {
        setIsRoot(user.email === ROOT_EMAIL);
        setViewedUser({ uid: user.uid, email: user.email! });
    } else {
        setIsRoot(false);
        setViewedUser(null);
    }
  }, [user]);

  const getPrompt = useCallback(() => {
    if (user) {
        const username = viewedUser?.email?.split('@')[0] || 'user';
        const path = cwd === '/' ? '~' : `~${cwd}`;
        const promptChar = isRoot ? '#' : '$';
        return `${username}@cyber:${path}${promptChar}`;
    }
    return 'guest@cyber:~$';
  }, [user, cwd, isRoot, viewedUser]);

  const [prompt, setPrompt] = useState(getPrompt());
  const { toast } = useToast();
  
  useEffect(() => {
    setPrompt(getPrompt());
  }, [user, cwd, getPrompt, isRoot, viewedUser]);
  
  const fetchUserFilesystem = useCallback(async (uid: string | null) => {
    if (uid) {
        setIsProcessing(true);
        const userDocRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().filesystem) {
            setUserFilesystem(userDoc.data().filesystem);
        } else if (user) {
            const newUserDoc = { email: user.email, filesystem: initialFilesystem };
            await setDoc(userDocRef, newUserDoc, { merge: true });
            setUserFilesystem(initialFilesystem);
        }
        setCwd('/');
        setIsProcessing(false);
    } else {
        setUserFilesystem(initialFilesystem);
        setCwd('/');
    }
  }, [user]);

  useEffect(() => {
    if (viewedUser) {
        fetchUserFilesystem(viewedUser.uid);
    } else {
        fetchUserFilesystem(null);
    }
  }, [viewedUser, fetchUserFilesystem]);


  const getWelcomeMessage = useCallback(() => {
    if (user) {
        if (user.email === ROOT_EMAIL) {
            return `Welcome, root. System privileges granted. Type 'help' for a list of commands.`;
        }
        return `Welcome back, ${user.email}! Type 'help' for a list of commands.`;
    }
    return `Welcome to Cyber! Please 'login' or 'register' to continue.`;
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
      if (parts.length < 1) return null;
       if (parts.length === 1) return fs; // Parent is root
      const parentPath = '/' + parts.slice(0, -1).join('/');
      const node = getNodeFromPath(parentPath, fs);
      return node?.type === 'directory' ? node : null;
  }, [getNodeFromPath]);

  const updateFirestoreFilesystem = useCallback(async (newFilesystem: Directory) => {
    if (viewedUser) {
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
    }
  }, [viewedUser, toast]);

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
            const userCredential = await authFn(auth, email, password);
             if (authFn === createUserWithEmailAndPassword) {
                const userDocRef = doc(db, "users", userCredential.user.uid);
                await setDoc(userDocRef, {
                    email: userCredential.user.email,
                    filesystem: initialFilesystem
                });
            }
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
                return { type: 'text', text: getHelpOutput(false, false) };
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
            return { type: 'text', text: getHelpOutput(true, isRoot) };
          case 'neofetch':
            return { type: 'text', text: getNeofetchOutput(user) };
          
          case 'ls': {
            const targetPath = argString ? resolvePath(argString) : cwd;
            const node = getNodeFromPath(targetPath, userFilesystem);
            if (node && node.type === 'directory') {
              const content = Object.keys(node.children);
              if (content.length === 0) return { type: 'text', text: '' };
              const output = content.map(key => {
                return node.children[key].type === 'directory' ? `${key}/` : key;
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
            if (viewedUser?.uid !== user.uid) {
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
            if (viewedUser?.uid !== user.uid) return { type: 'text', text: `mkdir: Permission denied.` };
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
            if (viewedUser?.uid !== user.uid) return { type: 'text', text: `touch: Permission denied.` };
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
            if (viewedUser?.uid !== user.uid) return { type: 'text', text: `rm: Permission denied.` };
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
          
          case './config-loader': {
            const configPath = resolvePath('config.dat');
            const node = getNodeFromPath(configPath, userFilesystem);
            if (!node || node.type !== 'file') {
                return { type: 'text', text: './config-loader: config.dat not found in current directory.'};
            }
            try {
                const decodedConfig = atob(node.content as string);
                const params = new URLSearchParams(decodedConfig.replace(/;/g, '&'));
                const role = params.get('role');
                const command = params.get('command');

                if (role === 'admin' && command === 'get-flag') {
                    return { type: 'text', text: 'FLAG{1NS3CUR3_D3S3R14L1Z4T10N_PWNS}' };
                } else if (command === 'whoami') {
                    return { type: 'text', text: params.get('username') || 'guest' };
                } else {
                    return { type: 'text', text: `./config-loader: command not found: ${command}` };
                }
            } catch (e) {
                return { type: 'text', text: './config-loader: Error parsing config.dat. Is it valid Base64?' };
            }
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
          
          case 'imagine': {
             if (!argString.startsWith('"') || !argString.endsWith('"')) {
                return { type: 'text', text: 'imagine: prompt must be enclosed in quotes. Usage: imagine "[your prompt]"' };
            }
            const promptText = argString.slice(1, -1);
            return { component: <ImageDisplay prompt={promptText} onFinished={() => {}} />, type: 'component' };
          }

          case 'sudo': {
            if (isRoot) {
                const commandWithoutSudo = args.join(' ');
                return processCommand(commandWithoutSudo);
            }
            return { type: 'text', text: `${user.email} is not in the sudoers file. This incident will be reported.` };
          }

          case 'exiftool': {
            if (!argString) return { type: 'text', text: 'exiftool: missing file operand' };
            const targetPath = resolvePath(argString);
             if (targetPath === '/secret.jpg') {
                return { type: 'text', text: 'ExifTool Version Number         : 12.40\nFile Name                       : secret.jpg\nArtist                          : FLAG{3X1F_M3T4D4T4_H1DD3N_S3CR3T}'};
            }
            return { type: 'text', text: `exiftool: Error: File not found - ${argString}` };
          }

          case 'strings': {
             if (!argString) return { type: 'text', text: 'strings: missing file operand' };
            const targetPath = resolvePath(argString);
            if (targetPath === '/secret.jpg') {
                return { type: 'text', text: 'JFIF\nApple\nFLAG{STR1NGS_1N_B1N4RY_F1L3S}'};
            }
            if (targetPath === '/a.out') {
                return { type: 'text', text: 'GCC: (Ubuntu 9.4.0-1ubuntu1~20.04.1) 9.4.0\nFLAG{B4S1C_R3V3RS1NG_W1TH_STR1NGS}\n.symtab\n.strtab\n.shstrtab'};
            }
            return { type: 'text', text: '' };
          }
            
          case 'hash-identifier': {
            if (!argString) return { type: 'text', text: 'Usage: hash-identifier <hash>' };
            if (argString.toLowerCase() === '5f4dcc3b5aa765d61d8327deb882cf99') {
                return { type: 'text', text: '[+] Most likely hash type is: MD5' };
            }
            return { type: 'text', text: '[-] Unknown hash type' };
          }

          case 'john': {
            if (!argString) return { type: 'text', text: 'Usage: john <hash>' };
             if (argString.toLowerCase() === '5f4dcc3b5aa765d61d8327deb882cf99') {
                return { type: 'text', text: 'Loaded 1 password hash (MD5)\nCracked: opensesame' };
            }
            return { type: 'text', text: 'No password hashes cracked' };
          }

          case 'steghide': {
              const sfIndex = args.indexOf('-sf');
              const pIndex = args.indexOf('-p');
              const file = sfIndex !== -1 ? args[sfIndex + 1] : null;
              const pass = pIndex !== -1 ? args[pIndex + 1] : null;
              const targetPath = file ? resolvePath(file) : '';

              if (args[0] !== 'extract' || !file || !pass) {
                  return { type: 'text', text: 'Usage: steghide extract -sf <file> -p <passphrase>' };
              }
              if (targetPath === '/image_with_secret.png' && pass === 'opensesame') {
                  const newFs = JSON.parse(JSON.stringify(userFilesystem));
                  const parentNode = getParentNodeFromPath('/', newFs)!;
                  parentNode.children['secret_flag.txt'] = { type: 'file', content: 'FLAG{ST3G4N0GR4PHY_CH4LL3NG3_S0LV3D}'};
                  setUserFilesystem({ ...newFs });
                  await updateFirestoreFilesystem(newFs);
                  return { type: 'text', text: 'wrote extracted data to "secret_flag.txt".' };
              }
              return { type: 'text', text: 'steghide: could not extract any data with that passphrase.' };
          }
            
          case 'gdb': {
            if (!argString) return { type: 'text', text: 'Usage: gdb <file>' };
            const targetPath = resolvePath(argString);
             if (targetPath === '/a.out') {
                return { type: 'text', text: `GNU gdb (Ubuntu 9.2-0ubuntu1~20.04.1) 9.2
...
Reading symbols from a.out...
(gdb) disassemble main
Dump of assembler code for function main:
   0x0000000000001139 <+0>:	endbr64 
   0x000000000000113d <+4>:	push   rbp
   0x000000000000113e <+5>:	mov    rbp,rsp
   0x0000000000001141 <+8>:	mov    edi,0x2004
   0x0000000000001146 <+13>:	mov    eax,0x0 ; The flag is FLAG{GDB_1S_AW3S0M3}
   0x000000000000114b <+18>:	call   0x1030 <puts@plt>
   0x0000000000001150 <+23>:	mov    eax,0x0
   0x0000000000001155 <+28>:	pop    rbp
   0x0000000000001156 <+29>:	ret    
End of assembler dump.` };
            }
             return { type: 'text', text: `${argString}: No such file or directory.` };
          }

          // --- Root Commands ---
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
              if (argString === user.email) {
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
  }, [cwd, toast, user, userFilesystem, resolvePath, getNodeFromPath, getParentNodeFromPath, updateFirestoreFilesystem, saveFile, exitEditor, isRoot, viewedUser, processCommand]);

  return { prompt, processCommand, getWelcomeMessage, isProcessing, editingFile, saveFile, exitEditor };
};
