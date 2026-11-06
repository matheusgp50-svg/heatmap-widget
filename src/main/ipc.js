import { ipcMain } from 'electron';
import { toDateKey } from '../shared/calendar.js';
import { StoreError } from './store.js';

export function registerIpc({ store, widgets, warn }) {
  const changed = (id) => widgets.broadcast('heatmap:changed', { id });

  function handleChange(channel, run) {
    ipcMain.handle(channel, (_event, ...args) => {
      try {
        return run(...args);
      } catch (error) {
        if (!(error instanceof StoreError)) warn('Não foi possível salvar. Tente de novo.');
        throw error;
      }
    });
  }

  ipcMain.handle('heatmap:get', (_event, id) => store.get(id));
  ipcMain.handle('heatmap:list', () => store.list());

  handleChange('heatmap:create', (input) => {
    const { id } = store.create(input);
    widgets.open(store.get(id));
    changed(id);
    return store.get(id);
  });
  handleChange('heatmap:update', (id, patch) => {
    const heatmap = store.update(id, patch);
    changed(id);
    return heatmap;
  });
  handleChange('heatmap:remove', (id) => {
    store.remove(id);
    widgets.close(id);
    changed(id);
  });
  handleChange('heatmap:cycle-day', (id, key) => {
    const level = store.cycleDay(id, key, toDateKey(new Date()));
    changed(id);
    return level;
  });
  handleChange('heatmap:clear-day', (id, key) => {
    const level = store.clearDay(id, key, toDateKey(new Date()));
    changed(id);
    return level;
  });
}
