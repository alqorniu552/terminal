"use client";

import { useState, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { generateCommandHelp } from '@/ai/flows/generate-command-help';
import { databaseQuery } from '@/ai/flows/database-query-flow';
import { initialFilesystem, Directory, FilesystemNode, File } from '@/lib/filesystem';
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

const installationFeatures = [
    "Probing hardware devices...",
    "Loading kernel modules...",
    "Setting up disk partitions...",
    "Formatting /dev/sda1 as ext4...",
    "Mounting filesystems...",
    "Unpacking base system image... (0%)",
    "Unpacking base system image... (50%)",
    "Unpacking base system image... (100%)",
    "Installing kernel: linux-image-generic...",
    "Configuring APT package manager...",
    "Fetching package lists from repositories...",
    "Installing core utilities (coreutils, findutils, grep)...",
    "Setting up networking with netplan...",
    "Configuring system clock (chrony)...",
    "Creating user account...",
    "Setting up user environment and home directory...",
    "Installing desktop environment (GNOME)...",
    "Configuring display manager (GDM3)...",
    "Running post-installation triggers...",
    "Cleaning up temporary files...",
    "Finalizing installation...",
    "System will restart shortly...",
];

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

const getHelpOutput = (isLoggedIn: boolean, isRoot: boolean, osInstalled: boolean) => {
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
  createfile [filename] "[content]" - Create a new file with content.
  touch [filename] - Create an empty file.
  mkdir [dirname] - Create a new directory.
  rm [file/dir] - Remove a file or directory.
  pwd           - Print current working directory.
  whoami        - Display current user.
  uname -a      - Display system information.
  echo [text]   - Display a line of text.
  ping [host]   - Send ICMP ECHO_REQUEST to network hosts.
  free          - Display amount of free and used memory.
  df -h         - Report file system disk space usage.
  ps aux        - Report a snapshot of the current processes.
  top           - Display Linux processes.
  reboot/shutdown - Simulate system restart/shutdown.
  clear         - Clear the terminal screen.
  logout        - Log out from the application.
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
  const [authCredentials, setAuthCredentials] = useState({ email: '', password: '' });
  const [userData, setUserData] = useState<any>(null);
  const [userFilesystem, setUserFilesystem] = useState<Directory>(initialFilesystem);
  
  const isRoot = user?.email === 'alqorniu552@gmail.com';

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
    if (user) {
        const username = isRoot ? 'root' : user.email?.split('@')[0];
        const promptSymbol = isRoot ? '#' : '$';
        const currentPath = cwd === '/' ? '~' : `~${cwd}`;
        return `${username}@hacker:${currentPath}${promptSymbol}`;
    }
    return 'guest@hacker:~$';
  }, [user, isRoot, cwd, osSelectionStep, authStep]);

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
    if (user) {
        try {
            const userDocRef = doc(db, 'users', user.uid);
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
             await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                createdAt: new Date(),
                uid: user.uid,
                os: null,
                osInstalled: false,
                filesystem: initialFilesystem,
            });
            setUserData({ os: null, osInstalled: false });
            setUserFilesystem(initialFilesystem);
            setOsSelectionStep('prompt');
        }
    } else {
        setUserData(null);
        setOsSelectionStep('none');
        resetAuth();
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
    if (user) {
        if(osSelectionStep !== 'done') return ''; // Don't show welcome message until OS is installed
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
      setUserData((prev: any) => ({ ...prev, os: selectedOS }));
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
                            filesystem: initialFilesystem,
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
    
    if (osSelectionStep !== 'done') {
        return "Please complete the OS installation first.";
    }


    const argString = args.join(' ');
    const fullCommand = [cmd.toLowerCase(), ...args].join(' ');

    const osCommands: { [key: string]: () => string } = {
        'sudo': () => {
            if (isRoot) return `root already has superuser privileges.`;
            const sudoArg = args.join(' ');
            return sudoArg ? processCommand(sudoArg).then(output => `[sudo] password for ${user?.email?.split('@')[0]}:\n${typeof output === 'string' ? output : 'OK'}`) as unknown as string : 'usage: sudo <command>';
        },
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
        const node = getNodeFromPath(targetPath, userFilesystem);
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
        const node = getNodeFromPath(newPath, userFilesystem);
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
        const node = getNodeFromPath(targetPath, userFilesystem);
        if (node && node.type === 'file') {
            if (typeof node.content === 'function') {
                return node.content();
            }
          return node.content;
        }
        return `cat: ${argString}: No such file or directory`;
      }

      case 'pwd':
        return cwd;

      case 'whoami':
        return isRoot ? 'root' : user?.email?.split('@')[0] || 'guest';
      
      case 'uname':
        if (argString === '-a') {
            return `Linux hacker-terminal 5.4.0-150-generic #167-Ubuntu SMP Mon May 15 17:33:04 UTC 2023 x86_64 x86_64 x86_64 GNU/Linux`;
        }
        return 'Linux';
      
      case 'echo':
        return argString;
      
      case 'touch': {
        if (!argString) return 'touch: missing file operand';
        const newFs = JSON.parse(JSON.stringify(userFilesystem));
        const targetPath = resolvePath(argString);
        const parentNode = getParentNodeFromPath(targetPath, newFs);
        const filename = targetPath.split('/').pop();
        if (parentNode && filename) {
            if (parentNode.children[filename]) {
                return '';
            }
            parentNode.children[filename] = { type: 'file', content: '' };
            setUserFilesystem(newFs);
            await updateFirestoreFilesystem(newFs);
            return '';
        }
        return `touch: cannot touch '${argString}': No such file or directory`;
      }
      
      case 'mkdir': {
        if (!argString) return 'mkdir: missing operand';
        const newFs = JSON.parse(JSON.stringify(userFilesystem));
        const targetPath = resolvePath(argString);
        const parentNode = getParentNodeFromPath(targetPath, newFs);
        const dirname = targetPath.split('/').pop();
        if (parentNode && dirname) {
            if (parentNode.children[dirname]) {
                return `mkdir: cannot create directory ‘${argString}’: File exists`;
            }
            parentNode.children[dirname] = { type: 'directory', children: {} };
            setUserFilesystem(newFs);
            await updateFirestoreFilesystem(newFs);
            return '';
        }
        return `mkdir: cannot create directory ‘${argString}’: No such file or directory`;
      }

      case 'rm': {
        if (!argString) return 'rm: missing operand';
        const newFs = JSON.parse(JSON.stringify(userFilesystem));
        const targetPath = resolvePath(argString);
        const parentNode = getParentNodeFromPath(targetPath, newFs);
        const nodeName = targetPath.split('/').pop();
        if (parentNode && nodeName && parentNode.children[nodeName]) {
            const nodeToRemove = parentNode.children[nodeName];
            if (nodeToRemove.type === 'directory' && Object.keys(nodeToRemove.children).length > 0 && !args.includes('-r')) {
                return `rm: cannot remove '${argString}': Directory not empty`;
            }
            delete parentNode.children[nodeName];
            setUserFilesystem(newFs);
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
            return `USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root           1  0.0  0.1 167292  9284 ?        Ss   May30   0:01 /sbin/init
root           2  0.0  0.0      0     0 ?        S    May30   0:00 [kthreadd]
${isRoot ? 'root' : user?.email?.split('@')[0]}     1337  0.5  0.2 222333  4321 pts/0    Rs+  14:15   0:02 bash
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

      case 'createfile': {
        const match = argString.match(/^(\S+)\s+"(.*)"$/);
        if (!match) {
          return 'Usage: createfile [filename] "[content]"';
        }
        const [, filename, content] = match;
        const newFs = JSON.parse(JSON.stringify(userFilesystem));
        const targetPath = resolvePath(cwd);
        const node = getNodeFromPath(targetPath, newFs);

        if (node && node.type === 'directory') {
          if (node.children[filename]) {
            return `createfile: cannot create file '${filename}': File exists`;
          }
          const newFile: File = { type: 'file', content: content };
          node.children[filename] = newFile;
          setUserFilesystem(newFs);
          await updateFirestoreFilesystem(newFs);
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
  }, [cwd, toast, user, authStep, authCredentials, getInitialPrompt, resetAuth, isRoot, osSelectionStep, userData, fetchUserData, userFilesystem]);

  return { prompt, processCommand, getWelcomeMessage, authStep, resetAuth, osSelectionStep, setOsSelectionStep };
};
