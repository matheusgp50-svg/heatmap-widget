import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs, { mkdtempSync, mkdirSync, readFileSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { createStore } from '../../src/main/store.js';

const TODAY = '2026-11-06';
let dir;
let file;

const withDay = (key, level) => ({
  version: 1,
  heatmaps: [{ id: 'a', name: 'a', color: 'red', position: null, days: { [key]: level } }],
});

function ready() {
  const store = createStore(file);
  store.load();
  return store;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'heatmap-store-'));
  file = join(dir, 'data.json');
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

test('load cria o arquivo quando não existe', () => {
  const store = createStore(file);
  assert.deepEqual(store.load(), { status: 'new' });
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { version: 1, heatmaps: [] });
});

test('dados sobrevivem a recarregar', () => {
  const a = createStore(file);
  a.load();
  const h = a.create({ name: '  Treino ', color: 'green' });
  a.cycleDay(h.id, '2026-11-05', TODAY);
  const b = createStore(file);
  assert.equal(b.load().status, 'ok');
  assert.equal(b.get(h.id).name, 'Treino');
  assert.deepEqual(b.get(h.id).days, { '2026-11-05': 1 });
});

test('aceita arquivo com BOM', () => {
  writeFileSync(file, `﻿${JSON.stringify(withDay('2026-11-06', 2))}`);
  const s = createStore(file);
  assert.equal(s.load().status, 'ok');
  assert.equal(s.get('a').days['2026-11-06'], 2);
});

test('heatmap novo guarda o mês de criação', () => {
  const s = ready();
  assert.equal(s.create({ name: 'a', color: 'red' }, '2026-11').startMonth, '2026-11');
});

test('load dá o mês atual a heatmap antigo e grava', () => {
  writeFileSync(file, JSON.stringify(withDay('2026-11-06', 2)));
  const s = createStore(file);
  assert.equal(s.load(new Date(2026, 10, 6)).status, 'ok');
  assert.equal(s.get('a').startMonth, '2026-11');
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).heatmaps[0].startMonth, '2026-11');
});

test('load mantém o mês inicial já salvo', () => {
  const data = withDay('2026-11-06', 2);
  data.heatmaps[0].startMonth = '2026-08';
  writeFileSync(file, JSON.stringify(data));
  const s = createStore(file);
  s.load(new Date(2026, 10, 6));
  assert.equal(s.get('a').startMonth, '2026-08');
});

test('valida nome e cor', () => {
  const s = ready();
  assert.equal(s.create({ name: 'x'.repeat(40), color: 'red' }).name.length, 40);
  for (const input of [
    { name: '   ', color: 'red' },
    { name: 'x'.repeat(41), color: 'red' },
    { name: 'ok', color: 'pink' },
  ]) {
    assert.throws(() => s.create(input), { code: 'INVALID' });
  }
});

test('update altera nome, cor e posição e valida os valores', () => {
  const s = ready();
  const { id } = s.create({ name: 'a', color: 'red' });
  const updated = s.update(id, { name: ' b ', color: 'blue', position: { x: -1500, y: 10 } });
  assert.deepEqual([updated.name, updated.color, updated.position], ['b', 'blue', { x: -1500, y: 10 }]);
  assert.throws(() => s.update(id, { name: '' }), { code: 'INVALID' });
  assert.throws(() => s.update(id, { position: { x: 'a', y: 1 } }), { code: 'INVALID' });
  assert.throws(() => s.update('nope', { name: 'x' }), { code: 'NOT_FOUND' });
});

test('remove apaga o heatmap', () => {
  const s = ready();
  const { id } = s.create({ name: 'a', color: 'red' });
  s.remove(id);
  assert.deepEqual(s.list(), []);
  assert.throws(() => s.remove(id), { code: 'NOT_FOUND' });
});

test('cycleDay percorre os níveis e nível 0 sai do arquivo', () => {
  const s = ready();
  const { id } = s.create({ name: 'a', color: 'red' });
  const levels = [1, 2, 3, 4, 5].map(() => s.cycleDay(id, TODAY, TODAY));
  assert.deepEqual(levels, [1, 2, 3, 4, 0]);
  assert.deepEqual(s.get(id).days, {});
});

test('clearDay limpa o dia', () => {
  const s = ready();
  const { id } = s.create({ name: 'a', color: 'red' });
  s.cycleDay(id, TODAY, TODAY);
  assert.equal(s.clearDay(id, TODAY, TODAY), 0);
  assert.deepEqual(s.get(id).days, {});
});

test('recusa dia futuro, data inválida e id desconhecido', () => {
  const s = ready();
  const { id } = s.create({ name: 'a', color: 'red' });
  assert.throws(() => s.cycleDay(id, '2026-11-07', TODAY), { code: 'FUTURE_DAY' });
  assert.throws(() => s.cycleDay(id, '2026-02-30', TODAY), { code: 'INVALID' });
  assert.throws(() => s.cycleDay('nope', TODAY, TODAY), { code: 'NOT_FOUND' });
});

test('dias antigos fora da grade continuam guardados', () => {
  const s = ready();
  const { id } = s.create({ name: 'a', color: 'red' });
  s.cycleDay(id, '2020-01-01', TODAY);
  s.cycleDay(id, TODAY, TODAY);
  assert.equal(s.get(id).days['2020-01-01'], 1);
});

for (const [label, content] of [
  ['JSON quebrado', '{oops'],
  ['arquivo vazio', ''],
  ['versão desconhecida', '{"version":2,"heatmaps":[]}'],
  ['nível inválido', JSON.stringify(withDay('2026-11-06', 9))],
  ['data inválida', JSON.stringify(withDay('2026-02-30', 1))],
  ['mês inicial inválido', JSON.stringify({ version: 1, heatmaps: [{ ...withDay('2026-11-06', 1).heatmaps[0], startMonth: '2026-13' }] })],
]) {
  test(`recupera de ${label} sem perder o original`, () => {
    writeFileSync(file, content);
    const s = createStore(file);
    const result = s.load();
    assert.equal(result.status, 'recovered');
    assert.match(basename(result.corruptPath), /^data\.corrupt-\d+\.json$/);
    assert.equal(readFileSync(result.corruptPath, 'utf8'), content);
    assert.deepEqual(s.list(), []);
  });
}

test('grava no disco antes de trocar o arquivo', (t) => {
  const s = ready();
  const write = t.mock.method(fs, 'writeFileSync');
  syncBuiltinESMExports();
  t.after(() => {
    write.mock.restore();
    syncBuiltinESMExports();
  });
  s.create({ name: 'a', color: 'red' });
  assert.equal(write.mock.calls.at(-1).arguments[2]?.flush, true);
});

test('falha ao gravar mantém o valor antigo', () => {
  const s = ready();
  const { id } = s.create({ name: 'a', color: 'red' });
  mkdirSync(`${file}.tmp`); // faz a gravação falhar
  assert.throws(() => s.cycleDay(id, TODAY, TODAY));
  assert.deepEqual(s.get(id).days, {});
  rmdirSync(`${file}.tmp`);
  assert.equal(s.cycleDay(id, TODAY, TODAY), 1);
});
