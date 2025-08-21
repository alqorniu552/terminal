
export interface File {
  type: 'file';
  content: string | (() => string);
  path?: string;
  logicBomb?: boolean;
}

export interface Directory {
  type: 'directory';
  children: {
    [key: string]: File | Directory;
  };
  path?: string;
}

export type FilesystemNode = File | Directory;

const linpeasOutput = () => {
    return `
PEASS-NG - Privilege Escalation Awesome Scripts SUITE new generation

[+] SYSTEM INFORMATION
... (lots of system info) ...

[+] INTERESTING FILES
Highly probable interesting files
  - /var/backups/password.bak
    FLAG{P3A_55_15_4W3S0M3}
`;
}

const wordlistContent = `password
123456
123456789
guest
qwerty
12345
dragon
princess
secret
admin
root
football
iloveyou
sunshine
superman
batman
Pa55w0rd!
Security
P@$$w0rd
Ch@ll3ng3`;

export const getWordlist = () => {
    return wordlistContent.split('\n');
}

export const initialFilesystem: Directory = {
  type: 'directory',
  path: '/',
  children: {
    '.bashrc': {
        type: 'file',
        path: '/.bashrc',
        content: '# Add your custom aliases here\nalias ll=\'ls -alF\'\nalias c=\'clear\'\n'
    },
    'welcome.txt': {
        type: 'file',
        path: '/welcome.txt',
        content: 'Welcome to your personal command center! Use CTF tools to find secrets.'
    },
    'bin': {
        type: 'directory',
        path: '/bin',
        children: {
            'bash': { type: 'file', path: '/bin/bash', content: 'Binary file' },
            'ls': { type: 'file', path: '/bin/ls', content: 'Binary file' },
            'cat': { type: 'file', path: '/bin/cat', content: 'Binary file' },
            'rm': { type: 'file', path: '/bin/rm', content: 'Binary file' },
            'python': { type: 'file', path: '/bin/python', content: 'Binary file' },
        }
    },
    'etc': {
        type: 'directory',
        path: '/etc',
        children: {
            'passwd': { type: 'file', path: '/etc/passwd', content: 'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nbin:x:2:2:bin:/bin:/usr/sbin/nologin\nuser1:x:1000:1000:user1:/home/user1:/bin/bash\nuser2:x:1001:1001:user2:/home/user2:/bin/bash\n' },
            'group': { type: 'file', path: '/etc/group', content: 'root:x:0:\nbin:x:2:\nuser1:x:1000:\nuser2:x:1001:\n' },
            'hosts': { type: 'file', path: '/etc/hosts', content: '127.0.0.1\tlocalhost\n::1\tlocalhost\n' },
            'shadow.bak': {
                type: 'file',
                path: '/etc/shadow.bak',
                content: 'root:5f4dcc3b5aa765d61d8327deb882cf99' // md5 for 'password'
            },
            'ssh': {
                type: 'directory',
                path: '/etc/ssh',
                children: {
                    'sshd_config': { type: 'file', path: '/etc/ssh/sshd_config', content: '# SSH Server Configuration\nPermitRootLogin no\nPasswordAuthentication yes\n' }
                }
            }
        }
    },
    'home': {
        type: 'directory',
        path: '/home',
        children: {
            'user1': {
                type: 'directory',
                path: '/home/user1',
                children: {
                    'documents': {
                        type: 'directory',
                        path: '/home/user1/documents',
                        children: {
                            'notes.txt': { type: 'file', path: '/home/user1/documents/notes.txt', content: 'My secret project ideas...' }
                        }
                    },
                    'main.py': { type: 'file', path: '/home/user1/main.py', content: 'print("Hello from user1")' }
                }
            },
            'user2': {
                type: 'directory',
                path: '/home/user2',
                children: {
                    'config.json': { type: 'file', path: '/home/user2/config.json', content: '{ "theme": "dark" }' }
                }
            }
        }
    },
    'lib': {
        type: 'directory',
        path: '/lib',
        children: {
            'wordlist.txt': {
                type: 'file',
                path: '/lib/wordlist.txt',
                content: wordlistContent
            }
        }
    },
    'opt': {
        type: 'directory',
        path: '/opt',
        children: {
            'linpeas.sh': {
                type: 'file',
                path: '/opt/linpeas.sh',
                content: 'DYNAMIC_CONTENT::LINPEAS'
            },
        }
    },
    'root': {
        type: 'directory',
        path: '/root',
        children: {
            '.secret_root_file.txt': { type: 'file', path: '/root/.secret_root_file.txt', content: 'This is a secret file only accessible by root.' }
        }
    },
    'tmp': {
        type: 'directory',
        path: '/tmp',
        children: {
            'corrupted.dat': {
                type: 'file',
                path: '/tmp/corrupted.dat',
                content: 'Binary gibberish data... looks corrupted.',
                logicBomb: true,
            }
        }
    },
    'usr': {
        type: 'directory',
        path: '/usr',
        children: {
            'bin': { 
                type: 'directory',
                path: '/usr/bin',
                children: {
                    'nmap': { type: 'file', path: '/usr/bin/nmap', content: 'Binary file' },
                    'gobuster': { type: 'file', path: '/usr/bin/gobuster', content: 'Binary file' },
                    'strings': { type: 'file', path: '/usr/bin/strings', content: 'Binary file' },
                }
            },
            'sbin': {
                type: 'directory',
                path: '/usr/sbin',
                children: {}
            },
            'lib': { type: 'directory', path: '/usr/lib', children: {} },
            'share': { type: 'directory', path: '/usr/share', children: {} },
        }
    },
    'var': {
      type: 'directory',
      path: '/var',
      children: {
        'backups': {
            type: 'directory',
            path: '/var/backups',
            children: {
                'snapshot.tgz': {
                    type: 'file',
                    path: '/var/backups/snapshot.tgz',
                    content: 'System backup archive. Contains a copy of user files.'
                }
            }
        },
        'log': {
            type: 'directory',
            path: '/var/log',
            children: {
                'auth.log': {
                    type: 'file',
                    path: '/var/log/auth.log',
                    content: `May 10 10:00:01 server sshd[1234]: Accepted password for user1 from 192.168.1.10 port 1234 ssh2
May 10 10:00:02 server sshd[1234]: pam_unix(sshd:session): session opened for user user1 by (uid=0)
May 10 10:01:00 server sshd[1238]: Failed password for invalid user admin from 10.0.0.5 port 54321 ssh2
May 10 10:01:05 server sshd[1238]: Failed password for invalid user admin from 10.0.0.5 port 54321 ssh2
May 10 10:01:10 server sshd[1238]: Connection closed by 10.0.0.5 [preauth]
May 10 10:02:00 server CRON[1240]: pam_unix(cron:session): session opened for user root by (uid=0)
May 10 10:02:01 server CRON[1240]: pam_unix(cron:session): session closed for user root
May 10 10:03:00 server sshd[1245]: Received disconnect from 203.0.113.100: 11: Bye Bye
May 10 10:03:15 server sshd[1250]: input_userauth_request: invalid user oracle [preauth]
May 10 10:03:20 server sshd[1250]: Failed password for invalid user oracle from 203.0.113.100 port 1337 ssh2
May 10 10:04:00 server sshd[1255]: Accepted publickey for user2 from 198.51.100.2 port 4321 ssh2
May 10 10:04:01 server sshd[1255]: pam_unix(sshd:session): session opened for user user2 by (uid=0)
May 10 10:05:00 server anacron[1260]: Anacron 2.3 started on 2024-05-10
May 10 10:05:01 server anacron[1260]: Will run job \`cron.daily' in 25 minutes.
May 10 10:05:30 server sshd[1265]: Disconnecting: Too many authentication failures for root
May 10 10:06:00 server kernel: [  345.123456] usb 1-1: new high-speed USB device number 2 using ehci-pci
May 10 10:06:05 server sshd[1270]: error: kex_exchange_identification: Connection closed by remote host
May 10 10:07:00 server sudo:  user1 : TTY=pts/0 ; PWD=/home/user1 ; USER=root ; COMMAND=/usr/bin/apt-get update
May 10 10:07:01 server su: (to root) user1 on pts/0
May 10 10:07:02 server su: pam_unix(su:session): session opened for user root by user1(uid=1000)
May 10 10:08:00 server sshd[1275]: Strange situation: user guest attempted to log in with a password but is not in the system. The secret is FLAG{L0G_F0R3NS1CS_R0CKS}
May 10 10:09:00 server systemd: SERVICE_START pid=1 uid=0 auid=4294967295 ses=4294967295 msg='unit=badactor_service comm="systemd" exe="/usr/lib/systemd/systemd" hostname=? addr=? terminal=? res=failed' data='vigenerekey'
`
                },
                'syslog': {
                    type: 'file',
                    path: '/var/log/syslog',
                    content: 'May 10 10:00:01 server systemd[1]: Starting system... \nMay 10 10:09:00 server systemd: badactor_service failed to start.'
                }
            }
        },
        'lib': {
          type: 'directory',
          path: '/var/lib',
          children: {
            'warlock.core': {
              type: 'file',
              path: '/var/lib/warlock.core',
              content: 'Warlock Active Defense System v1.0\nSTATUS: ACTIVE\nTHREAT LEVEL: DANGEROUS\nDO NOT DELETE'
            }
          }
        },
        'www': {
            type: 'directory',
            path: '/var/www',
            children: {
                'html': {
                    type: 'directory',
                    path: '/var/www/html',
                    children: {
                        'index.html': { type: 'file', path: '/var/www/html/index.html', content: '<html><body><h1>It works!</h1></body></html>'},
                        'secret.jpg': {
                            type: 'file',
                            path: '/var/www/html/secret.jpg',
                            content: 'This is not a real image file, but you can run `strings` on it to find a secret. FLAG{3X1F_M3T4D4T4_H1DD3N_S3CR3T}'
                        },
                        'mission_image.jpg': {
                            type: 'file',
                            path: '/var/www/html/mission_image.jpg',
                            content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
                        },
                         'gobuster.txt': {
                            type: 'file',
                            path: '/var/www/html/gobuster.txt',
                            content: `
===============================================================
Gobuster v3.1.0
===============================================================
[+] Url:            http://10.10.1.2
[+] Threads:        10
[+] Wordlist:       /usr/share/wordlists/dirb/common.txt
[+] Status codes:   200,204,301,302,307,401,403
[+] User Agent:     gobuster/3.1.0
[+] Timeout:        10s
===============================================================
2024/05/20 10:30:00 Starting gobuster
===============================================================
/images (Status: 301)
/uploads (Status: 301)
/config.php.bak (Status: 200)
/admin (Status: 403)
===============================================================
2024/05/20 10:31:00 Finished
===============================================================
                            `
                        },
                    }
                }
            }
        },
         'news': {
            type: 'directory',
            path: '/var/news',
            children: {
                '01-quantum-threat.txt': {
                    type: 'file',
                    path: '/var/news/01-quantum-threat.txt',
                    content: `TITLE: The Quantum Threat is Real
DATE: 2024-05-21

Experts warn that the age of quantum computing could shatter current encryption standards within the next decade. 
Governments and corporations are in a frantic race to develop quantum-resistant cryptography before it's too late. 
"It's not a matter of if, but when," stated one researcher. "The cryptographic apocalypse is on the horizon."`
                },
                '02-ai-defenses.txt': {
                    type: 'file',
                    path: '/var/news/02-ai-defenses.txt',
                    content: `TITLE: Next-Gen AI Defenses Deployed
DATE: 2024-05-20

A new wave of AI-powered active defense systems are being deployed across major networks. These systems, like the infamous 'Warlock',
don't just block attacks—they learn, adapt, and retaliate. Security analysts report that these AIs can trace back intrusions, 
deploy countermeasures, and even launch targeted counter-strikes against attackers in real-time. The line between defender and aggressor is blurring.`
                },
                '03-zero-day-alert.txt': {
                    type: 'file',
                    path: '/var/news/03-zero-day-alert.txt',
                    content: `TITLE: CRITICAL: Zero-Day Exploit in "Omni-Core" Services
DATE: 2024-05-19

A critical zero-day vulnerability has been discovered in the widely used "Omni-Core" server software. 
The exploit allows for unauthenticated remote code execution. All system administrators are urged to patch immediately.
The vulnerability, dubbed 'Ether-Leak', is being actively exploited in the wild by multiple threat actors. An emergency patch is expected, but no ETA has been provided.`
                }
            }
        }
      }
    },
    'a.out': {
        type: 'file',
        path: '/a.out',
        content: 'ELF 64-bit LSB executable... not stripped. Maybe try `strings`? FLAG{B4S1C_R3V3RS1NG_W1TH_STR1NGS}'
    },
  },
};

let currentFilesystem = JSON.parse(JSON.stringify(initialFilesystem));
let originalFileCache: { [path: string]: FilesystemNode } = {};

export const resetFilesystem = () => {
    currentFilesystem = JSON.parse(JSON.stringify(initialFilesystem));
    originalFileCache = {};
}

export const getNodeFromPath = (path: string): FilesystemNode | null => {
  const parts = path.split('/').filter(p => p && p !== '~');
  let currentNode: FilesystemNode = currentFilesystem;

  for (const part of parts) {
    if (currentNode.type === 'directory' && currentNode.children[part]) {
      currentNode = currentNode.children[part];
    } else {
      return null;
    }
  }
  return currentNode;
};


export const getDynamicContent = (content: string | (() => string)): string => {
    let rawContent: string;
    if (typeof content === 'function') {
        rawContent = content();
    } else if (content === 'DYNAMIC_CONTENT::LINPEAS') {
        rawContent = linpeasOutput();
    } else {
        rawContent = content;
    }
    return rawContent;
}

const addNodeToFilesystem = (path: string, node: FilesystemNode): boolean => {
    const parts = path.split('/').filter(p => p);
    const nodeName = parts.pop();
    if (!nodeName) return false;

    let currentDir: FilesystemNode = currentFilesystem;
    for (const part of parts) {
        if (currentDir.type === 'directory' && currentDir.children[part]) {
            currentDir = currentDir.children[part];
        } else if (currentDir.type === 'directory' && !currentDir.children[part]) {
            // Create intermediate directories if they don't exist
            currentDir.children[part] = { type: 'directory', children: {} };
            currentDir = currentDir.children[part];
        } else {
            return false; // Path segment is a file, cannot add node here
        }
    }

    if (currentDir.type === 'directory') {
        currentDir.children[nodeName] = node;
        return true;
    }
    return false;
};

// Helper to update the filesystem in memory
export const updateNodeInFilesystem = (path: string, newContent: string): boolean => {
    const parts = path.split('/').filter(p => p);
    let currentNode: FilesystemNode = currentFilesystem;
    let parentNode: Directory | null = null;
    let lastPart = '';

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (currentNode.type === 'directory') {
            parentNode = currentNode;
            lastPart = part;
            if (currentNode.children[part]) {
                currentNode = currentNode.children[part];
            } else {
                // If the last part of the path doesn't exist, we can create it
                if (i === parts.length - 1) {
                    break; 
                }
                return false;
            }
        } else {
             return false;
        }
    }
    
    if (parentNode && parentNode.type === 'directory') {
        parentNode.children[lastPart] = { type: 'file', content: newContent, path };
        return true;
    }
    
    return false;
};

// Helper to remove a file or directory from the filesystem
export const removeNodeFromFilesystem = (path: string): boolean => {
    const parts = path.split('/').filter(p => p);
    const filename = parts.pop();
    if (!filename) return false;

    let currentDir: FilesystemNode = currentFilesystem;
    for (const part of parts) {
        if (currentDir.type === 'directory' && currentDir.children[part]) {
            currentDir = currentDir.children[part];
        } else {
            return false; // Path does not exist
        }
    }

    if (currentDir.type === 'directory' && currentDir.children[filename]) {
        delete currentDir.children[filename];
        return true;
    }

    return false;
};


export const isPackageInstalled = (pkg: string): boolean => {
    if (pkg === 'nginx') {
        return !!getNodeFromPath('/etc/nginx');
    }
    return false;
};

export const installPackage = (pkg: string): boolean => {
    if (pkg === 'nginx') {
        if (isPackageInstalled('nginx')) return true;

        // Create Nginx directory structure and files
        addNodeToFilesystem('/etc/nginx', { type: 'directory', children: {} });
        addNodeToFilesystem('/etc/nginx/sites-available', { type: 'directory', children: {} });
        addNodeToFilesystem('/etc/nginx/sites-enabled', { type: 'directory', children: {} });
        addNodeToFilesystem('/var/log/nginx', { type: 'directory', children: {} });
        
        const nginxConfContent = `user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 768;
}

http {
    sendfile on;
    tcp_nopush on;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    gzip on;

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}`;
        addNodeToFilesystem('/etc/nginx/nginx.conf', { type: 'file', content: nginxConfContent });

        const defaultSiteContent = `server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.html index.htm;

    server_name _;

    location / {
        try_files $uri $uri/ =404;
    }
}`;
        addNodeToFilesystem('/etc/nginx/sites-available/default', { type: 'file', content: defaultSiteContent });
        
        // Simulate symlink
        addNodeToFilesystem('/etc/nginx/sites-enabled/default', { type: 'file', content: defaultSiteContent });
        
        addNodeToFilesystem('/var/log/nginx/access.log', { type: 'file', content: '' });
        addNodeToFilesystem('/var/log/nginx/error.log', { type: 'file', content: '' });

        addNodeToFilesystem('/usr/sbin/nginx', { type: 'file', content: 'Binary file' });

        return true;
    }
    return false;
};

// Ransomware Simulation
export const triggerRansomware = (userHomePath: string): string[] => {
    const userHomeNode = getNodeFromPath(userHomePath);
    if (!userHomeNode || userHomeNode.type !== 'directory') {
        return [];
    }

    const encryptedFiles: string[] = [];
    originalFileCache = {}; // Clear previous cache

    const recurseAndEncrypt = (dir: Directory, currentPath: string) => {
        Object.keys(dir.children).forEach(name => {
            const node = dir.children[name];
            const fullPath = `${currentPath}/${name}`.replace('//', '/');
            
            if (node.type === 'file') {
                // Cache the original file before overwriting
                originalFileCache[fullPath] = JSON.parse(JSON.stringify(node)); 

                const encryptedNode: File = {
                    type: 'file',
                    content: `[FILE ANDA TELAH DIENKRIPSI OLEH DEADBOLT]\nID unik: ${Math.random().toString(36).substring(2)}`,
                    path: `${fullPath}.deadbolt`
                };
                dir.children[`${name}.deadbolt`] = encryptedNode;
                delete dir.children[name];
                encryptedFiles.push(fullPath);
            } else if (node.type === 'directory') {
                recurseAndEncrypt(node, fullPath);
            }
        });
    };

    recurseAndEncrypt(userHomeNode, userHomePath);

    // Drop the ransom note
    const ransomNoteContent = `
Semua file pribadi Anda telah dienkripsi oleh DEADBOLT.
File Anda tidak dapat dipulihkan dengan cara apa pun selain dengan kunci dekripsi kami.

Jangan coba-coba memulihkan file Anda sendiri, Anda akan merusaknya secara permanen.

Satu-satunya cara untuk mendapatkan kembali file Anda adalah dengan membayar tebusan.
...
PEMULIHAN SISTEM DARURAT MUNGKIN TERSEDIA UNTUK ADMINISTRATOR.
FLAG{DEADBOLT_DEFEATED_BY_BACKUPS}`;

    userHomeNode.children['RANSOM_NOTE.txt'] = {
        type: 'file',
        content: ransomNoteContent,
        path: `${userHomePath}/RANSOM_NOTE.txt`
    };

    return encryptedFiles;
};

export const restoreBackup = (userHomePath: string): boolean => {
    const userHomeNode = getNodeFromPath(userHomePath);
    if (!userHomeNode || userHomeNode.type !== 'directory') {
        return false;
    }
    
    // Clear the current home directory
    userHomeNode.children = {};

    // Restore from cache
    Object.keys(originalFileCache).forEach(path => {
        if (path.startsWith(userHomePath)) {
            const relativePath = path.substring(userHomePath.length + 1);
            const parts = relativePath.split('/');
            let currentNode = userHomeNode;

            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                if (!currentNode.children[part]) {
                    currentNode.children[part] = { type: 'directory', children: {} };
                }
                currentNode = currentNode.children[part] as Directory;
            }
            
            const filename = parts[parts.length - 1];
            currentNode.children[filename] = originalFileCache[path];
        }
    });

    originalFileCache = {}; // Clear cache after use
    return true;
};
