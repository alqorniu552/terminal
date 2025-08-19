
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
  },
};
