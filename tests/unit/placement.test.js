import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePosition } from '../../src/main/placement.js';

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
