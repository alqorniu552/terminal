
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

const linpeasOutput = () => {
    return `
\x1b[1;33mPEASS-NG\x1b[0m - \x1b[1;36mPrivilege Escalation Awesome Scripts SUITE new generation\x1b[0m

\x1b[1;34m[+] \x1b[0m\x1b[1;33mSYSTEM INFORMATION\x1b[0m
\x1b[1;32m... (lots of system info) ...\x1b[0m

\x1b[1;34m[+] \x1b[0m\x1b[1;33mINTERESTING FILES\x1b[0m
\x1b[1;31;40mHighly probable interesting files\x1b[0m
  - \x1b[1;32m/var/backups/password.bak\x1b[0m
    \x1b[0;36mFLAG{P3A_55_15_4W3S0M3}\x1b[0m
`;
}


export const initialFilesystem: Directory = {
  type: 'directory',
  children: {
    'welcome.txt': {
        type: 'file',
        content: 'Welcome to your personal filesystem! Use CTF tools to find secrets.'
    },
    'projects': {
        type: 'directory',
        children: {}
    },
    'secret.jpg': {
        type: 'file',
        content: 'This is not a real image file, but you can run `exiftool` or `strings` on it.'
    },
    'credentials.enc': {
        type: 'file',
        content: 'U2FsdGVkX1/RxE5B5D... (this is fake encrypted data). The password is hidden somewhere.'
    },
    'a.out': {
        type: 'file',
        content: 'ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 3.2.0, not stripped'
    },
    'linpeas.sh': {
        type: 'file',
        content: linpeasOutput
    },
    'capture.pcap': {
        type: 'file',
        content: 'Fake PCAP file. Use tshark to analyze.'
    }
  },
};
