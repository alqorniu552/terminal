
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
    'about': {
      type: 'directory',
      children: {
        'me.txt': {
          type: 'file',
          content: 'Just a humble terminal interface built with Next.js and Tailwind CSS.',
        },
        'tech.txt': {
            type: 'file',
            content: 'Next.js, React, TypeScript, Tailwind CSS, Genkit AI'
        }
      },
    },
    'projects': {
      type: 'directory',
      children: {
        'this-website.txt': {
          type: 'file',
          content: 'This very website is a project itself! Navigate around to see its features.'
        },
      },
    },
    'root': {
      type: 'directory',
      children: {
        'secret.txt': {
            type: 'file',
            content: 'This file is only accessible to the root user.'
        }
      }
    },
    'contact.txt': {
      type: 'file',
      content: `
You can find the source code on GitHub.
Just kidding, this is a simulation.
`,
    },
  },
};

    