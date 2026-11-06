const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('heatmap', {
  get: (id) => ipcRenderer.invoke('heatmap:get', id),
  list: () => ipcRenderer.invoke('heatmap:list'),
  create: (input) => ipcRenderer.invoke('heatmap:create', input),
  update: (id, patch) => ipcRenderer.invoke('heatmap:update', id, patch),
  remove: (id) => ipcRenderer.invoke('heatmap:remove', id),
  cycleDay: (id, key) => ipcRenderer.invoke('heatmap:cycle-day', id, key),
  clearDay: (id, key) => ipcRenderer.invoke('heatmap:clear-day', id, key),
  onChanged: (callback) => ipcRenderer.on('heatmap:changed', (_event, payload) => callback(payload)),
});
