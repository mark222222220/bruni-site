// Собирает src/data/sheets.json из выгрузки листов таблицы «Пульт руководителя — Гласс-Хаус Крым».
// Вход: sync/raw/*.json — ответы Google Sheets values.get ({ range, values }).
// Запуск: node scripts/build-snapshot.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = (name) => {
  const p = join(root, 'sync/raw', name + '.json');
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, 'utf8')).values ?? [];
};
const cell = (rows, r, c) => String(rows[r]?.[c] ?? '').trim();
const clean = (s) => String(s ?? '').replace(/[  \s]/g, '');
/** «1 760 000», «5,67», «37,7%» → число; пусто/текст → null */
const num = (s) => {
  const v = parseFloat(clean(s).replace(/[₽%]|м²|м2/g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};
/** «5,67 млн ₽», «217 тыс. ₽», «908 149 ₽» → рубли */
const rub = (s) => {
  const t = String(s ?? '');
  const n = num(t.replace(/млн|тыс\.?|₽/g, ''));
  if (n == null) return null;
  return /млн/.test(t) ? n * 1e6 : /тыс/.test(t) ? n * 1e3 : n;
};
const now = new Date();
/** «09.11», «9.11.2026», «05.11–08.11» → YYYY-MM-DD */
const day = (s) => {
  const m = String(s ?? '').match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/);
  if (!m) return null;
  let y = m[3] ? Number(m[3]) : now.getFullYear();
  const d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1])));
  if (!m[3] && d.getTime() - now.getTime() > 200 * 864e5) y -= 1;
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
};
const slug = (s, i) =>
  'x' + i + '-' + String(s).toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').slice(0, 40);

/* ---------- «Главный» ---------- */
const M = raw('main');
const weekly = [];
for (let r = 1; r < M.length; r++) {
  const w = cell(M, r, 26);
  if (/^\d{1,2}\.\d{2}$/.test(w)) weekly.push({ week: w, m2: num(cell(M, r, 27)), rev: num(cell(M, r, 28)), margin: num(cell(M, r, 29)) });
}
const warnings = [];
for (const row of M) for (const c of row ?? []) if (String(c).includes('⚠')) String(c).split('\n').forEach((l) => l.trim().startsWith('⚠') && warnings.push(l.replace(/^⚠\s*/, '').trim()));
const blocks = [];
for (let r = 0; r < M.length; r++) {
  const title = cell(M, r, 0);
  if ((M[r] ?? []).filter(Boolean).length === 1 && ['Продажи', 'Производство и склад', 'Деньги и итоги'].includes(title)) {
    const tiles = [];
    for (const c of [0, 3, 6, 9]) if (cell(M, r + 1, c)) tiles.push({ label: cell(M, r + 1, c), value: cell(M, r + 2, c), detail: cell(M, r + 3, c) });
    blocks.push({ title, tiles });
  }
}
const main = {
  updatedText: cell(M, 0, 8),
  money: { label: cell(M, 2, 0), value: cell(M, 3, 0), amount: rub(cell(M, 3, 0)), detail: cell(M, 4, 0) },
  margin: { label: cell(M, 2, 4), value: cell(M, 3, 4), pct: num(cell(M, 3, 4)), detail: cell(M, 4, 4) },
  shipping: { label: cell(M, 2, 8), value: cell(M, 3, 8), detail: cell(M, 4, 8) },
  forecast: cell(M, 6, 0),
  progress: cell(M, 8, 0).replace(/\s+/g, ' '),
  weekly,
  warnings,
  blocks,
};

/* ---------- «Для приложения» ---------- */
const A = raw('app');
const kv = {};
for (const r of A.slice(1)) if (r[0]) kv[r[0]] = { section: r[2] ?? '', label: r[3] ?? '', value: r[4] ?? '', detail: r[5] ?? '', updated: r[6] ?? '' };

/* ---------- «Склад для приложения» ---------- */
const S = raw('stock');
const stock = S.slice(1)
  .filter((r) => r[0])
  .map((r, i) => ({
    id: slug(r[0], i),
    name: r[0],
    status: r[1] ?? '',
    group: r[2] ?? '',
    unit: r[3] ?? '',
    qty: num(r[4]) ?? 0,
    days: num(r[5]),
    toOrder: num(r[6]) ?? 0,
    packs: num(r[7]),
    orderSum: num(r[8]) ?? 0,
    weekly: num(r[9]) ?? 0,
    price: num(r[10]),
    value: num(r[11]) ?? 0,
    supplier: r[12] ?? '',
    sort: num(r[13]) ?? i,
    updated: r[14] ?? '',
  }));

/* ---------- «Клиенты по месяцам» ---------- */
const C = raw('clients');
const hdr = C.findIndex((r) => r[0] === 'Клиент' && String(r[1] ?? '').includes('Выручка'));
const clients = [];
let clientsTotal = null;
if (hdr >= 0) {
  const months = C[hdr].slice(4, 10);
  for (let r = hdr + 1; r < C.length && C[r]?.[0]; r++) {
    const row = C[r];
    const item = {
      name: row[0],
      rev6: num(row[1]) ?? 0,
      share: num(row[2]),
      margin6: num(row[3]),
      byMonth: Object.fromEntries(months.map((m, k) => [m, num(row[4 + k])]).filter(([, v]) => v != null)),
      change: num(row[10]),
      rubM2: num(row[11]),
      signal: row[12] ?? '',
    };
    if (row[0] === 'ИТОГО') {
      clientsTotal = item;
      break;
    }
    clients.push(item);
  }
}
const clientSignals = C.flat().filter((c) => String(c).startsWith('⚠')).map((c) => String(c).replace(/^⚠\s*/, ''));

/* ---------- «Платёжный календарь» ---------- */
const P = raw('payments');
const payments = [];
for (const r of P) {
  if (!r?.[2] || r[0] === 'Дата' || !day(r[0])) continue;
  payments.push({ date: day(r[0]), dateText: r[0], title: r[2], amount: rub(r[3]), amountText: r[3] ?? '', status: r[4] ?? '', comment: r[5] ?? '' });
}
const payHead = { thisWeek: cell(P, 4, 0), nextWeek: cell(P, 4, 3), nextWeekNote: cell(P, 5, 3), enough: cell(P, 5, 5), updatedText: cell(P, 1, 0) };

/* ---------- «Отгрузки» ---------- */
const O = raw('shipments');
const planned = [];
const overdue = [];
let mode = null;
let overdueSummary = '';
for (const r of O) {
  const a = String(r?.[0] ?? '');
  if (a.startsWith('Просрочено')) {
    mode = 'overdue-title';
    overdueSummary = a;
    continue;
  }
  if (a === 'Дата' && r[1] === 'Заказчик') {
    mode = 'plan';
    continue;
  }
  if (a === 'Срок' && r[1] === 'Дней') {
    mode = 'overdue';
    continue;
  }
  if (!a) continue;
  if (mode === 'plan' && day(a)) planned.push({ date: day(a), client: r[1] ?? '', note: String(r[2] ?? '').replace(/\s+/g, ' ').trim(), order: r[3] ?? '', sp: num(r[4]) ?? 0, m2: num(r[5]) ?? 0, sum: num(r[6]) ?? 0, status: r[7] ?? '', production: r[8] ?? '', deadline: day(r[9]) });
  if (mode === 'overdue' && day(a)) overdue.push({ deadline: day(a), days: num(r[1]) ?? 0, client: r[2] ?? '', note: String(r[3] ?? '').trim(), order: r[4] ?? '', m2: num(r[5]) ?? 0, sum: num(r[6]) ?? 0, production: r[7] ?? '', comment: r[8] ?? '' });
}
const shipHead = cell(O, 3, 0);

/* ---------- «Банк — остатки» ---------- */
const B = raw('bank').slice(1).filter((r) => r[0] && num(r[4]) != null);
const lastBank = B[B.length - 1];
const bank = lastBank ? { account: lastBank[0], date: lastBank[2], balance: num(lastBank[4]), inflow: num(lastBank[5]), outflow: num(lastBank[6]), read: lastBank[9] ?? '' } : null;

const snapshot = {
  generatedAt: now.toISOString(),
  source: 'Пульт руководителя — Гласс-Хаус Крым',
  main,
  kv,
  stock,
  clients: { list: clients, total: clientsTotal, signals: clientSignals },
  payments: { head: payHead, list: payments },
  shipments: { head: shipHead, planned, overdue, overdueSummary },
  bank,
};
const out = join(root, 'src/data/sheets.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(snapshot, null, 1) + '\n');
console.log(
  `sheets.json: склад ${stock.length}, клиенты ${clients.length}, платежи ${payments.length}, отгрузки ${planned.length} + просрочено ${overdue.length}, недель ${weekly.length}, предупреждений ${warnings.length}, банк ${bank?.balance ?? '—'}`,
);
