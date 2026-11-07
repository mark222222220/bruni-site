import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { demoSnapshot } from './demo';
import type { Snapshot, TableName, Tables } from './types';

export const TABLES: TableName[] = ['clients', 'orders', 'stock', 'payments', 'messages'];

export interface Backend {
  kind: 'local' | 'cloud';
  load(): Promise<Snapshot>;
  /** Вызывается при изменениях с других устройств. */
  subscribe(onTable: <K extends TableName>(table: K, rows: Tables[K][]) => void): () => void;
  upsert<K extends TableName>(table: K, row: Tables[K]): Promise<void>;
  patch<K extends TableName>(table: K, id: string, fields: Partial<Tables[K]>): Promise<void>;
  remove(table: TableName, id: string): Promise<void>;
  resetDemo?(): Promise<Snapshot>;
}

/* ---------- локальное хранилище: один телефон, демо-режим ---------- */
const LOCAL_KEY = 'avp.local-db.v1';

export function localBackend(): Backend {
  let db: Snapshot | null = null;
  const save = () => AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(db)).catch(() => {});
  const ensure = async () => {
    if (db) return db;
    try {
      const raw = await AsyncStorage.getItem(LOCAL_KEY);
      db = raw ? { ...demoSnapshot(), ...JSON.parse(raw) } : demoSnapshot();
    } catch {
      db = demoSnapshot();
    }
    if (!(await AsyncStorage.getItem(LOCAL_KEY).catch(() => null))) save();
    return db!;
  };
  return {
    kind: 'local',
    load: ensure,
    subscribe: () => () => {},
    async upsert(table, row) {
      const d = await ensure();
      const list = d[table] as { id: string }[];
      const i = list.findIndex((r) => r.id === (row as { id: string }).id);
      if (i >= 0) list[i] = row as { id: string };
      else list.push(row as { id: string });
      save();
    },
    async patch(table, id, fields) {
      const d = await ensure();
      const list = d[table] as { id: string }[];
      const i = list.findIndex((r) => r.id === id);
      if (i >= 0) list[i] = { ...list[i], ...fields };
      save();
    },
    async remove(table, id) {
      const d = await ensure();
      (d as Record<string, { id: string }[]>)[table] = (d[table] as { id: string }[]).filter((r) => r.id !== id);
      save();
    },
    async resetDemo() {
      db = demoSnapshot();
      await save();
      return db;
    },
  };
}

/* ---------- облачная база Supabase: вся команда, синхронно ---------- */
export function cloudBackend(url: string, key: string): Backend {
  const sb: SupabaseClient = createClient(url, key, {
    auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  const signIn = (async () => {
    const { data } = await sb.auth.getSession();
    if (!data.session) {
      const { error } = await sb.auth.signInAnonymously();
      if (error) throw error;
    }
  })();
  const fetchTable = async <K extends TableName>(t: K): Promise<Tables[K][]> => {
    await signIn;
    let q = sb.from(t).select('*');
    if (t === 'messages') q = q.order('at', { ascending: false }).limit(300);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Tables[K][];
  };
  return {
    kind: 'cloud',
    async load() {
      const rows = await Promise.all(TABLES.map((t) => fetchTable(t)));
      return Object.fromEntries(TABLES.map((t, i) => [t, rows[i]])) as Snapshot;
    },
    subscribe(onTable) {
      const timers: Partial<Record<TableName, ReturnType<typeof setTimeout>>> = {};
      const channel = sb.channel('avp-all');
      for (const t of TABLES) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => {
          // перечитываем таблицу целиком, пачкой раз в 300 мс — просто и надёжно для небольших таблиц
          clearTimeout(timers[t]);
          timers[t] = setTimeout(() => fetchTable(t).then((rows) => onTable(t, rows)).catch(() => {}), 300);
        });
      }
      signIn.then(() => channel.subscribe()).catch(() => {});
      return () => {
        sb.removeChannel(channel);
      };
    },
    async upsert(table, row) {
      await signIn;
      const { error } = await sb.from(table).upsert(row as never);
      if (error) throw error;
    },
    async patch(table, id, fields) {
      await signIn;
      const { error } = await sb.from(table).update(fields as never).eq('id', id);
      if (error) throw error;
    },
    async remove(table, id) {
      await signIn;
      const { error } = await sb.from(table).delete().eq('id', id);
      if (error) throw error;
    },
  };
}

export function makeBackend(): Backend {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? cloudBackend(url, key) : localBackend();
}
