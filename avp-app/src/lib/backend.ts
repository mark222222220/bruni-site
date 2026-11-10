import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { demoSnapshot } from './demo';
import { setSheets, sheetsFromRows, type Sheets } from './sheets';
import { supabase } from './supabase';
import type { Message, Snapshot, TableName, Tables } from './types';

export const TABLES: TableName[] = ['clients', 'orders', 'stock', 'payments', 'messages'];

export interface Backend {
  kind: 'local' | 'cloud';
  load(): Promise<Snapshot>;
  /** Вызывается при изменениях с других устройств. */
  /** Снимок таблицы завода (только облако). */
  loadSheets?(): Promise<Sheets | null>;
  /** Вызывается при изменениях с других устройств; 'sheets' — обновился снимок таблицы. */
  subscribe(onTable: <K extends TableName | 'sheets'>(table: K, rows: K extends TableName ? Tables[K][] : never[]) => void): () => void;
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

/* ---------- закрытая база Supabase: вся команда ---------- */
export function cloudBackend(sb: SupabaseClient): Backend {
  const fetchMessages = async (): Promise<Message[]> => {
    const { data, error } = await sb.from('messages').select('*').order('at', { ascending: false }).limit(300);
    if (error) throw error;
    return ((data ?? []) as (Message & { user_id?: string; edited_at?: number | null })[]).map((m) => ({
      id: m.id,
      channel: m.channel,
      author: m.author,
      role: m.role,
      text: m.text,
      quote: m.quote,
      at: Number(m.at),
      userId: m.user_id,
      editedAt: m.edited_at ? Number(m.edited_at) : null,
    }));
  };
  const fetchSheets = async () => {
    const { data, error } = await sb.from('factory_snapshot').select('section,data,updated_at');
    if (error) throw error;
    return sheetsFromRows((data ?? []) as { section: string; data: unknown; updated_at: string }[]);
  };
  return {
    kind: 'cloud',
    async load() {
      return { clients: [], orders: [], stock: [], payments: [], messages: await fetchMessages() };
    },
    loadSheets: fetchSheets,
    subscribe(onTable) {
      let last = '';
      const pushMessages = (rows: Message[]) => {
        const key = rows.length + ':' + (rows[0]?.id ?? '');
        if (key === last) return;
        last = key;
        onTable('messages', rows);
      };
      const refresh = () => fetchMessages().then(pushMessages).catch(() => {});
      const ch = sb
        .channel('avp-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'factory_snapshot' }, () => {
          fetchSheets()
            .then((sh) => {
              setSheets(sh);
              onTable('sheets', []);
            })
            .catch(() => {});
        });
      // токен вошедшего пользователя передаём до подписки, иначе права в базе не пустят канал
      sb.auth.getSession().then(({ data }) => {
        if (data.session) sb.realtime.setAuth(data.session.access_token);
        ch.subscribe();
      });
      // подстраховка: проверяем новые сообщения раз в 4 секунды и при возврате в приложение
      const timer = setInterval(refresh, 4000);
      const app = AppState.addEventListener('change', (st) => st === 'active' && refresh());
      return () => {
        clearInterval(timer);
        app.remove();
        sb.removeChannel(ch);
      };
    },
    // В базу пишем только сообщения; цифры завода приходят из таблицы, отметки на телефоне локальные.
    async upsert(table, row) {
      if (table !== 'messages') return;
      const m = row as Message;
      const { error } = await sb.from('messages').insert({ id: m.id, channel: m.channel, author: m.author, role: m.role, text: m.text, quote: m.quote ?? null, at: m.at });
      if (error) throw error;
    },
    async patch(table, id, fields) {
      if (table !== 'messages') return;
      const f = fields as Partial<Message>;
      const { error } = await sb.from('messages').update({ text: f.text, edited_at: f.editedAt ?? Date.now() }).eq('id', id);
      if (error) throw error;
    },
    async remove(table, id) {
      if (table !== 'messages') return;
      const { error } = await sb.from('messages').delete().eq('id', id);
      if (error) throw error;
    },
  };
}

export function makeBackend(): Backend {
  return supabase ? cloudBackend(supabase) : localBackend();
}
