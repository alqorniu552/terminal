"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { generateCommandHelp } from '@/ai/flows/generate-command-help';
import { databaseQuery } from '@/ai/flows/database-query-flow';
import { initialFilesystem, Directory, FilesystemNode } from '@/lib/filesystem';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, WhereFilterOp, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { User, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import ImageDisplay from '@/components/image-display';

export type AuthStep = 'none' | 'login_email' | 'login_password' | 'register_email' | 'register_password';
export type OSSelectionStep = 'none' | 'prompt' | 'installing' | 'done';
type SessionState = 'terminal' | 'gdb';
type EditingFile = { path: string; content: string } | null;

type CommandResult = string | { type: 'install'; os: string; } | { component: React.ReactNode } | undefined;


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
Host: Hacker Terminal v1.0
Kernel: Next.js
Uptime: ${uptime} seconds
Shell: term-sim
`;
};

const getHelpOutput = (isLoggedIn: boolean, isRoot: boolean, osInstalled: boolean) => {
    let output = '';
    if (isLoggedIn) {
        output = `
General Commands:
  help          - Show this help message.
  ls [path]     - List directory contents.
  cd [path]     - Change directory.
  cat [file]    - Display file content.
  nano [file]   - Edit a file.
  createfile [filename] "[content]" - Create a file with content.
  touch [filename] - Create an empty file.
  mkdir [dirname] - Create a new directory.
  rm [file/dir] - Remove a file or directory.
  pwd           - Print current working directory.
  whoami        - Display current user.
  uname -a      - Display system information.
  echo [text]   - Display a line of text.
  imagine "[prompt]" - Generate an image from a text prompt.
  reboot/shutdown - Simulate system restart/shutdown.
  clear         - Clear the terminal screen.
  logout        - Log out from the application.

CTF & Security Tools:
  nmap [host]        - Scan ports on a target host.
  whois [domain]     - Get registration info for a domain.
  dirb [url]         - Find hidden directories on a web server.
  sqlmap -u [url]    - Simulate SQL injection detection.
  hash-identifier [hash] - Identify hash type.
  base64 -d|-e [text] - Decode/Encode Base64.
  rot13 [text]       - Apply ROT13 cipher to text.
  strings [file]     - Display printable strings from a file.
  exiftool [file]    - Display EXIF data from an image.
  gdb [file]         - GNU Debugger simulation.
  strace/ltrace [file] - Trace system/library calls.
  r2 [file]          - Radare2 simulation for analysis.
  ./linpeas.sh     - Run PEASS-NG enumeration script.
  tshark -r [file]   - Read a .pcap file.


System & Process:
  ping [host]   - Send ICMP ECHO_REQUEST to network hosts.
  free          - Display amount of free and used memory.
  df -h         - Report file system disk space usage.
  ps aux        - Report a snapshot of the current processes.
  top           - Display Linux processes.
  db "[query]"  - Query the database using natural language.
`;
        if (osInstalled) {
            output += `
OS Commands:
  sudo [command]  - Execute a command as the superuser.
  apt/apt-get update - Update package lists.
  apt/apt-get install [pkg] - Install a package.
  dpkg -i [file]  - Install a .deb package file.
`;
        }

        if (isRoot) {
            output += `
Root-only commands:
  list-users    - List all registered users.
  chuser <email> - Switch to another user's filesystem to manage it.
  chuser        - Return to your own filesystem.
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

export const useCommand = (user: User | null | undefined) => {
  const [cwd, setCwd] = useState('/');
  const [authStep, setAuthStep] = useState<AuthStep>('none');
  const [osSelectionStep, setOsSelectionStep] = useState<OSSelectionStep>('none');
  const [sessionState, setSessionState] = useState<SessionState>('terminal');
  const [authCredentials, setAuthCredentials] = useState({ email: '', password: '' });
  const [userData, setUserData] = useState<any>(null);
  const [userFilesystem, setUserFilesystem] = useState<Directory>(initialFilesystem);
  const [editingFile, setEditingFile] = useState<EditingFile>(null);
  const [impersonatedUser, setImpersonatedUser] = useState<any>(null);
  
  const isRoot = userData?.isRoot;
  const currentFilesystem = impersonatedUser ? impersonatedUser.filesystem : userFilesystem;

  const getInitialPrompt = useCallback(() => {
    if (authStep === 'login_email' || authStep === 'register_email') {
      return 'Email:';
    }
    if (authStep === 'login_password' || authStep === 'register_password') {
      return 'Password:';
    }
    if (osSelectionStep === 'prompt') {
      return 'Select OS [1-4]:';
    }
    if (sessionState === 'gdb') {
      return '(gdb) ';
    }
    if (user) {
        const username = isRoot ? 'root' : user.email?.split('@')[0];
        const promptSymbol = isRoot ? '#' : '$';
        const currentPath = cwd === '/' ? '~' : `~${cwd}`;
        const impersonationPrefix = impersonatedUser ? `(${impersonatedUser.email})` : '';
        return `${username}@hacker:${currentPath}${impersonationPrefix}${promptSymbol}`;
    }
    return 'guest@hacker:~$';
  }, [user, isRoot, cwd, osSelectionStep, authStep, impersonatedUser, sessionState]);

  const [prompt, setPrompt] = useState(getInitialPrompt());
  const { toast } = useToast();
  
  const resolvePath = (path: string): string => {
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

  const getNodeFromPath = (path: string, fs: Directory): FilesystemNode | null => {
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
  };
  
  const getParentNodeFromPath = (path: string, fs: Directory): Directory | null => {
      const parts = path.split('/').filter(p => p && p !== '~');
      if (parts.length === 0) return fs;
      const parentPath = '/' + parts.slice(0, -1).join('/');
      const node = getNodeFromPath(parentPath, fs);
      return node?.type === 'directory' ? node : null;
  }
  
  const updateFirestoreFilesystem = async (newFilesystem: Directory) => {
    const targetUser = impersonatedUser || user;
    if (targetUser) {
        try {
            const userDocRef = doc(db, 'users', targetUser.uid);
            await updateDoc(userDocRef, { filesystem: newFilesystem });
            if (impersonatedUser) {
              setImpersonatedUser((prev: any) => ({...prev, filesystem: newFilesystem}));
            }
        } catch (error) {
            console.error("Error updating filesystem in Firestore:", error);
            toast({
                variant: "destructive",
                title: "Filesystem Error",
                description: "Could not save file changes to the cloud.",
            });
        }
    }
  };

  const fetchUserData = useCallback(async () => {
    if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            setUserFilesystem(data.filesystem || initialFilesystem)
            if (!data.osInstalled) {
                setOsSelectionStep('prompt');
            } else {
                setOsSelectionStep('done');
            }
        } else {
             const newUser = {
                email: user.email,
                createdAt: new Date(),
                uid: user.uid,
                os: null,
                osInstalled: false,
                // Ensure only the specific email gets root access. This is permanent.
                isRoot: user.email === 'alqorniu552@gmail.com',
                filesystem: initialFilesystem,
            };
             await setDoc(doc(db, "users", user.uid), newUser);
            setUserData(newUser);
            setUserFilesystem(initialFilesystem);
            setOsSelectionStep('prompt');
        }
    } else {
        setUserData(null);
        setCwd('/');
        setUserFilesystem(initialFilesystem);
        setOsSelectionStep('none');
        setAuthStep('none');
        setAuthCredentials({ email: '', password: '' });
        setImpersonatedUser(null);
    }
  }, [user]);

  useEffect(() => {
    fetchUserData();
  }, [user, fetchUserData]);

  useEffect(() => {
    setPrompt(getInitialPrompt());
  }, [getInitialPrompt]);

  const resetAuth = useCallback(() => {
    setAuthStep('none');
    setAuthCredentials({ email: '', password: '' });
  }, []);

  const getWelcomeMessage = useCallback(() => {
    if (osSelectionStep === 'prompt') {
        let osList = 'Welcome! Before you begin, please select an operating system to install:\n\n';
        for (const [key, value] of Object.entries(osOptions)) {
            osList += `  [${key}] ${value}\n`;
        }
        osList += '\nEnter the corresponding number to choose an OS.';
        return osList;
    }
    if (user && osSelectionStep === 'done') {
        if (isRoot) {
            return `Welcome, root! You have superuser privileges. Type 'help' for commands.`;
        }
        return `Welcome, ${user.email}! Type 'help' for a list of commands.`;
    }
    if (!user && authStep === 'none') {
        return `Welcome to Hacker Terminal! Please 'login' or 'register' to continue.`;
    }
    return '';
  }, [user, isRoot, osSelectionStep, authStep]);
  
  const startOSInstallation = async (selectedOS: string) => {
    setOsSelectionStep('installing');
    if(user) {
      await updateDoc(doc(db, 'users', user.uid), { os: selectedOS });
      setUserData((prev: any) => ({ ...prev, os: selectedOS }));
    }
  };
  
    const saveFile = async (path: string, content: string) => {
        const newFs = JSON.parse(JSON.stringify(currentFilesystem));
        const targetPath = resolvePath(path);
        const parentNode = getParentNodeFromPath(targetPath, newFs);
        const filename = targetPath.split('/').pop();

        if (parentNode && filename) {
            const existingNode = parentNode.children[filename];
            if (existingNode && existingNode.type === 'directory') {
                toast({
                    variant: "destructive",
                    title: "Save Error",
                    description: `Cannot save file, '${filename}' is a directory.`,
                });
                return;
            }
            parentNode.children[filename] = { type: 'file', content: content };
            if (!impersonatedUser) {
              setUserFilesystem(newFs);
            }
            await updateFirestoreFilesystem(newFs);
            toast({
                title: "File Saved",
                description: `Saved ${path}`,
            });
        } else {
             toast({
                variant: "destructive",
                title: "Save Error",
                description: "Could not save file to the specified path.",
            });
        }
    };

    const exitEditor = () => {
        setEditingFile(null);
    };


  const processCommand = useCallback(async (command: string): Promise<CommandResult> => {
    const [cmd, ...args] = command.trim().split(/\s+/);
    const isLoggedIn = !!user;

    if (sessionState === 'gdb') {
        const gdbCmd = cmd.toLowerCase();
        switch (gdbCmd) {
            case 'run':
                return 'Starting program: /home/user/a.out\nProgram received signal SIGSEGV, Segmentation fault.\n0x000055555555513a in main ()';
            case 'disassemble':
            case 'disas':
                 if (args[0] === 'main') {
                    return `Dump of assembler code for function main:
   0x0000000000001135 <+0>:	push   rbp
   0x0000000000001136 <+1>:	mov    rbp,rsp
   0x0000000000001139 <+4>:	mov    DWORD PTR [rbp-0x4],0x1
   0x0000000000001140 <+11>:	mov    eax,DWORD PTR [rbp-0x4]
   0x0000000000001143 <+14>:	pop    rbp
   0x0000000000001144 <+15>:	ret
End of assembler dump.
(Secret string is FLAG{GDB_IS_FUN})
`;
                }
                return `No function named "${args[0] || ''}" found.`;
            case 'break':
                return `Breakpoint 1 at 0x${(Math.random() * 0xffffff).toString(16)}`;
            case 'quit':
            case 'q':
                setSessionState('terminal');
                return 'A debugging session is not active.\nQuitting gdb.';
            default:
                return `Undefined command: "${gdbCmd}". Try "help".`;
        }
    }


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
        return '';
    }


    if (authStep !== 'none') {
        switch (authStep) {
            case 'login_email':
            case 'register_email':
                setAuthCredentials({ email: command, password: '' });
                setAuthStep(authStep === 'login_email' ? 'login_password' : 'register_password');
                return '';
            case 'login_password':
            case 'register_password':
                const { email } = authCredentials;
                const password = command;
                setAuthCredentials({ email, password });
                const isLogin = authStep === 'login_password';
                try {
                    const authFn = isLogin ? signInWithEmailAndPassword : createUserWithEmailAndPassword;
                    await authFn(auth, email, password);
                    resetAuth();
                    return isLogin ? 'Login successful.' : 'Registration successful.';
                } catch (error: any) {
                    resetAuth();
                    if (error.code === 'auth/invalid-credential' || error.code === 'auth/missing-password' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email' || error.code === 'auth/email-already-in-use') {
                        return 'Authentication error: Invalid credentials or email already in use.';
                    }
                    return `Error: ${error.message}`;
                }
        }
    }

    if (!isLoggedIn) {
        switch (cmd.toLowerCase()) {
            case 'login':
                setAuthStep('login_email');
                return '';
            case 'register':
                setAuthStep('register_email');
                return '';
            case 'help':
                return getHelpOutput(false, false, false);
            case '':
                return '';
            default:
                return `Command not found: ${cmd}. Please 'login' or 'register'.`;
        }
    }
    
    if (osSelectionStep !== 'done' && userData) {
        return "Please complete the OS installation first.";
    }

    const argString = args.join(' ');
    
    const extractQuotedArg = (command: string) => {
        const match = command.match(/".*?"/);
        return match ? match[0].slice(1, -1) : null;
    };
    
    const fullCommand = [cmd.toLowerCase(), ...args].join(' ');

    const processSudo = async (sudoCommand: string): Promise<CommandResult> => {
        if (isRoot) return `root already has superuser privileges.`;
        if (!sudoCommand) return 'usage: sudo <command>';
        const output = await processCommand(sudoCommand);
        return `[sudo] password for ${user?.email?.split('@')[0]}:\n${typeof output === 'string' ? output : 'Command executed.'}`;
    };

    if (cmd.toLowerCase() === 'sudo') {
        return processSudo(args.join(' '));
    }


    const osCommands: { [key: string]: () => string } = {
        'apt update': () => 'Hit:1 http://archive.ubuntu.com/ubuntu focal InRelease\nGet:2 http://security.ubuntu.com/ubuntu focal-security InRelease [114 kB]\nReading package lists... Done',
        'apt-get update': () => osCommands['apt update'](),
        'apt install': () => {
            const pkg = args[1];
            if (!pkg) return 'Usage: apt install [package-name]';
            return `Reading package lists... Done\nBuilding dependency tree... Done\n0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\nSimulating installation of ${pkg}... Done.`;
        },
        'apt-get install': () => osCommands['apt install'](),
        'dpkg -i': () => {
            const file = args[1];
            if (!file) return 'Usage: dpkg -i [package-file.deb]';
            if (!file.endsWith('.deb')) return `dpkg: error: '${file}' is not a Debian format archive`;
            return `(Reading database ... 12345 files and directories currently installed.)\nPreparing to unpack ${file} ...\nUnpacking ...\nSetting up ...`;
        }
    };

    if (osCommands[fullCommand]) return osCommands[fullCommand]();
    if (osCommands[cmd.toLowerCase()]) return osCommands[cmd.toLowerCase()]();
    const aptInstallMatch = fullCommand.match(/^(apt|apt-get) install (.+)/);
    if(aptInstallMatch) {
      const pkg = aptInstallMatch[2];
      return `Reading package lists... Done\nBuilding dependency tree... Done\n0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\nSimulating installation of ${pkg}... Done.`;
    }
    const dpkgMatch = fullCommand.match(/^dpkg -i (.+)/);
    if(dpkgMatch) {
      const file = dpkgMatch[1];
      if (!file.endsWith('.deb')) return `dpkg: error: '${file}' is not a Debian format archive`;
      return `(Reading database ... 12345 files and directories currently installed.)\nPreparing to unpack ${file} ...\nUnpacking ...\nSetting up ...`;
    }


    switch (cmd.toLowerCase()) {
      case 'help':
        return getHelpOutput(true, isRoot, userData?.osInstalled);
      case 'neofetch':
        return getNeofetchOutput(user, isRoot, userData?.os);
      
      case 'ls': {
        const targetPath = resolvePath(argString);
        const node = getNodeFromPath(targetPath, currentFilesystem);
        if (node && node.type === 'directory') {
          const content = Object.keys(node.children);
          if (content.length === 0) return '';
          return content.map(key => {
            return node.children[key].type === 'directory' ? `${key}/` : key;
          }).join('\n');
        }
        return `ls: cannot access '${argString || '.'}': No such file or directory`;
      }

      case 'cd': {
        if (!argString || argString === '~') {
          setCwd('/');
          return '';
        }
        const newPath = resolvePath(argString);
        const node = getNodeFromPath(newPath, currentFilesystem);
        if (node && node.type === 'directory') {
          setCwd(newPath);
          return '';
        }
        return `cd: no such file or directory: ${argString}`;
      }
      
      case 'cat': {
        if (!argString) {
          return 'cat: missing operand';
        }
        const targetPath = resolvePath(argString);
        const node = getNodeFromPath(targetPath, currentFilesystem);
        if (node && node.type === 'file') {
            if (typeof node.content === 'function') {
                return node.content();
            }
          return node.content;
        }
        return `cat: ${argString}: No such file or directory`;
      }
      
      case 'nano': {
        if (!argString) {
            return 'Usage: nano [filename]';
        }
        const targetPath = resolvePath(argString);
        const node = getNodeFromPath(targetPath, currentFilesystem);
        if (node && node.type === 'directory') {
            return `nano: ${argString}: Is a directory`;
        }
        const content = (node && node.type === 'file') ? node.content as string : '';
        setEditingFile({ path: targetPath, content: content });
        return;
      }
      
      case 'createfile': {
        const filenameMatch = command.match(/createfile\s+([^\s"]+)/);
        const contentMatch = command.match(/"(.*?)"/);
        
        if (!filenameMatch || !contentMatch) {
            return 'Usage: createfile [filename] "[content]"';
        }

        const filename = filenameMatch[1];
        const content = contentMatch[1];
        const targetPath = resolvePath(filename);

        const newFs = JSON.parse(JSON.stringify(currentFilesystem));
        const parentNode = getParentNodeFromPath(targetPath, newFs);
        const newFilename = targetPath.split('/').pop();

        if (parentNode && newFilename) {
            if (parentNode.children[newFilename]) {
                return `createfile: cannot create file '${filename}': File exists`;
            }
            parentNode.children[newFilename] = { type: 'file', content: content };
            if (!impersonatedUser) {
              setUserFilesystem(newFs);
            }
            await updateFirestoreFilesystem(newFs);
            return `File created: ${filename}`;
        }
        return `createfile: cannot create file '${filename}': No such file or directory`;
      }


      case 'pwd':
        return cwd;

      case 'whoami':
        return isRoot ? 'root' : user?.email?.split('@')[0] || 'guest';
      
      case 'uname':
        if (argString === '-a') {
            return `Linux hacker 5.4.0-150-generic #167-Ubuntu SMP Mon May 15 17:33:04 UTC 2023 x86_64 x86_64 x86_64 GNU/Linux`;
        }
        return 'Linux';
      
      case 'echo':
        return argString;
      
      case 'touch': {
        if (!argString) return 'touch: missing file operand';
        const newFs = JSON.parse(JSON.stringify(currentFilesystem));
        const targetPath = resolvePath(argString);
        const parentNode = getParentNodeFromPath(targetPath, newFs);
        const filename = targetPath.split('/').pop();
        if (parentNode && filename) {
            if (parentNode.children[filename]) {
                return ''; 
            }
            parentNode.children[filename] = { type: 'file', content: '' };
            if (!impersonatedUser) {
              setUserFilesystem(newFs);
            }
            await updateFirestoreFilesystem(newFs);
            return '';
        }
        return `touch: cannot touch '${argString}': No such file or directory`;
      }
      
      case 'mkdir': {
        if (!argString) return 'mkdir: missing operand';
        const newFs = JSON.parse(JSON.stringify(currentFilesystem));
        const targetPath = resolvePath(argString);
        const parentNode = getParentNodeFromPath(targetPath, newFs);
        const dirname = targetPath.split('/').pop();
        if (parentNode && dirname) {
            if (parentNode.children[dirname]) {
                return `mkdir: cannot create directory ‘${argString}’: File exists`;
            }
            parentNode.children[dirname] = { type: 'directory', children: {} };
            if (!impersonatedUser) {
              setUserFilesystem(newFs);
            }
            await updateFirestoreFilesystem(newFs);
            return '';
        }
        return `mkdir: cannot create directory ‘${argString}’: No such file or directory`;
      }

      case 'rm': {
        if (!argString) return 'rm: missing operand';
        const newFs = JSON.parse(JSON.stringify(currentFilesystem));
        const targetPath = resolvePath(argString);
        const parentNode = getParentNodeFromPath(targetPath, newFs);
        const nodeName = targetPath.split('/').pop();
        if (parentNode && nodeName && parentNode.children[nodeName]) {
            const nodeToRemove = parentNode.children[nodeName];
            if (nodeToRemove.type === 'directory' && Object.keys(nodeToRemove.children).length > 0 && !args.includes('-r')) {
                return `rm: cannot remove '${argString}': Directory not empty`;
            }
            delete parentNode.children[nodeName];
            if (!impersonatedUser) {
              setUserFilesystem(newFs);
            }
            await updateFirestoreFilesystem(newFs);
            return '';
        }
        return `rm: cannot remove '${argString}': No such file or directory`;
      }
      
      case 'free':
        return `              total        used        free      shared  buff/cache   available
Mem:        8172316      903240     5786420       70196     1482656     6918880
Swap:       2097148           0     2097148`;

      case 'df':
        if (argString === '-h') {
          return `Filesystem      Size  Used Avail Use% Mounted on
udev            3.9G     0  3.9G   0% /dev
tmpfs           799M  1.7M  797M   1% /run
/dev/sda1       228G   20G  197G  10% /
tmpfs           3.9G     0  3.9G   0% /dev/shm
tmpfs           5.0M  4.0K  5.0M   1% /run/lock`;
        }
        return 'Usage: df -h';

      case 'top':
          return `top - 14:14:14 up 1 day, 2:30,  1 user,  load average: 0.00, 0.01, 0.05
Tasks: 247 total,   1 running, 246 sleeping,   0 stopped,   0 zombie
%Cpu(s):  0.3 us,  0.1 sy,  0.0 ni, 99.5 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st
MiB Mem :   7980.8 total,   5650.8 free,    882.1 used,   1447.9 buff/cache
MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   6756.7 avail Mem

    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
      1 root      20   0  167292   9284   6560 S   0.0   0.1   0:01.11 systemd
      2 root      20   0       0      0      0 S   0.0   0.0   0:00.00 kthreadd
... (simulation ends here) ...`;
      
      case 'ps':
        if (argString === 'aux') {
            const username = (isRoot ? 'root' : user?.email?.split('@')[0])?.substring(0, 8) || 'guest';
            return `USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root           1  0.0  0.1 167292  9284 ?        Ss   May30   0:01 /sbin/init
root           2  0.0  0.0      0     0 ?        S    May30   0:00 [kthreadd]
${username.padEnd(8)}     1337  0.5  0.2 222333  4321 pts/0    Rs+  14:15   0:02 bash
... (simulation ends here) ...`;
        }
        return `Usage: ps aux`;
      
      case 'ping': {
        const host = args[0] || 'localhost';
        return `PING ${host} (127.0.0.1) 56(84) bytes of data.
64 bytes from localhost (127.0.0.1): icmp_seq=1 ttl=64 time=0.042 ms
64 bytes from localhost (127.0.0.1): icmp_seq=2 ttl=64 time=0.045 ms
64 bytes from localhost (127.0.0.1): icmp_seq=3 ttl=64 time=0.041 ms
--- ${host} ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2003ms`;
      }
      
      case 'imagine': {
        const imagePrompt = extractQuotedArg(command);
        if (!imagePrompt) {
          return 'Usage: imagine "[your image prompt]"';
        }
        return { component: <ImageDisplay prompt={imagePrompt} onFinished={() => {}} /> };
      }

      case 'reboot':
      case 'shutdown':
        return 'System is going down for reboot NOW!';
      
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

      case 'chuser': {
        if (!isRoot) {
            return `chuser: command not found`;
        }
        const targetEmail = args[0];
        if (!targetEmail) {
            setImpersonatedUser(null);
            setCwd('/');
            return 'Returned to root filesystem.';
        }
        if (targetEmail === user?.email) {
            setImpersonatedUser(null);
            setCwd('/');
            return 'Returned to root filesystem.';
        }
        try {
            const q = query(collection(db, "users"), where("email", "==", targetEmail));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                return `chuser: user '${targetEmail}' not found.`;
            }
            const targetUserData = querySnapshot.docs[0].data();
            targetUserData.uid = querySnapshot.docs[0].id;
            setImpersonatedUser(targetUserData);
            setCwd('/');
            return `Switched to filesystem of ${targetEmail}. Use 'chuser' to return.`;
        } catch (error) {
            console.error("Failed to switch user:", error);
            return `Error: Could not access filesystem for ${targetEmail}.`;
        }
      }

      case 'db': {
        const dbQuery = extractQuotedArg(command);
        if (!dbQuery) {
          return 'db: missing query. Usage: db "your natural language query"';
        }
        try {
          const queryInstruction = await databaseQuery({ query: dbQuery });
          
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

        case 'nmap': {
            const host = args[0];
            if (!host) return 'Usage: nmap <host>';
            return `
Starting Nmap 7.80 ( https://nmap.org ) at ${new Date().toUTCString()}
Nmap scan report for ${host} (127.0.0.1)
Host is up (0.00019s latency).
Not shown: 996 closed ports
PORT      STATE SERVICE
22/tcp    open  ssh
80/tcp    open  http
443/tcp   open  https
3306/tcp  open  mysql

Nmap done: 1 IP address (1 host up) scanned in 0.08 seconds
`;
        }
        case 'whois': {
            const domain = args[0];
            if (!domain) return 'Usage: whois <domain>';
            return `
Domain Name: ${domain.toUpperCase()}
Registry Domain ID: 123456789_DOMAIN_COM-VRSN
Registrar WHOIS Server: whois.example.com
Registrar URL: http://www.example.com
Updated Date: 2023-01-01T00:00:00Z
Creation Date: 2020-01-01T00:00:00Z
Registrar Registration Expiration Date: 2025-01-01T00:00:00Z
Registrar: Example Registrar, Inc.
(Fictional data)
`;
        }

        case 'dirb': {
            const url = args[0];
            if (!url) return 'Usage: dirb <url>';
            return `
-----------------
DIRB v2.22 by The Dark Raver
-----------------
START_TIME: ${new Date().toUTCString()}
URL_BASE: ${url}
-----------------
+ ${url}/.git/ (CODE:200|SIZE:123)
+ ${url}/admin/ (CODE:403|SIZE:45)
+ ${url}/backups/ (CODE:403|SIZE:45)
+ ${url}/config/ (CODE:200|SIZE:341)
==> DIRECTORY: ${url}/uploads/
-----------------
END_TIME: ${new Date().toUTCString()}
DOWNLOADED: 1000 - FOUND: 4
`;
        }

        case 'sqlmap': {
            if (args[0] !== '-u' || !args[1]) return 'Usage: sqlmap -u <url>';
            const url = args[1];
            return `
sqlmap/1.5.11#stable
...
[INFO] testing connection to the target URL
[INFO] checking if the target is protected by some kind of WAF/IPS
[INFO] testing for SQL injection on GET parameter 'id'
[INFO] GET parameter 'id' is vulnerable. Do you want to keep testing the others (if any)? [y/N] N
sqlmap identified the following injection point(s) with a total of 678 HTTP(s) requests:
---
Parameter: id (GET)
    Type: boolean-based blind
    Title: AND boolean-based blind - WHERE or HAVING clause
    Payload: id=1 AND 1921=1921
---
[INFO] the back-end DBMS is MySQL
web server operating system: Linux Ubuntu
web application technology: Apache 2.4.29
back-end DBMS: MySQL >= 5.0
[INFO] fetching database names
available databases [5]:
[*] ctf_db
[*] information_schema
[*] mysql
[*] performance_schema
[*] sys
`;
        }

        case 'hash-identifier': {
            const hash = args[0];
            if (!hash) return 'Usage: hash-identifier <hash>';
            let type = 'Unknown or invalid hash';
            if (/^[a-f0-9]{32}$/i.test(hash)) type = 'MD5';
            else if (/^[a-f0-9]{40}$/i.test(hash)) type = 'SHA-1';
            else if (/^[a-f0-9]{64}$/i.test(hash)) type = 'SHA-256';
            else if (/^\$2[ayb]\$.{56}$/.test(hash)) type = 'Bcrypt';
            return `Possible Hash Type: ${type}`;
        }
        
        case 'base64': {
            if (args.length < 2) return 'Usage: base64 [-d|-e] <text>';
            const mode = args[0];
            const text = args.slice(1).join(' ');
            try {
                if (mode === '-e') return btoa(text);
                if (mode === '-d') return atob(text);
                return 'Invalid flag. Use -e for encode or -d for decode.';
            } catch (e) {
                return 'Error: Invalid Base64 string.';
            }
        }
        
        case 'rot13': {
             const text = args.join(' ');
             if (!text) return 'Usage: rot13 <text>';
             return text.replace(/[a-zA-Z]/g, function(c){
                return String.fromCharCode(c.charCodeAt(0) + (c.toLowerCase() < 'n' ? 13 : -13));
             });
        }
        
        case 'strings': {
             if (!argString) return 'Usage: strings <filename>';
             const targetPath = resolvePath(argString);
             const node = getNodeFromPath(targetPath, currentFilesystem);
             if (node && node.type === 'file' && typeof node.content === 'string') {
                 const printableChars = node.content.match(/[\x20-\x7E]{4,}/g);
                 return printableChars ? printableChars.join('\n') : '';
             }
             return `strings: '${argString}': No such file`;
        }
        
        case 'exiftool': {
            const filename = args[0];
            if (!filename) return 'Usage: exiftool <filename>';
            if (!/\.(jpg|jpeg|png)$/i.test(filename)) return `Error: File '${filename}' is not a supported image type.`;
            const node = getNodeFromPath(resolvePath(filename), currentFilesystem);
            if (node && node.type === 'file') {
                return `
ExifTool Version Number         : 12.40
File Name                       : ${filename}
File Size                       : 128 kB
Image Size                      : 1024x768
Camera Model Name               : Canon EOS 5D Mark IV
Copyright                       : (c) 2024 Hacker Inc.
Comment                         : Find the flag here: FLAG{F4k3_Ex1f_D4t4}
`;
            }
            return `Error: File not found - ${filename}`;
        }
      
      case 'gdb': {
        const fileToDebug = args[0];
        if (!fileToDebug) return 'Usage: gdb <filename>';
        const node = getNodeFromPath(resolvePath(fileToDebug), currentFilesystem);
        if (!node) return `"${fileToDebug}": No such file or directory.`;

        setSessionState('gdb');
        return `GNU gdb (Ubuntu 9.2-0ubuntu1~20.04.1) 9.2
Copyright (C) 2020 Free Software Foundation, Inc.
...
Reading symbols from ${fileToDebug}...
(No debugging symbols found in ${fileToDebug})
`;
      }
      
      case './linpeas.sh':
      case 'linpeas.sh': {
        const node = getNodeFromPath(resolvePath('linpeas.sh'), currentFilesystem);
        if (!node) return `bash: ./linpeas.sh: No such file or directory`;
        if(typeof node.content === 'function') return node.content();
        return node.content;
      }
      
      case 'tshark': {
          if (args[0] !== '-r' || !args[1]) return 'Usage: tshark -r <file.pcap>';
          const file = args[1];
          const node = getNodeFromPath(resolvePath(file), currentFilesystem);
          if (!node) return `tshark: The file "${file}" doesn't exist.`;
          return `
  1   0.000000 192.168.1.10 -> 216.58.208.78 TCP 74 62447 → 443 [SYN] Seq=0 Win=64240 Len=0 MSS=1460 SACK_PERM=1 TSval=...
  2   0.034586 216.58.208.78 -> 192.168.1.10 TCP 74 443 → 62447 [SYN, ACK] Seq=0 Ack=1 Win=65535 Len=0 MSS=1460 SACK_PERM=1...
  3   0.034630 192.168.1.10 -> 216.58.208.78 TCP 66 62447 → 443 [ACK] Seq=1 Ack=1 Win=64240 Len=0
  4   0.035109 192.168.1.10 -> 216.58.208.78 TLSv1.2 583 Client Hello
  5   0.070521 216.58.208.78 -> 192.168.1.10 TLSv1.2 1478 Server Hello, Certificate, Server Key Exchange, Server Hello Done
...
[+] Interesting conversation found:
- Protocol: FTP
- User: ftp_user
- Pass: FLAG{P4SSW0RD_1N_PL41N7EXT}
`;
      }

      case 'strace':
      case 'ltrace':
      case 'r2': {
        const file = args[0];
        if (!file) return `Usage: ${cmd} <filename>`;
        const node = getNodeFromPath(resolvePath(file), currentFilesystem);
        if (!node) return `${cmd}: cannot access '${file}': No such file or directory`;
        
        if (cmd === 'strace') return `execve("./${file}", ["./${file}"], 0x7ff...AE) = 0\n... many system calls ...\nopenat(AT_FDCWD, "/etc/secret_password.txt", O_RDONLY) = -1 ENOENT (No such file or directory)\n...`;
        if (cmd === 'ltrace') return `puts("Hello, World!")                                   = 14\n... many library calls ...\ngetenv("SECRET_FLAG")                               = "FLAG{LTRACE_REVEALS_SECRETS}"\n...`;
        if (cmd === 'r2') return `[0x00400490]> aaaa\n[x] Analyze all flags starting with sym. and entry0 (aa)\n[x] Analyze function calls (aac)\n[0x00400490]> afl\n0x00400490    1 41           entry0\n0x004004b0    4 55   sym.main\n[0x00400490]> pdf @ sym.main\n... assembly code ...\n;-- check_password:"FLAG{R4D4R3_TW0_FTW}"`;
        return '';
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
  }, [cwd, toast, user, authStep, authCredentials, resetAuth, isRoot, osSelectionStep, userData, fetchUserData, userFilesystem, impersonatedUser, currentFilesystem, sessionState]);

  return { prompt, processCommand, getWelcomeMessage, authStep, resetAuth, osSelectionStep, setOsSelectionStep, editingFile, saveFile, exitEditor };
};
