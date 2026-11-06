export const WIDGET_SIZE = { width: 380, height: 160 };

const TITLE_STRIP = { width: 100, height: 30 };
const MARGIN = 40;
const CASCADE = 30;

function titleIsInside({ x, y }, { workArea: area }) {
  return x >= area.x
    && y >= area.y
    && x + TITLE_STRIP.width <= area.x + area.width
    && y + TITLE_STRIP.height <= area.y + area.height;
}

export function resolvePosition(position, displays, primary, index = 0) {
  if (position && displays.some((display) => titleIsInside(position, display))) return position;
  const offset = MARGIN + (position ? 0 : CASCADE * index);
  return { x: primary.workArea.x + offset, y: primary.workArea.y + offset };
}

function slots(start, length, size, origin, spacing) {
  const first = Math.ceil((start - origin) / spacing);
  const last = Math.floor((start + length - size - origin) / spacing);
  const found = [];
  for (let index = first; index <= last; index += 1) found.push(origin + index * spacing);
  return found;
}

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

// Como uma pasta: a posição livre mais próxima, sem sair da área de trabalho.
export function snapToGrid({ rect, grid, area, occupied }) {
  const distance = ({ x, y }) => (x - rect.x) ** 2 + (y - rect.y) ** 2;
  const columns = slots(area.x, area.width, rect.width, grid.x, grid.spacingX);
  const rows = slots(area.y, area.height, rect.height, grid.y, grid.spacingY);
  const nearest = columns
    .flatMap((x) => rows.map((y) => ({ x, y })))
    .sort((a, b) => distance(a) - distance(b));
  const free = nearest.find((slot) => !occupied.some((other) => overlaps({ ...rect, ...slot }, other)));
  return free ?? nearest[0] ?? { x: rect.x, y: rect.y };
}
