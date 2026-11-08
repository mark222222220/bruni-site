// Снимок кладёт scripts/build-snapshot.mjs; в git его нет (данные завода).
// Пустой файл создаёт scripts/ensure-snapshot.mjs при npm install — тогда приложение в демо-режиме.
import raw from '../data/sheets.json';
import { useSyncExternalStore } from 'react';
import type { Client, Order, Payment, Snapshot, StockItem } from './types';

/** Снимок таблицы «Пульт руководителя — Гласс-Хаус Крым». Собирается каждую ночь (scripts/build-snapshot.mjs). */
export type Sheets = {
  generatedAt: string;
  source: string;
  main: {
    updatedText: string;
    money: { label: string; value: string; amount: number | null; detail: string };
    margin: { label: string; value: string; pct: number | null; detail: string };
    shipping: { label: string; value: string; detail: string };
    forecast: string;
    progress: string;
    weekly: { week: string; m2: number | null; rev: number | null; margin: number | null }[];
    warnings: string[];
    blocks: { title: string; tiles: { label: string; value: string; detail: string }[] }[];
  };
  kv: Record<string, { section: string; label: string; value: string; detail: string; updated: string }>;
  stock: {
    id: string;
    name: string;
    status: string;
    group: string;
    unit: string;
    qty: number;
    days: number | null;
    toOrder: number;
    orderSum: number;
    weekly: number;
    price: number | null;
    value: number;
    supplier: string;
    sort: number;
  }[];
  clients: {
    list: { name: string; rev6: number; share: number | null; margin6: number | null; byMonth: Record<string, number>; change: number | null; rubM2: number | null; signal: string }[];
    total: { rev6: number; margin6: number | null } | null;
    signals: string[];
  };
  payments: {
    head: { thisWeek: string; nextWeek: string; nextWeekNote: string; enough: string; updatedText: string };
    list: { date: string; dateText: string; title: string; amount: number | null; amountText: string; status: string; comment: string }[];
  };
  shipments: {
    head: string;
    overdueSummary: string;
    planned: { date: string; client: string; note: string; order: string; sp: number; m2: number; sum: number; status: string; production: string; deadline: string | null }[];
    overdue: { deadline: string; days: number; client: string; note: string; order: string; m2: number; sum: number; production: string; comment: string }[];
  };
  bank: { account: string; date: string; balance: number | null; inflow: number | null; outflow: number | null; read: string } | null;
};

const data = raw as unknown as Partial<Sheets>;
const fromFile: Sheets | null = data && data.generatedAt ? (data as Sheets) : null;

/* Текущий снимок: из файла (демо/предпросмотр) или из закрытой базы (рабочий режим). */
let current: Sheets | null = fromFile;
const listeners = new Set<() => void>();
export const getSheets = () => current;
export function setSheets(next: Sheets | null) {
  current = next;
  listeners.forEach((l) => l());
}
export function useSheets() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSheets,
    getSheets,
  );
}

/** Собирает снимок из строк таблицы factory_snapshot. Разделы, закрытые для роли, просто отсутствуют. */
export function sheetsFromRows(rows: { section: string; data: unknown; updated_at: string }[]): Sheets | null {
  if (!rows.length) return null;
  const by = Object.fromEntries(rows.map((r) => [r.section, r.data])) as Record<string, any>;
  const meta = by.meta ?? {};
  return {
    generatedAt: meta.generatedAt ?? rows[0].updated_at,
    source: meta.source ?? '',
    main: by.main ?? { updatedText: '', money: { label: '', value: '', amount: null, detail: '' }, margin: { label: '', value: '', pct: null, detail: '' }, shipping: { label: '', value: '', detail: '' }, forecast: '', progress: '', weekly: [], warnings: [], blocks: [] },
    kv: by.kv ?? {},
    stock: by.stock ?? [],
    clients: by.clients ?? { list: [], total: null, signals: [] },
    payments: by.payments ?? { head: { thisWeek: '', nextWeek: '', nextWeekNote: '', enough: '', updatedText: '' }, list: [] },
    shipments: by.shipments ?? { head: '', overdueSummary: '', planned: [], overdue: [] },
    bank: by.bank ?? null,
  };
}

/** Таблицы приложения, собранные из снимка. Чат в таблицах не хранится. */
export function tablesFromSheets(s: Sheets): Omit<Snapshot, 'messages'> {
  const clients: Client[] = s.clients.list.map((c, i) => {
    const months = Object.values(c.byMonth);
    return {
      id: 'sc' + i,
      name: c.name,
      kind: c.signal ? `⚠ ${c.signal}` : 'Клиент',
      city: '',
      rev: c.rev6 / 1e6,
      mat: c.margin6 ?? 0,
      work: c.margin6 ?? 0,
      rubM2: c.rubM2,
      signal: c.signal,
      byMonth: c.byMonth,
      fromSheet: true,
      ...(months.length ? {} : {}),
    };
  });
  const stage = (production: string): Order['status'] => (/запущ/i.test(production) ? 'build' : /готов/i.test(production) ? 'ready' : 'new');
  const orders: Order[] = [
    ...s.shipments.planned.map((o, i) => ({ id: 'sp' + o.order + '-' + i, no: Number(o.order) || i, client: o.client, formula: o.note || 'без примечания', qty: o.sp, sp: o.sp, area: o.m2, sum: o.sum, ship: o.date, status: stage(o.production), production: o.production, fromSheet: true })),
    ...s.shipments.overdue.map((o, i) => ({ id: 'so' + o.order + '-' + i, no: Number(o.order) || i, client: o.client, formula: o.note || o.comment || 'без примечания', qty: 0, area: o.m2, sum: o.sum, ship: o.deadline, status: stage(o.production), production: o.production, note: o.comment, fromSheet: true })),
  ];
  const stock: StockItem[] = s.stock.map((x) => ({
    id: x.id,
    name: x.name,
    unit: x.unit,
    qty: x.qty,
    min: x.weekly,
    pack: 1,
    sort: x.sort,
    status: x.status,
    days: x.days,
    toOrder: x.toOrder,
    weekly: x.weekly,
    value: x.value,
    supplier: x.supplier,
    group: x.group,
    fromSheet: true,
  }));
  const payments: Payment[] = s.payments.list.map((p, i) => ({
    id: 'pp' + i,
    title: p.title,
    amount: p.amount ?? 0,
    amountText: p.amount == null ? p.amountText : undefined,
    date: p.date,
    paid: /оплач/i.test(p.status),
    status: p.status,
    comment: p.comment,
    fromSheet: true,
  }));
  return { clients, orders, stock, payments };
}

/** «2026-11-08T21:00:00Z» → «09.11 в 00:00» */
export function updatedLabel(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} в ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}
