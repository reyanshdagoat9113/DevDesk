import { contextBridge, ipcRenderer } from 'electron';

// Expose a safe API to renderer
const api = {
  // Platform info
  platform: process.platform,

  // Send commands to main process
  send: (channel: string, ...args: unknown[]) => {
    const validChannels = ['run-command', 'open-project', 'list-containers'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },

  // Listen for responses from main process
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = ['command-output', 'containers-list'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
