
import { Buffer } from 'buffer';

export interface File {
  type: 'file';
  content: string | (() => string);
}

export interface Directory {
  type: 'directory';
  children: {
    [key: string]: File | Directory;
  };
}

export type FilesystemNode = File | Directory;

const baseFilesystem: Directory = {
  type: 'directory',
  children: {
    'home': {
        type: 'directory',
        children: {} // User directories will be added dynamically
    },
    'etc': {
        type: 'directory',
        children: {
            'hosts': { type: 'file', content: '127.0.0.1 localhost\n::1 localhost' },
            'shadow.bak': { type: 'file', content: 'root:5f4dcc3b5aa765d61d8327deb882cf99\n' } // md5 for "password"
        }
    },
    'var': {
        type: 'directory',
        children: {
            'log': {
                type: 'directory',
                children: {
                    'auth.log': { 
                        type: 'file', 
                        content: `Aug 22 10:10:01 server sshd[1234]: Accepted publickey for user from 192.168.1.10
Aug 22 10:15:03 server sshd[1235]: Failed password for invalid user non_existent_user from 10.0.0.5 port 22
Aug 22 10:15:04 server sshd[1235]: message repeated 2 times: [ Failed password for invalid user non_existent_user from 10.0.0.5 port 22]
Aug 22 10:20:21 server CRON[1250]: (root) CMD (run-parts --report /etc/cron.hourly)
FLAG{L0G_F0R3NS1CS_R0CKS}`
                    }
                }
            }
        }
    },
    'bin': {
        type: 'directory',
        children: {
            'linpeas.sh': {
                type: 'file',
                content: `#!/bin/bash
echo "Searching for vulnerabilities..."
sleep 1
echo "Found potential privilege escalation vector."
echo "FLAG{P3A_55_15_4W3S0M3}"`
            }
        }
    },
    'root': {
        type: 'directory',
        children: {
            '.bashrc': {type: 'file', content: 'alias ll="ls -la"'},
            'mission_image.jpg': {
                type: 'file',
                content: () => {
                    const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='; // 1x1 black pixel
                    const secret = 'FLAG{ST3G4N0GRAPHY_1S_C00L}';
                    const encodedSecret = Buffer.from(secret).toString('base64');
                    // This is a fake steganography, just appending data.
                    return `data:image/png;base64,${base64Image}::SECRET::${encodedSecret}`;
                }
            }
        }
    },
    'lib': {
        type: 'directory',
        children: {
            'wordlist.txt': {
                type: 'file',
                content: '123456\npassword\nqwerty\nadmin\nuser\n'
            }
        }
    },
    'tmp': {
        type: 'directory',
        children: {}
    },
    'a.out': {
        type: 'file',
        content: `ELF...some unreadable binary content...GCC: (Ubuntu 9.3.0-17ubuntu1~20.04) 9.3.0...find_secret()...validate_license()...connect_to_server()...here is a string: FLAG{B4S1C_R3V3RS1NG_W1TH_STR1NGS}`
    },
    'secret.jpg': {
        type: 'file',
        content: () => {
            // Simulate EXIF data by just appending it. A real tool would parse this.
            const base64Image = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/2wBDAQICAgMDAwYEBAMFBwYHBwcGBwcICQsJCAgKCAcHCg0KCgsMDAwMBwkODw0MDgsMDAz/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AAf/Z'; // 1x1 white pixel
            return `data:image/jpeg;base64,${base64Image}::EXIF::Note=FLAG{3X1F_M3T4D4T4_H1DD3N_S3CR3T}`;
        }
    },
    'welcome.txt': {
        type: 'file',
        content: 'Welcome to the Command Center. Your mission, should you choose to accept it, is to find all the hidden flags. Good luck.'
    }
  },
};

// Deep clone the filesystem to prevent mutation across sessions
let filesystem: Directory = JSON.parse(JSON.stringify(baseFilesystem));

export function getDynamicContent(node: File): string {
    if (typeof node.content === 'function') {
        return node.content();
    }
    return node.content;
}

export function updateNodeInFilesystem(path: string, newContent: string) {
    const parts = path.split('/').filter(p => p);
    let currentNode: Directory = filesystem;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const nextNode = currentNode.children[part];
        if (nextNode && nextNode.type === 'directory') {
            currentNode = nextNode;
        } else {
            return; // Path does not exist
        }
    }
    const fileName = parts[parts.length - 1];
    const fileNode = currentNode.children[fileName];
    if (fileNode && fileNode.type === 'file') {
        (fileNode as File).content = newContent;
    }
}

export function removeNodeFromFilesystem(path: string) {
    const parts = path.split('/').filter(p => p);
    if (parts.length === 0) return; // Cannot remove root

    let currentNode: Directory = filesystem;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const nextNode = currentNode.children[part];
        if (nextNode && nextNode.type === 'directory') {
            currentNode = nextNode;
        } else {
            return; // Parent path does not exist
        }
    }

    const nodeName = parts[parts.length - 1];
    if (currentNode.children[nodeName]) {
        delete currentNode.children[nodeName];
    }
}

export function addNodeToFilesystem(path: string, name: string, node: FilesystemNode) {
    const parts = path.split('/').filter(p => p);
    let currentNode: Directory = filesystem;
    for (const part of parts) {
        const nextNode = currentNode.children[part];
        if (nextNode && nextNode.type === 'directory') {
            currentNode = nextNode;
        } else {
            return; // Path does not exist
        }
    }
    currentNode.children[name] = node;
}

export function getWordlist(): string[] | null {
    const node = (filesystem.children['lib'] as Directory)?.children['wordlist.txt'];
    if (node && node.type === 'file') {
        return getDynamicContent(node).split('\n').filter(Boolean);
    }
    return null;
}

export { filesystem };
