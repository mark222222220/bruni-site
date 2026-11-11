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
    // служебный канал отчётов о звонках в чат не попадает
    const { data, error } = await sb.from('messages').select('*').neq('channel', 'debug').order('at', { ascending: false }).limit(300);
    if (error) throw error;
    return ((data ?? []) as (Message & { user_id?: string; edited_at?: number | null })[]).map((m) => ({
      photo: m.photo ?? null,
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
  // что уже показано на экране: по этому решаем, изменилось ли что-то на сервере
  let known: Message[] | null = null;
  const signature = (rows: Message[]) => `${rows.length}:${rows[0]?.id ?? ''}:${rows.reduce((a, m) => a + (m.editedAt ?? 0), 0)}`;
  const fetchSheets = async () => {
    const { data, error } = await sb.from('factory_snapshot').select('section,data,updated_at');
    if (error) throw error;
    return sheetsFromRows((data ?? []) as { section: string; data: unknown; updated_at: string }[]);
  };
  return {
    kind: 'cloud',
    async load() {
      known = await fetchMessages();
      return { clients: [], orders: [], stock: [], payments: [], messages: known };
    },
    loadSheets: fetchSheets,
    subscribe(onTable) {
      let shown = known ? signature(known) : '';
      let busy = false;
      let again = false;
      const full = async () => {
        if (busy) {
          again = true;
          return;
        }
        busy = true;
        try {
          const rows = await fetchMessages();
          known = rows;
          const sig = signature(rows);
          if (sig !== shown) {
            shown = sig;
            onTable('messages', rows);
          }
        } catch {}
        busy = false;
        if (again) {
          again = false;
          void full();
        }
      };
      // лёгкая проверка раз в 4 секунды: «есть ли что-то новее показанного?» — ответ почти всегда пустой и весит сотню байт
      const probe = async () => {
        if (!known) return full();
        const lastAt = known.reduce((a, m) => Math.max(a, m.at), 0);
        const lastEdit = known.reduce((a, m) => Math.max(a, m.editedAt ?? 0), 0);
        const { data, error } = await sb.from('messages').select('id').neq('channel', 'debug').or(`at.gt.${lastAt},edited_at.gt.${lastEdit}`).limit(1);
        if (error || data?.length) return full();
      };
      const refresh = () => void full();
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
      // подстраховка к живому каналу: лёгкая проверка каждые 4 с, полная сверка (удалённые сообщения) — раз в 40 с
      let n = 0;
      const timer = setInterval(() => {
        if (AppState.currentState !== 'active') return;
        n += 1;
        void (n % 10 === 0 ? full() : probe());
      }, 4000);
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
      const { error } = await sb.from('messages').insert({ id: m.id, channel: m.channel, author: m.author, role: m.role, text: m.text, quote: m.quote ?? null, at: m.at, ...(m.photo ? { photo: m.photo } : {}) });
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
