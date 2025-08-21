
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

export const filesystem: Directory = {
  type: 'directory',
  children: {
    'home': {
        type: 'directory',
        children: {
            'user': {
                type: 'directory',
                children: {
                    'documents': { type: 'directory', children: {} },
                    'downloads': { type: 'directory', children: {} },
                    'README.txt': { type: 'file', content: 'Welcome to your home directory!' }
                }
            }
        }
    },
    'etc': {
        type: 'directory',
        children: {
            'hosts': { type: 'file', content: '127.0.0.1 localhost' }
        }
    },
    'var': {
        type: 'directory',
        children: {
            'log': {
                type: 'directory',
                children: {
                    'sys.log': { type: 'file', content: 'System log placeholder.'}
                }
            }
        }
    }
  },
};

    