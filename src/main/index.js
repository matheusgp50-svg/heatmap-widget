import { app, Notification } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpc } from './ipc.js';
import { createStore } from './store.js';
import { createWidgets } from './widgets.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.HEATMAP_DATA_DIR ?? join(app.getPath('appData'), 'heatmap-widgets');

app.setPath('userData', dataDir);
app.setAppUserModelId('com.heatmapwidgets.app');

function warn(message) {
  new Notification({ title: 'Heatmap Widgets', body: message }).show();
}

app.whenReady().then(() => {
  const store = createStore(join(dataDir, 'data.json'));
  const { status } = store.load();
  const widgets = createWidgets({ store, preloadPath: join(here, '..', 'preload.cjs'), warn });

  registerIpc({ store, widgets, warn });
  app.on('before-quit', () => widgets.allowClose());
  widgets.openAll();

  if (status === 'recovered') {
    warn('Os dados estavam corrompidos. Uma cópia foi guardada e o app iniciou vazio.');
  }
});

// O app continua na bandeja mesmo sem janelas abertas.
app.on('window-all-closed', () => {});
