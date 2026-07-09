function parseMonthDayWithYear(value: string, year: number) {
  const text = value.trim();
  if (!text) return '';
  const match = text.match(/^(\d{1,2})[\/-]([A-Za-z]{3,9})$/) || text.match(/^([A-Za-z]{3,9})[\/-](\d{1,2})$/);
  if (!match) return '';
  const first = match[1];
  const second = match[2];
  const monthText = Number.isNaN(Number(first)) ? first : second;
  const dayText = Number.isNaN(Number(first)) ? second : first;
  const month = new Date(`${monthText} 1, ${year} 00:00:00 UTC`);
  const day = Number(dayText);
  if (Number.isNaN(month.getTime()) || !Number.isFinite(day)) return '';
  return new Date(Date.UTC(year, month.getUTCMonth(), day)).toISOString().slice(0, 10);
}

export function toDateInputValue(value: string | null | undefined, fallbackYear?: string | number | null) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString().slice(0, 10);
  const year = Number(String(fallbackYear ?? '').slice(0, 4));
  if (Number.isFinite(year) && year > 0) {
    const parsed = parseMonthDayWithYear(text, year);
    if (parsed) return parsed;
  }
  return '';
}

export function formatDateForPrint(value: string | null | undefined, fallbackYear?: string | number | null) {
  const input = toDateInputValue(value, fallbackYear);
  return input || String(value ?? '').trim() || ' ';
}

export function formatMoneyForPrint(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0 || Number.isNaN(value)) return ' ';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}
