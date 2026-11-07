const nf = (d: number) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmt = (n: number, d = 0) => nf(d).format(Number.isFinite(n) ? n : 0);

/** 1 900 000 → «1,9 млн», 180 000 → «180 тыс.» */
export const money = (n: number) => (Math.abs(n) >= 1e6 ? `${fmt(n / 1e6, 1)} млн` : `${fmt(Math.round(n / 1e3))} тыс.`);

export const isoDay = (t: number | Date) => {
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
export const today = () => isoDay(Date.now());
export const tomorrow = () => isoDay(Date.now() + 864e5);
export const addDays = (n: number) => isoDay(Date.now() + n * 864e5);

/** «2026-11-08» → «08.11» */
export const dm = (s?: string) => (s && s.length >= 10 ? `${s.slice(8, 10)}.${s.slice(5, 7)}` : '—');

export const parseNum = (v: string) => parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));

export const isValidDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

/** Ввод даты как «08.11» или «08.11.2026» → YYYY-MM-DD */
export const parseDm = (s: string): string | null => {
  const m = s.trim().match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
  if (!m) return isValidDay(s.trim()) ? s.trim() : null;
  const now = new Date();
  let y = m[3] ? Number(m[3]) : now.getFullYear();
  if (y < 100) y += 2000;
  const out = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return isValidDay(out) ? out : null;
};

export const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
};

export const shortDate = () => new Date().toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
