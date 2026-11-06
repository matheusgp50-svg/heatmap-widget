import { mkdirSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';

const SIZE = 256;
const CELLS = 4;
const STEP = SIZE / CELLS;
const GAP = 8;
const TONES = [[20, 83, 45], [21, 128, 61], [34, 197, 94], [134, 239, 172]];
const PATTERN = [1, 2, 0, 3, 3, 1, 2, 2, 0, 3, 1, 3, 2, 0, 3, 1];

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

const rows = [];
for (let y = 0; y < SIZE; y += 1) {
  const row = Buffer.alloc(1 + SIZE * 4);
  for (let x = 0; x < SIZE; x += 1) {
    const inside = x % STEP >= GAP / 2 && x % STEP < STEP - GAP / 2
      && y % STEP >= GAP / 2 && y % STEP < STEP - GAP / 2;
    const tone = TONES[PATTERN[Math.floor(y / STEP) * CELLS + Math.floor(x / STEP)]];
    Buffer.from([...tone, inside ? 255 : 0]).copy(row, 1 + x * 4);
  }
  rows.push(row);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header.set([8, 6, 0, 0, 0], 8);

mkdirSync('assets', { recursive: true });
writeFileSync('assets/icon.png', Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(Buffer.concat(rows))),
  chunk('IEND', Buffer.alloc(0)),
]));
