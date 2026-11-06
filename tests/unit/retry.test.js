import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retryUntilOk } from '../../src/main/retry.js';

test('tenta de novo até dar certo', async () => {
  const results = [{ ok: false }, { ok: false }, { ok: true }];
  let calls = 0;
  const result = await retryUntilOk(() => results[calls++], { times: 5, delayMs: 1 });
  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 3);
});

test('devolve a última falha quando as tentativas acabam', async () => {
  let calls = 0;
  const result = await retryUntilOk(() => { calls += 1; return { ok: false, error: 'x' }; }, { times: 3, delayMs: 1 });
  assert.deepEqual(result, { ok: false, error: 'x' });
  assert.equal(calls, 3);
});
