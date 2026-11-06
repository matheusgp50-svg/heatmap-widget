import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WIDGET_SIZE, resolvePosition, snapToGrid } from '../../src/main/placement.js';

const primary = { workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
const left = { workArea: { x: -1920, y: 0, width: 1920, height: 1080 } };

test('mantém posição visível no monitor principal', () => {
  assert.deepEqual(resolvePosition({ x: 100, y: 80 }, [primary], primary), { x: 100, y: 80 });
});

test('aceita coordenadas negativas de monitor à esquerda', () => {
  const pos = { x: -1500, y: 100 };
  assert.deepEqual(resolvePosition(pos, [primary, left], primary), pos);
});

test('traz para o principal quando o monitor sumiu', () => {
  assert.deepEqual(resolvePosition({ x: -1500, y: 100 }, [primary], primary), { x: 40, y: 40 });
});

test('widget sem posição recebe posição em cascata', () => {
  assert.deepEqual(resolvePosition(null, [primary], primary, 2), { x: 100, y: 100 });
});

test('quase todo fora da tela volta para o principal', () => {
  assert.deepEqual(resolvePosition({ x: 1915, y: 100 }, [primary], primary), { x: 40, y: 40 });
});

const grid = { x: 0, y: 0, spacingX: 76, spacingY: 100 };
const area = { x: 0, y: 0, width: 1920, height: 1032 };
const at = (x, y) => ({ x, y, ...WIDGET_SIZE });
const snap = (rect, extra = {}) => snapToGrid({ rect, grid, area, occupied: [], ...extra });

test('widget ocupa no máximo 5 por 2 posições de ícone', () => {
  assert.ok(WIDGET_SIZE.width <= 5 * 76);
  assert.ok(WIDGET_SIZE.height <= 2 * 100);
});

test('solta na posição mais próxima da grade', () => {
  assert.deepEqual(snap(at(1167, 18)), { x: 1140, y: 0 });
  assert.deepEqual(snap(at(1175, 205)), { x: 1140, y: 200 });
});

test('posição já na grade não muda', () => {
  assert.deepEqual(snap(at(228, 300)), { x: 228, y: 300 });
});

test('não deixa o widget sair da área de trabalho', () => {
  assert.deepEqual(snap(at(1800, 1000)), { x: 1520, y: 800 });
  assert.deepEqual(snap(at(-50, -50)), { x: 0, y: 0 });
});

test('respeita a origem da grade, que pode ser negativa', () => {
  const left = { x: -1920, y: 0, width: 1920, height: 1032 };
  const shifted = { ...grid, x: -1920 };
  assert.deepEqual(snap(at(-1500, 120), { grid: shifted, area: left }), { x: -1464, y: 100 });
});

test('pula posição ocupada por outro widget', () => {
  const occupied = [at(228, 100)];
  const { x, y } = snap(at(230, 110), { occupied });
  const overlaps = x < 228 + WIDGET_SIZE.width && 228 < x + WIDGET_SIZE.width
    && y < 100 + WIDGET_SIZE.height && 100 < y + WIDGET_SIZE.height;
  assert.equal(overlaps, false);
});

test('sem posição livre fica na mais próxima', () => {
  assert.deepEqual(snap(at(230, 110), { occupied: [{ ...area }] }), { x: 228, y: 100 });
});

test('área menor que o widget mantém a posição', () => {
  const tiny = { x: 0, y: 0, width: 100, height: 100 };
  assert.deepEqual(snap(at(30, 40), { area: tiny }), { x: 30, y: 40 });
});
