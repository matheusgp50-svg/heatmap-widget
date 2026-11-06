import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { MAX_LEVEL, isDateKey, nextLevel } from '../shared/calendar.js';
import { COLORS } from '../shared/palettes.js';

const VERSION = 1;
const MAX_NAME = 40;
const RENAME_ATTEMPTS = 3;
const RENAME_WAIT_MS = 50;

export class StoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
  }
}

function cleanName(name) {
  const clean = typeof name === 'string' ? name.trim() : '';
  if (clean.length < 1 || clean.length > MAX_NAME) throw new StoreError('INVALID', 'Nome inválido');
  return clean;
}

function checkColor(color) {
  if (!COLORS.includes(color)) throw new StoreError('INVALID', 'Cor inválida');
  return color;
}

function isPosition(value) {
  return value === null
    || (typeof value === 'object' && Number.isFinite(value.x) && Number.isFinite(value.y));
}

function isHeatmap(value) {
  if (typeof value !== 'object' || value === null) return false;
  const { id, name, color, position, days } = value;
  if (typeof id !== 'string' || !id || !COLORS.includes(color) || !isPosition(position)) return false;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > MAX_NAME) return false;
  if (typeof days !== 'object' || days === null || Array.isArray(days)) return false;
  return Object.entries(days).every(
    ([key, level]) => isDateKey(key) && Number.isInteger(level) && level >= 1 && level <= MAX_LEVEL,
  );
}

function parseData(text) {
  const data = JSON.parse(text.replace(/^﻿/, ''));
  if (data?.version !== VERSION || !Array.isArray(data.heatmaps) || !data.heatmaps.every(isHeatmap)) {
    throw new Error('Formato de dados inválido');
  }
  return data;
}

function replaceFile(from, to) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      renameSync(from, to);
      return;
    } catch (error) {
      // Antivírus e indexadores do Windows seguram arquivos por instantes.
      const busy = error.code === 'EPERM' || error.code === 'EBUSY';
      if (!busy || attempt === RENAME_ATTEMPTS) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, RENAME_WAIT_MS);
    }
  }
}

export function createStore(filePath) {
  let data = { version: VERSION, heatmaps: [] };

  function save(next) {
    const temp = `${filePath}.tmp`;
    writeFileSync(temp, JSON.stringify(next, null, 2), { flush: true });
    replaceFile(temp, filePath);
    data = next;
  }

  // Grava primeiro e só depois troca o estado: uma falha de disco não altera nada.
  function changeHeatmap(id, change) {
    const next = structuredClone(data);
    const heatmap = next.heatmaps.find((item) => item.id === id);
    if (!heatmap) throw new StoreError('NOT_FOUND', 'Heatmap não encontrado');
    const result = change(heatmap);
    save(next);
    return result;
  }

  function checkDay(key, todayKey) {
    if (!isDateKey(key)) throw new StoreError('INVALID', 'Data inválida');
    if (key > todayKey) throw new StoreError('FUTURE_DAY', 'Dia futuro');
  }

  function setLevel(heatmap, key, level) {
    if (level === 0) delete heatmap.days[key];
    else heatmap.days[key] = level;
    return level;
  }

  return {
    load() {
      mkdirSync(dirname(filePath), { recursive: true });
      if (!existsSync(filePath)) {
        save({ version: VERSION, heatmaps: [] });
        return { status: 'new' };
      }
      const text = readFileSync(filePath, 'utf8');
      try {
        data = parseData(text);
        return { status: 'ok' };
      } catch {
        const corruptPath = join(dirname(filePath), `data.corrupt-${Date.now()}.json`);
        replaceFile(filePath, corruptPath);
        save({ version: VERSION, heatmaps: [] });
        return { status: 'recovered', corruptPath };
      }
    },

    list: () => structuredClone(data.heatmaps),

    get(id) {
      const heatmap = data.heatmaps.find((item) => item.id === id);
      return heatmap && structuredClone(heatmap);
    },

    create({ name, color }) {
      const heatmap = {
        id: randomUUID(),
        name: cleanName(name),
        color: checkColor(color),
        position: null,
        days: {},
      };
      const next = structuredClone(data);
      next.heatmaps.push(heatmap);
      save(next);
      return structuredClone(heatmap);
    },

    update(id, patch) {
      return changeHeatmap(id, (heatmap) => {
        if ('name' in patch) heatmap.name = cleanName(patch.name);
        if ('color' in patch) heatmap.color = checkColor(patch.color);
        if ('position' in patch) {
          if (!isPosition(patch.position)) throw new StoreError('INVALID', 'Posição inválida');
          heatmap.position = patch.position;
        }
        return structuredClone(heatmap);
      });
    },

    remove(id) {
      if (!data.heatmaps.some((item) => item.id === id)) {
        throw new StoreError('NOT_FOUND', 'Heatmap não encontrado');
      }
      save({ ...data, heatmaps: data.heatmaps.filter((item) => item.id !== id) });
    },

    cycleDay(id, key, todayKey) {
      checkDay(key, todayKey);
      return changeHeatmap(id, (heatmap) => setLevel(heatmap, key, nextLevel(heatmap.days[key] ?? 0)));
    },

    clearDay(id, key, todayKey) {
      checkDay(key, todayKey);
      return changeHeatmap(id, (heatmap) => setLevel(heatmap, key, 0));
    },
  };
}
