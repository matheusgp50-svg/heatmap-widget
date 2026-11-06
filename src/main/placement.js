export const WIDGET_SIZE = { width: 740, height: 170 };

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
