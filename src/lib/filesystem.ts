
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
    'root': {
      type: 'directory',
      children: {
        'secret.txt': {
            type: 'file',
            content: 'This file is only accessible to the root user.'
        }
      }
    }
  },
};
