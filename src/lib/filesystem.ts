
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
    'config.php.bak': {
        type: 'file',
        content: 'FTP_USER=ftp_user\nFTP_PASS=Ch4ll3ng3_4cc3pt3d'
    },
    'puzzle.txt': {
        type: 'file',
        content: 'Gsv jfrxp yildm ulc qfnkh levi gsv ozab wlt.'
    },
    'secret_recipe.txt': {
        type: 'file',
        content: 'Tf aycq wj ingg, ylq cjgz qjg gtjrvog. Jvu hsccegv rwvf jrwp pqqr jb hspy zs zaoaf wvejot.'
    },
    'credentials.enc': {
        type: 'file',
        content: 'U2FsdGVkX1951P4/iN3fDoE5sroM8bI0c2xT/2sWBik='
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
    },
    'vulnerable_login': {
        type: 'file',
        content: 'ELF 64-bit LSB executable, vulnerable to buffer overflow'
    },
    'image_with_secret.png': {
        type: 'file',
        content: 'A PNG image that might contain hidden data. The password is a magic word.'
    },
    'memdump.raw': {
        type: 'file',
        content: 'Memory dump file. Use volatility to analyze.'
    },
    'vulnerable_forum.txt': {
        type: 'file',
        content: '[admin] Welcome to the forum! Feel free to post.'
    },
    'auth.log': {
        type: 'file',
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
    'credentials.zip': {
        type: 'file',
        content: 'PK... (this is a fake zip file). The password is a magic word.'
    },
    'config.dat': {
        type: 'file',
        // Base64 for "username=guest;role=user;command=whoami"
        content: 'dXNlcm5hbWU9Z3Vlc3Q7cm9sZT11c2VyO2NvbW1hbmQ9d2hvYW1p'
    },
    'config-loader': {
        type: 'file',
        content: 'ELF 64-bit LSB executable, reads from config.dat'
    }
  },
};

    
