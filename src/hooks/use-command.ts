"use client";

import { useState, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { generateCommandHelp } from '@/ai/flows/generate-command-help';
import { databaseQuery } from '@/ai/flows/database-query-flow';
import { filesystem, Directory, FilesystemNode, File } from '@/lib/filesystem';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, WhereFilterOp, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

export type AuthStep = 'none' | 'login_email' | 'login_password' | 'register_email' | 'register_password';
export type OSSelectionStep = 'none' | 'prompt' | 'installing' | 'done';

const osOptions: { [key: string]: string } = {
    '1': 'Ubuntu 20.04',
    '2': 'Ubuntu 22.04',
    '3': 'Ubuntu 24.04',
    '4': 'Debian',
};

const getNeofetchOutput = (user: User | null | undefined, isRoot: boolean, os: string | null) => {
    let uptime = 0;
    if (typeof window !== 'undefined') {
        uptime = Math.floor(performance.now() / 1000);
    }
    const username = isRoot ? 'root' : user?.email?.split('@')[0] || 'guest';
    const osName = os || 'Generic OS';

return `
${username}@hacker
--------------------
OS: ${osName} (Web Browser)
Host: Hacker v1.0
Kernel: Next.js
Uptime: ${uptime} seconds
Shell: term-sim
`;
};

const getHelpOutput = (isLoggedIn: boolean, isRoot: boolean) => {
    let output = '';
    if (isLoggedIn) {
        output = `
Available commands:
  help          - Show this help message.
  ls [path]     - List directory contents.
  cd [path]     - Change directory.
  cat [file]    - Display file content.
  neofetch      - Display system information.
  db "[query]"  - Query the database using natural language.
  createfile [filename] "[content]" - Create a new file.
  clear         - Clear the terminal screen.
  logout        - Log out from the application.
`;
        if (isRoot) {
            output += `
Root-only commands:
  list-users    - List all registered users.
`;
        }
        output += `
For unrecognized commands, AI will try to provide assistance.
`;
    } else {
        output = `
Available commands:
  help          - Show this help message.
  login         - Log in to your account.
  register      - Create a new account.
  clear         - Clear the terminal screen.
`;
    }
    return output;
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

export const useCommand = (user: User | null | undefined) => {
  const [cwd, setCwd] = useState('/');
  const [authStep, setAuthStep] = useState<AuthStep>('none');
  const [osSelectionStep, setOsSelectionStep] = useState<OSSelectionStep>('none');
  const [authCredentials, setAuthCredentials] = useState({ email: '', password: '' });
  const [userData, setUserData] = useState<any>(null);
  
  const isRoot = user?.email === 'alqorniu552@gmail.com';

  const getInitialPrompt = useCallback(() => {
    if (osSelectionStep === 'prompt') {
      return 'Select OS [1-4]:';
    }
    if (user) {
        const username = isRoot ? 'root' : user.email?.split('@')[0];
        const promptSymbol = isRoot ? '#' : '$';
        const currentPath = cwd === '/' ? '~' : `~${cwd}`;
        return `${username}@hacker:${currentPath}${promptSymbol}`;
    }
    return 'guest@hacker:~$';
  }, [user, isRoot, cwd, osSelectionStep]);

  const [prompt, setPrompt] = useState(getInitialPrompt());
  const { toast } = useToast();
  
  useEffect(() => {
    const checkUserOS = async () => {
        if (user) {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                const data = userDoc.data();
                setUserData(data);
                if (!data.osInstalled) {
                    setOsSelectionStep('prompt');
                } else {
                    setOsSelectionStep('done');
                }
            } else {
                 await setDoc(doc(db, "users", user.uid), {
                    email: user.email,
                    createdAt: new Date(),
                    uid: user.uid,
                    os: null,
                    osInstalled: false,
                });
                setOsSelectionStep('prompt');
            }
        } else {
            setUserData(null);
            setOsSelectionStep('none');
        }
    };
    checkUserOS();
  }, [user]);

  useEffect(() => {
    setPrompt(getInitialPrompt());
  }, [getInitialPrompt]);

  const resetAuth = useCallback(() => {
    setAuthStep('none');
    setAuthCredentials({ email: '', password: '' });
    setPrompt(getInitialPrompt());
  }, [getInitialPrompt]);

  const getWelcomeMessage = useCallback(() => {
    if (osSelectionStep === 'prompt') {
        let osList = 'Welcome! Before you begin, please select an operating system to install:\n\n';
        for (const [key, value] of Object.entries(osOptions)) {
            osList += `  [${key}] ${value}\n`;
        }
        osList += '\nEnter the corresponding number to choose an OS.';
        return osList;
    }
    if (user) {
        if (isRoot) {
            return `Welcome, root! You have superuser privileges. Type 'help' for commands.`;
        }
        return `Welcome, ${user.email}! Type 'help' for a list of commands.`;
    }
    return `Welcome to Hacker Terminal! Please 'login' or 'register' to continue.`;
  }, [user, isRoot, osSelectionStep]);

  const startOSInstallation = async (selectedOS: string) => {
    setOsSelectionStep('installing');
    if(user) {
      await updateDoc(doc(db, 'users', user.uid), { os: selectedOS });
    }
  };


  const processCommand = useCallback(async (command: string): Promise<string | { type: 'install'; os: string; }> => {
    const [cmd, ...args] = command.trim().split(/\s+/);
    const isLoggedIn = !!user;

    if (osSelectionStep === 'prompt') {
        const choice = command.trim();
        const selectedOS = osOptions[choice as keyof typeof osOptions];
        if (selectedOS) {
            await startOSInstallation(selectedOS);
            return { type: 'install', os: selectedOS };
        } else {
            return "Invalid selection. Please choose a number between 1 and 4.";
        }
    }
    
    if (osSelectionStep === 'installing') {
        return ''; // Ignore commands during installation
    }


    // Multi-step auth flow
    if (authStep !== 'none') {
        switch (authStep) {
            case 'login_email':
            case 'register_email':
                setAuthCredentials({ email: command, password: '' });
                setAuthStep(authStep === 'login_email' ? 'login_password' : 'register_password');
                setPrompt('Password:');
                return '';
            case 'login_password':
            case 'register_password':
                const { email } = authCredentials;
                const password = command;
                setAuthCredentials({ email, password });
                const isLogin = authStep === 'login_password';
                try {
                    const authFn = isLogin ? signInWithEmailAndPassword : createUserWithEmailAndPassword;
                    const userCredential = await authFn(auth, email, password);

                    if (!isLogin) {
                        // Save user to 'users' collection on registration
                        await setDoc(doc(db, "users", userCredential.user.uid), {
                            email: userCredential.user.email,
                            createdAt: new Date(),
                            uid: userCredential.user.uid,
                            os: null,
                            osInstalled: false,
                        });
                    }
                    resetAuth();
                    return isLogin ? 'Login successful.' : 'Registration successful.';
                } catch (error: any) {
                    resetAuth();
                    if (error.code === 'auth/invalid-credential' || error.code === 'auth/missing-password' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
                        return 'Akun anda tidak terdaftar';
                    }
                    return `Error: ${error.message}`;
                }
        }
    }

    if (!isLoggedIn) {
        switch (cmd.toLowerCase()) {
            case 'login':
                setAuthStep('login_email');
                setPrompt('Email:');
                return '';
            case 'register':
                setAuthStep('register_email');
                setPrompt('Email:');
                return '';
            case 'help':
                return getHelpOutput(false, false);
            case '':
                return '';
            default:
                return `Command not found: ${cmd}. Please 'login' or 'register'.`;
        }
    }

    const argString = args.join(' ');

    switch (cmd.toLowerCase()) {
      case 'help':
        return getHelpOutput(true, isRoot);
      case 'neofetch':
        return getNeofetchOutput(user, isRoot, userData?.os);
      
      case 'ls': {
        const targetPath = argString ? resolvePath(cwd, argString) : cwd;
        const node = getNodeFromPath(targetPath);
        if (node && node.type === 'directory') {
          return Object.keys(node.children).map(key => {
            return node.children[key].type === 'directory' ? `\x1b[1;34m${key}/\x1b[0m` : key;
          }).join('\n');
        }
        return `ls: cannot access '${argString || '.'}': No such file or directory`;
      }

      case 'cd': {
        if (!argString || argString === '~') {
          setCwd('/');
          const username = isRoot ? 'root' : user.email?.split('@')[0];
          const promptSymbol = isRoot ? '#' : '$';
          setPrompt(`${username}@hacker:~$${promptSymbol}`);
          return '';
        }
        const newPath = resolvePath(cwd, argString);
        const node = getNodeFromPath(newPath);
        if (node && node.type === 'directory') {
          setCwd(newPath);
          const username = isRoot ? 'root' : user.email?.split('@')[0];
          const promptSymbol = isRoot ? '#' : '$';
          const newPromptPath = newPath === '/' ? '~' : `~${newPath}`;
          setPrompt(`${username}@hacker:${newPromptPath}${promptSymbol}`);
          return '';
        }
        return `cd: no such file or directory: ${argString}`;
      }
      
      case 'cat': {
        if (!argString) {
          return 'cat: missing operand';
        }
        const targetPath = resolvePath(cwd, argString);
        const node = getNodeFromPath(targetPath);
        if (node && node.type === 'file') {
            if (typeof node.content === 'function') {
                return node.content();
            }
          return node.content;
        }
        return `cat: ${argString}: No such file or directory`;
      }
      
      case 'list-users': {
        if (!isRoot) {
            return `list-users: command not found`;
        }
        try {
            const q = query(collection(db, "users"));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                return "No users found.";
            }
            const usersList = querySnapshot.docs.map(doc => {
                const data = doc.data();
                const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : 'N/A';
                return `- ${data.email} (OS: ${data.os || 'None'}) (Created: ${createdAt})`;
            }).join('\n');
            return `Registered Users:\n${usersList}`;
        } catch (error) {
            console.error("Failed to list users:", error);
            return "Error: Could not retrieve user list.";
        }
      }

      case 'createfile': {
        const match = argString.match(/^(\S+)\s+"(.*)"$/);
        if (!match) {
          return 'Usage: createfile [filename] "[content]"';
        }
        const [, filename, content] = match;

        const targetPath = resolvePath(cwd, '');
        
        if (!isRoot && targetPath === '/') {
           // Non-root users can only create files in their home directory, for now we can restrict root
        }

        const node = getNodeFromPath(targetPath);

        if (node && node.type === 'directory') {
          if (node.children[filename]) {
            return `createfile: cannot create file '${filename}': File exists`;
          }
          const newFile: File = { type: 'file', content: content };
          node.children[filename] = newFile;
          return `File created: ${filename}`;
        }
        return `createfile: cannot create file in '${targetPath}': No such directory`;
      }

      case 'db': {
        if (!argString) {
          return 'db: missing query. Usage: db "your natural language query"';
        }
        try {
          const queryInstruction = await databaseQuery({ query: argString });
          
          if (queryInstruction.collection === 'users' && !isRoot) {
            return "Error: Access to users collection is restricted to root.";
          }

          const whereClauses = queryInstruction.where.map(w => where(w[0], w[1] as WhereFilterOp, w[2]));
          const q = query(collection(db, queryInstruction.collection), ...whereClauses);
          
          const querySnapshot = await getDocs(q);
          if (querySnapshot.empty) {
            return "No documents found.";
          }
          
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

      case 'logout': {
        await auth.signOut();
        return 'Logged out successfully.';
      }
      
      case '':
        return '';

      default: {
        try {
          const result = await generateCommandHelp({ command: cmd });
          return result.helpMessage;
        } catch (error) {
          console.error('AI command help failed:', error);
          toast({
            variant: "destructive",
            title: "AI Assistant Error",
            description: "Could not get help for the command.",
          });
          return `command not found: ${cmd}`;
        }
      }
    }
  }, [cwd, toast, user, prompt, authStep, authCredentials, getInitialPrompt, resetAuth, isRoot, osSelectionStep, userData?.os]);

  return { prompt, processCommand, getWelcomeMessage, authStep, resetAuth, osSelectionStep, setOsSelectionStep };
};
