import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './auth';
import { uid } from './format';
import { sendPush } from './notifications';
import { useSettings } from './settings';
import { supabase } from './supabase';
import { STATUSES, type Role, type Status } from './types';

/* Общие данные команды поверх таблицы завода: задачи, приход, статусы из цеха, «прочитано», заметки. */

export type Person = { id: string; name: string; role: Role; push_token?: string };
export type Task = { id: string; title: string; assignee: string | null; assignee_name: string; due: string | null; done: boolean; done_at: number | null; channel: string | null; author: string; user_id: string; at: number };
export type Move = { id: string; item_id: string; item_name: string; qty: number; unit: string; note: string | null; photo: string | null; author: string; user_id: string; at: number };
export type Mark = { order_no: string; status: Status; author: string; user_id: string; at: number };
export type Read = { user_id: string; channel: string; at: number };
export type Note = { id: string; client: string; text: string; author: string; user_id: string; at: number };

type Data = { people: Person[]; tasks: Task[]; moves: Move[]; marks: Mark[]; reads: Read[]; notes: Note[] };
const EMPTY: Data = { people: [], tasks: [], moves: [], marks: [], reads: [], notes: [] };
const TABLES = ['tasks', 'moves', 'marks', 'reads', 'notes'] as const;
const DB: Record<(typeof TABLES)[number], string> = { tasks: 'tasks', moves: 'stock_moves', marks: 'order_marks', reads: 'chat_reads', notes: 'client_notes' };
const LOCAL = 'avp.team.v1';

type Ctx = Data & {
  me: string;
  /** в базе ещё не выполнен SQL версии 0.7 */
  missing: boolean;
  addTask: (title: string, to: Person | null, due: string | null, channel?: string | null) => Promise<boolean>;
  toggleTask: (t: Task) => Promise<boolean>;
  removeTask: (id: string) => Promise<boolean>;
  addMove: (m: Omit<Move, 'id' | 'author' | 'user_id' | 'at'>) => Promise<string | null>;
  markOrder: (no: string, status: Status, label: string) => Promise<string | null>;
  markRead: (channel: string, at: number) => void;
  addNote: (client: string, text: string) => Promise<boolean>;
  removeNote: (id: string) => Promise<boolean>;
  notify: (to: Person[], title: string, body: string, data: Record<string, unknown>) => void;
};
const TeamCtx = createContext<Ctx | null>(null);

const num = <T extends { at: unknown }>(r: T) => ({ ...r, at: Number(r.at) });

export function TeamProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const { s } = useSettings();
  const me = profile?.id ?? 'local';
  const myName = profile?.name ?? (s.name || 'Сотрудник');
  const [d, setD] = useState<Data>(EMPTY);
  const [missing, setMissing] = useState(false);
  const dRef = useRef(d);
  dRef.current = d;

  const load = useCallback(async () => {
    if (!supabase) {
      const raw = await AsyncStorage.getItem(LOCAL).catch(() => null);
      const local = raw ? (JSON.parse(raw) as Data) : EMPTY;
      setD({ ...EMPTY, ...local, people: [{ id: 'local', name: s.name || 'Я', role: s.role }] });
      return;
    }
    const sb = supabase;
    const [people, ...rest] = await Promise.all([
      sb.from('profiles').select('*').order('name'),
      sb.from('tasks').select('*').order('at', { ascending: false }).limit(300),
      sb.from('stock_moves').select('*').order('at', { ascending: false }).limit(300),
      sb.from('order_marks').select('*'),
      sb.from('chat_reads').select('*'),
      sb.from('client_notes').select('*').order('at', { ascending: false }).limit(500),
    ]);
    // таблиц нет (SQL 0.7 не выполнен) — работаем без них
    setMissing(rest.slice(0, 4).some((r) => r.error && /does not exist|schema cache|relation/i.test(r.error.message)));
    const pick = <T,>(r: { data: unknown }) => ((r.data ?? []) as T[]);
    setD({
      people: pick<Person>(people),
      tasks: pick<Task>(rest[0]).map((x) => ({ ...num(x), done_at: x.done_at ? Number(x.done_at) : null })),
      moves: pick<Move>(rest[1]).map((x) => ({ ...num(x), qty: Number(x.qty) })),
      marks: pick<Mark>(rest[2]).map(num),
      reads: pick<Read>(rest[3]).map(num),
      notes: pick<Note>(rest[4]).map(num),
    });
  }, [s.name, s.role]);

  useEffect(() => {
    load().catch(() => {});
    if (!supabase) return;
    const sb = supabase;
    const refresh = () => load().catch(() => {});
    let ch = sb.channel('avp-team');
    for (const t of Object.values(DB)) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, refresh);
    sb.auth.getSession().then(({ data }) => {
      if (data.session) sb.realtime.setAuth(data.session.access_token);
      ch.subscribe();
    });
    const timer = setInterval(refresh, 8000);
    const app = AppState.addEventListener('change', (st) => st === 'active' && refresh());
    return () => {
      clearInterval(timer);
      app.remove();
      sb.removeChannel(ch);
    };
  }, [load]);

  /** Сначала меняем экран, потом базу; при ошибке перечитываем. */
  const apply = useCallback(
    async (local: (d: Data) => Data, remote: () => PromiseLike<{ error: { message: string } | null }>): Promise<string | null> => {
      setD((p) => {
        const n = local(p);
        if (!supabase) AsyncStorage.setItem(LOCAL, JSON.stringify({ ...n, people: [] })).catch(() => {});
        return n;
      });
      if (!supabase) return null;
      const { error } = await remote();
      if (error) {
        load().catch(() => {});
        return /does not exist|schema cache|relation/i.test(error.message) ? 'В базе ещё не включена эта функция — попросите руководителя выполнить SQL 0.7' : error.message;
      }
      return null;
    },
    [load],
  );

  const notify = useCallback(
    (to: Person[], title: string, body: string, data: Record<string, unknown>) => {
      const tokens = to.filter((p) => p.id !== me).map((p) => p.push_token ?? '');
      sendPush(tokens, title, body, data).catch(() => {});
    },
    [me],
  );

  const addTask = useCallback(
    async (title: string, to: Person | null, due: string | null, channel: string | null = null) => {
      const t: Task = { id: uid(), title: title.trim(), assignee: to?.id ?? null, assignee_name: to?.name ?? '', due, done: false, done_at: null, channel, author: myName, user_id: me, at: Date.now() };
      const err = await apply((p) => ({ ...p, tasks: [t, ...p.tasks] }), () => supabase!.from('tasks').insert({ ...t, user_id: undefined }));
      if (!err && to) notify([to], `Новая задача от ${myName}`, t.title, { kind: 'task' });
      return !err;
    },
    [apply, me, myName, notify],
  );
  const toggleTask = useCallback(
    async (t: Task) => {
      const done = !t.done;
      const done_at = done ? Date.now() : null;
      const err = await apply((p) => ({ ...p, tasks: p.tasks.map((x) => (x.id === t.id ? { ...x, done, done_at } : x)) }), () => supabase!.from('tasks').update({ done, done_at }).eq('id', t.id));
      const author = dRef.current.people.find((p) => p.id === t.user_id);
      if (!err && done && author) notify([author], `✓ ${myName} выполнил(а) задачу`, t.title, { kind: 'task' });
      return !err;
    },
    [apply, myName, notify],
  );
  const removeTask = useCallback(async (id: string) => !(await apply((p) => ({ ...p, tasks: p.tasks.filter((x) => x.id !== id) }), () => supabase!.from('tasks').delete().eq('id', id))), [apply]);

  const addMove = useCallback(
    (m: Omit<Move, 'id' | 'author' | 'user_id' | 'at'>) => {
      const row: Move = { ...m, id: uid(), author: myName, user_id: me, at: Date.now() };
      return apply((p) => ({ ...p, moves: [row, ...p.moves] }), () => supabase!.from('stock_moves').insert({ ...row, user_id: undefined }));
    },
    [apply, me, myName],
  );

  const markOrder = useCallback(
    async (no: string, status: Status, label: string) => {
      const row: Mark = { order_no: no, status, author: myName, user_id: me, at: Date.now() };
      const err = await apply((p) => ({ ...p, marks: [...p.marks.filter((x) => x.order_no !== no), row] }), () => supabase!.from('order_marks').upsert({ ...row, user_id: me }, { onConflict: 'order_no' }));
      if (!err) {
        const to = dRef.current.people.filter((p) => p.role === 'boss' || p.role === 'sales' || (status === 'ready' && p.role === 'store'));
        const name = STATUSES.find((x) => x.id === status)?.name ?? status;
        notify(to, `Заказ №${no} — ${name}`, `${label} · отметил(а) ${myName}`, { kind: 'order' });
      }
      return err;
    },
    [apply, me, myName, notify],
  );

  const markRead = useCallback(
    (channel: string, at: number) => {
      const cur = dRef.current.reads.find((r) => r.user_id === me && r.channel === channel);
      if (!at || (cur && cur.at >= at)) return;
      const row: Read = { user_id: me, channel, at };
      apply((p) => ({ ...p, reads: [...p.reads.filter((r) => !(r.user_id === me && r.channel === channel)), row] }), () => supabase!.from('chat_reads').upsert(row, { onConflict: 'user_id,channel' })).catch(() => {});
    },
    [apply, me],
  );

  const addNote = useCallback(
    async (client: string, text: string) => {
      const n: Note = { id: uid(), client, text: text.trim(), author: myName, user_id: me, at: Date.now() };
      return !(await apply((p) => ({ ...p, notes: [n, ...p.notes] }), () => supabase!.from('client_notes').insert({ ...n, user_id: undefined })));
    },
    [apply, me, myName],
  );
  const removeNote = useCallback(async (id: string) => !(await apply((p) => ({ ...p, notes: p.notes.filter((x) => x.id !== id) }), () => supabase!.from('client_notes').delete().eq('id', id))), [apply]);

  const value = useMemo(
    () => ({ ...d, me, missing, addTask, toggleTask, removeTask, addMove, markOrder, markRead, addNote, removeNote, notify }),
    [d, me, missing, addTask, toggleTask, removeTask, addMove, markOrder, markRead, addNote, removeNote, notify],
  );
  return <TeamCtx.Provider value={value}>{children}</TeamCtx.Provider>;
}

export function useTeam() {
  const c = useContext(TeamCtx);
  if (!c) throw new Error('useTeam outside TeamProvider');
  return c;
}

/** Мои открытые задачи. */
export function useMyTasks() {
  const { tasks, me } = useTeam();
  return useMemo(() => tasks.filter((t) => !t.done && t.assignee === me), [tasks, me]);
}

export const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;
