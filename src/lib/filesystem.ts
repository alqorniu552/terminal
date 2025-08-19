
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
        content: 'Welcome to your personal filesystem! You can create files and directories here.'
    },
    'projects': {
        type: 'directory',
        children: {}
    }
  },
};
