
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

export const initialFilesystem: Directory = {
  type: 'directory',
  children: {
    '.bashrc': {
        type: 'file',
        content: '# Add your custom aliases here\nalias ll=\'ls -l\'\nalias c=\'clear\'\n'
    },
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
    'mission_image.jpg': {
        type: 'file',
        content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    },
    'shadow.bak': {
        type: 'file',
        content: 'root:5f4dcc3b5aa765d61d8327deb882cf99' // md5 for 'password'
    },
    'a.out': {
        type: 'file',
        content: 'ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 3.2.0, not stripped'
    },
    'linpeas.sh': {
        type: 'file',
        content: linpeasOutput
    },
    'lib': {
        type: 'directory',
        children: {
            'wordlist.txt': {
                type: 'file',
                content: wordlistContent
            }
        }
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
  },
};
