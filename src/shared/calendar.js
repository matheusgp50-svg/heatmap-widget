export const MAX_LEVEL = 4;

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const pad = (value) => String(value).padStart(2, '0');

export function nextLevel(level) {
  return (level + 1) % (MAX_LEVEL + 1);
}

export function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return toDateKey(new Date(year, month - 1, day)) === value;
}

export function buildGrid(today, weekCount = 53) {
  const todayKey = toDateKey(today);
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = today.getDate() - today.getDay() - (weekCount - 1) * 7;
  const weeks = [];
  const months = [];

  for (let week = 0; week < weekCount; week += 1) {
    const days = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      // Somar dias ao calendário, e não milissegundos, mantém o horário de verão correto.
      const date = new Date(year, month, firstDay + week * 7 + weekday);
      const key = toDateKey(date);
      days.push({ key, isToday: key === todayKey, isFuture: key > todayKey });
      if (date.getDate() === 1) months.push({ label: MONTHS[date.getMonth()], weekIndex: week });
    }
    weeks.push(days);
  }
  return { weeks, months };
}

export function formatDayLabel(key, level) {
  const [year, month, day] = key.split('-');
  return `${day}/${month}/${year} · ${level > 0 ? `nível ${level}` : 'sem registro'}`;
}

export function watchDayChange(onChange, now = () => new Date(), intervalMs = 60000) {
  let current = toDateKey(now());
  const timer = setInterval(() => {
    const key = toDateKey(now());
    if (key !== current) {
      current = key;
      onChange(key);
    }
  }, intervalMs);
  return () => clearInterval(timer);
}
