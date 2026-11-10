import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { makeBackend, type Backend } from './backend';
import { BALANCE } from './demo';
import { addDays, dm, fmt, money, today, tomorrow, uid } from './format';
import { getSheets, setSheets, tablesFromSheets, useSheets } from './sheets';
import { notifyTeamAboutMessage } from './notifications';
import { supabase } from './supabase';
import { useSettings } from './settings';
import { STATUSES, type Snapshot, type TableName, type Tables } from './types';

type State = { snap: Snapshot; loading: boolean; error: string | null };
const EMPTY: Snapshot = { clients: [], orders: [], stock: [], payments: [], messages: [] };

type Ctx = State & {
  kind: Backend['kind'];
  upsert: <K extends TableName>(table: K, row: Tables[K]) => Promise<boolean>;
  patch: <K extends TableName>(table: K, id: string, fields: Partial<Tables[K]>) => Promise<boolean>;
  remove: (table: TableName, id: string) => Promise<boolean>;
  send: (channel: string, text: string, quote?: string | null) => Promise<boolean>;
  resetDemo: () => Promise<void>;
  reload: () => Promise<void>;
};
const DataCtx = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const backend = useRef<Backend>(makeBackend()).current;
  const { s } = useSettings();
  const [st, setSt] = useState<State>({ snap: EMPTY, loading: true, error: null });

  const reload = useCallback(async () => {
    try {
      const snap = await backend.load();
      if (backend.loadSheets) setSheets(await backend.loadSheets());
      // цифры завода — из снимка таблицы отца; чат остаётся своим
      const sh = getSheets();
      const merged = sh ? { ...snap, ...tablesFromSheets(sh) } : snap;
      setSt({ snap: { ...merged }, loading: false, error: null });
    } catch (e) {
      setSt((p) => ({ ...p, loading: false, error: e instanceof Error ? e.message : 'Нет связи с базой' }));
    }
  }, [backend]);

  useEffect(() => {
    reload();
    return backend.subscribe((table, rows) => {
      if (table === 'sheets') {
        const sh = getSheets();
        if (sh) setSt((p) => ({ ...p, snap: { ...p.snap, ...tablesFromSheets(sh) } }));
        return;
      }
      setSt((p) => ({ ...p, snap: { ...p.snap, [table]: rows } }));
    });
  }, [backend, reload]);

  /** Сначала меняем экран, потом пишем в базу; при ошибке перечитываем данные. */
  const run = useCallback(
    async (local: (snap: Snapshot) => Snapshot, remote: () => Promise<void>) => {
      setSt((p) => ({ ...p, snap: local(p.snap) }));
      try {
        await remote();
        return true;
      } catch (e) {
        setSt((p) => ({ ...p, error: e instanceof Error ? e.message : 'Не сохранилось' }));
        reload();
        return false;
      }
    },
    [reload],
  );

  const upsert = useCallback(
    <K extends TableName>(table: K, row: Tables[K]) =>
      run(
        (snap) => {
          const list = snap[table] as { id: string }[];
          const has = list.some((r) => r.id === (row as { id: string }).id);
          return { ...snap, [table]: has ? list.map((r) => (r.id === (row as { id: string }).id ? row : r)) : [...list, row] };
        },
        () => backend.upsert(table, row),
      ),
    [backend, run],
  );
  const patch = useCallback(
    <K extends TableName>(table: K, id: string, fields: Partial<Tables[K]>) =>
      run(
        (snap) => ({ ...snap, [table]: (snap[table] as { id: string }[]).map((r) => (r.id === id ? { ...r, ...fields } : r)) }),
        () => backend.patch(table, id, fields),
      ),
    [backend, run],
  );
  const remove = useCallback(
    (table: TableName, id: string) =>
      run((snap) => ({ ...snap, [table]: (snap[table] as { id: string }[]).filter((r) => r.id !== id) }), () => backend.remove(table, id)),
    [backend, run],
  );
  const send = useCallback(
    async (channel: string, text: string, quote?: string | null) => {
      const ok = await upsert('messages', { id: uid(), channel, author: s.name || 'Сотрудник', role: s.role, text: text.trim(), quote: quote ?? null, at: Date.now() });
      // коллегам — уведомление на телефон
      if (ok && backend.kind === 'cloud' && supabase) {
        supabase.auth.getUser().then(({ data }) => data.user && notifyTeamAboutMessage(data.user.id, s.name || 'Сотрудник', channel, text.trim()));
      }
      return ok;
    },
    [upsert, s.name, s.role, backend.kind],
  );
  const resetDemo = useCallback(async () => {
    if (backend.resetDemo) setSt({ snap: await backend.resetDemo(), loading: false, error: null });
  }, [backend]);

  const value = useMemo(() => ({ ...st, kind: backend.kind, upsert, patch, remove, send, resetDemo, reload }), [st, backend.kind, upsert, patch, remove, send, resetDemo, reload]);
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export function useData() {
  const c = useContext(DataCtx);
  if (!c) throw new Error('useData outside DataProvider');
  return c;
}

/* ---------- производные цифры и сигналы ---------- */
export const statusIndex = (s: string) => Math.max(0, STATUSES.findIndex((x) => x.id === s));
export const statusName = (s: string) => STATUSES[statusIndex(s)].name;
export const needToOrder = (s: { qty: number; min: number; pack: number; toOrder?: number; status?: string }) =>
  s.status !== undefined ? s.toOrder ?? 0 : Math.max(s.pack, Math.ceil((s.min * 2 - s.qty) / s.pack) * s.pack);
export const isLow = (x: { qty: number; min: number; status?: string }) => (x.status !== undefined ? x.status === 'Мало' : x.qty <= x.min);

export type Signal = { id: string; level: 'bad' | 'warn'; title: string; detail: string; channel: string };

export function useDerived() {
  const { snap } = useData();
  const { s } = useSettings();
  const SHEETS = useSheets();
  return useMemo(() => {
    const T = today();
    const active = snap.orders.filter((o) => o.status !== 'shipped');
    const overdue = active.filter((o) => o.ship && o.ship < T);
    const low = snap.stock.filter(isLow).sort((a, b) => a.sort - b.sort);
    const unpaid = snap.payments.filter((p) => !p.paid);
    // к оплате — как у отца: просроченные и всё на 2 недели вперёд
    const horizon = addDays(14);
    const due = unpaid.filter((p) => !SHEETS || p.date <= horizon).reduce((a, p) => a + (Number(p.amount) || 0), 0);
    const revTotal = snap.clients.reduce((a, c) => a + c.rev, 0);
    const avgMargin = revTotal ? snap.clients.reduce((a, c) => a + c.rev * c.work, 0) / revTotal : 0;
    const shipTomorrow = active.filter((o) => o.ship === tomorrow());
    const signals: Signal[] = [
      ...(SHEETS ? [] : overdue).map((o) => ({ id: 'o' + o.id, level: 'bad' as const, title: `Заказ №${o.no} просрочен — ${o.client}`, detail: `отгрузка была ${dm(o.ship)}, сейчас: ${statusName(o.status).toLowerCase()}`, channel: 'orders' })),
      ...low.map((x) =>
        x.status !== undefined
          ? { id: 's' + x.id, level: (x.days ?? 0) < 2 ? ('bad' as const) : ('warn' as const), title: `${x.name}: ${fmt(x.qty, 1)} ${x.unit}`, detail: `хватит на ${fmt(x.days ?? 0, 1)} дн. · расход ${fmt(x.weekly ?? 0)} ${x.unit} в неделю`, channel: 'stock' }
          : { id: 's' + x.id, level: x.qty > x.min * 0.5 ? ('warn' as const) : ('bad' as const), title: `${x.name}: осталось ${fmt(x.qty)} ${x.unit}`, detail: `минимум ${fmt(x.min)} — в заявке ${fmt(needToOrder(x))} ${x.unit}`, channel: 'stock' },
      ),
      ...(SHEETS ? SHEETS.main.warnings.map((w, i) => ({ id: 'w' + i, level: (/просроч|не виден|остаток/.test(w) ? 'bad' : 'warn') as 'bad' | 'warn', title: w.split(':')[0], detail: w.includes(':') ? w.slice(w.indexOf(':') + 1).trim() : '', channel: /банк|платёж|платеж/.test(w) ? 'money' : /приход|склад/.test(w) ? 'stock' : 'orders' })) : []),
      ...snap.clients
        .filter((c) => c.signal)
        .map((c) => ({ id: 'cs' + c.id, level: 'warn' as const, title: `${c.name}: ${c.signal}`, detail: Object.entries(c.byMonth ?? {}).map(([m, v]) => `${m} ${fmt(v, 1)}%`).join(' → '), channel: 'orders' })),
      ...snap.clients
        .filter((c) => c.work < s.thr)
        .sort((a, b) => a.work - b.work)
        .map((c) => ({ id: 'c' + c.id, level: 'bad' as const, title: `Маржа ${fmt(c.work)}% у клиента ${c.name}`, detail: `ниже порога ${s.thr}% — пересмотреть цену`, channel: 'orders' })),
      ...((SHEETS?.bank?.balance ?? BALANCE) < due ? [{ id: 'cash', level: 'bad' as const, title: `Не хватает на платежи: ${money(due - (SHEETS?.bank?.balance ?? BALANCE))} ₽`, detail: 'перенесите платёж или ускорьте оплату от клиентов', channel: 'money' }] : []),
    ];
    return { active, overdue, low, unpaid, due, avgMargin, revTotal, shipTomorrow, signals, balance: SHEETS?.bank?.balance ?? SHEETS?.main.money.amount ?? BALANCE };
  }, [snap, s.thr, SHEETS]);
}
