const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  importMedia: () => ipcRenderer.invoke('media:import'),
  saveProject: (json) => ipcRenderer.invoke('project:save', json),
  openProject: () => ipcRenderer.invoke('project:open'),
  exportVideo: (project) => ipcRenderer.invoke('export:start', project),
  cancelExport: () => ipcRenderer.invoke('export:cancel'),
  showInFolder: (file) => ipcRenderer.invoke('shell:show', file),
  onExportProgress: (cb) => {
    const handler = (_e, p) => cb(p);
    ipcRenderer.on('export:progress', handler);
    return () => ipcRenderer.removeListener('export:progress', handler);
  },
});
