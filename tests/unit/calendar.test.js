process.env.TZ = 'America/New_York';

const { test } = await import('node:test');
const { default: assert } = await import('node:assert/strict');
const { nextLevel, toDateKey, toMonthKey, isDateKey, isMonthKey, firstVisibleMonth, buildGrid, formatDayLabel, watchDayChange } = await import('../../src/shared/calendar.js');
const { COLORS, PALETTES } = await import('../../src/shared/palettes.js');

test('nextLevel cicla de 0 a 4 e volta a 0', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((level) => nextLevel(level)), [1, 2, 3, 4, 0]);
});

test('toDateKey usa o fuso local', () => {
  assert.equal(toDateKey(new Date(2026, 10, 6, 23, 30)), '2026-11-06');
});

test('isDateKey recusa formato errado e data inexistente', () => {
  assert.equal(isDateKey('2026-11-06'), true);
  assert.equal(isDateKey('2028-02-29'), true);
  assert.equal(isDateKey('2026-02-29'), false);
  assert.equal(isDateKey('2026-13-01'), false);
  assert.equal(isDateKey('06/11/2026'), false);
  assert.equal(isDateKey(20261106), false);
});

test('toMonthKey usa o fuso local', () => {
  assert.equal(toMonthKey(new Date(2026, 10, 30, 23, 30)), '2026-11');
});

test('isMonthKey recusa formato errado e mês inexistente', () => {
  assert.equal(isMonthKey('2026-11'), true);
  for (const value of ['2026-13', '2026-00', '2026-1', 202611, null]) {
    assert.equal(isMonthKey(value), false);
  }
});

test('primeiro mês fica parado até o quinto mês e depois anda um por mês', () => {
  const first = (year, month) => firstVisibleMonth(new Date(year, month, 15), '2026-11');
  assert.equal(first(2026, 10), '2026-11');
  assert.equal(first(2027, 2), '2026-11'); // março
  assert.equal(first(2027, 3), '2026-12'); // abril: novembro some
  assert.equal(first(2027, 4), '2027-01'); // maio: dezembro some
  assert.equal(first(2028, 0), '2027-09'); // virada de ano
});

test('mês inicial no futuro não esconde o mês atual', () => {
  assert.equal(firstVisibleMonth(new Date(2026, 10, 6), '2027-02'), '2026-11');
});

test('grade cobre seis meses em colunas de sete dias', () => {
  const { weeks } = buildGrid(new Date(2026, 10, 6), '2026-11');
  assert.equal(weeks.length, 26);
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(weeks[0][0].key, '2026-11-01');
  assert.equal(weeks[25][5].key, '2027-04-30');
});

test('dias fora dos seis meses são marcados', () => {
  const { weeks } = buildGrid(new Date(2027, 3, 10), '2026-11'); // abril: começa em dezembro
  assert.deepEqual(
    weeks[0].slice(0, 3).map((d) => [d.key, d.isOutside]),
    [['2026-11-29', true], ['2026-11-30', true], ['2026-12-01', false]],
  );
  const last = weeks.flat().filter((d) => !d.isOutside).at(-1);
  assert.equal(last.key, '2027-05-31');
  assert.equal(buildGrid(new Date(2026, 10, 6), '2026-11').weeks[25][6].isOutside, true);
});

test('marca hoje e dias futuros', () => {
  const days = buildGrid(new Date(2026, 10, 6), '2026-11').weeks.flat();
  const today = days.find((d) => d.key === '2026-11-06');
  assert.equal(today.isToday, true);
  assert.equal(today.isFuture, false);
  assert.equal(days.find((d) => d.key === '2026-11-07').isFuture, true);
});

test('dias são consecutivos atravessando horário de verão', () => {
  const keys = buildGrid(new Date(2026, 3, 15), '2026-01').weeks.flat().map((d) => d.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.includes('2026-03-08'));
});

test('ano bissexto e virada de ano', () => {
  const leap = buildGrid(new Date(2028, 2, 1), '2028-01').weeks.flat().map((d) => d.key);
  assert.ok(leap.includes('2028-02-29'));
  const turn = buildGrid(new Date(2027, 0, 1), '2026-11').weeks.flat().map((d) => d.key);
  assert.ok(turn.includes('2026-12-31') && turn.includes('2027-01-01'));
});

test('rótulo do mês fica na coluna que contém o dia 1', () => {
  const { months } = buildGrid(new Date(2026, 10, 6), '2026-11');
  assert.deepEqual(months, [
    { label: 'nov', weekIndex: 0 },
    { label: 'dez', weekIndex: 4 },
    { label: 'jan', weekIndex: 8 },
    { label: 'fev', weekIndex: 13 },
    { label: 'mar', weekIndex: 17 },
    { label: 'abr', weekIndex: 21 },
  ]);
});

test('nenhuma janela de seis meses passa de 28 colunas', () => {
  for (let year = 2026; year < 2040; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      const startMonth = toMonthKey(new Date(year, month, 1));
      const { weeks } = buildGrid(new Date(year, month, 1), startMonth);
      assert.ok(weeks.length <= 28, startMonth);
    }
  }
});

test('formatDayLabel mostra data e nível', () => {
  assert.equal(formatDayLabel('2026-11-06', 3), '06/11/2026 · nível 3');
  assert.equal(formatDayLabel('2026-11-06', 0), '06/11/2026 · sem registro');
});

test('watchDayChange avisa uma vez ao mudar o dia, mesmo depois de suspensão', (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  let current = new Date(2026, 10, 6, 23, 59);
  const calls = [];
  const stop = watchDayChange((key) => calls.push(key), () => current);
  t.mock.timers.tick(60000);
  assert.deepEqual(calls, []);
  current = new Date(2026, 10, 9, 8, 0); // acordou três dias depois
  t.mock.timers.tick(60000);
  t.mock.timers.tick(60000);
  assert.deepEqual(calls, ['2026-11-09']);
  stop();
});

test('paletas têm quatro tons para cada cor', () => {
  assert.deepEqual(COLORS, ['green', 'blue', 'purple', 'orange', 'red', 'teal']);
  assert.ok(COLORS.every((c) => PALETTES[c].length === 4));
});
