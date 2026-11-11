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
/** Движение по складу. qty со знаком: приход +, выдача и списание −, инвентаризация — разница с учётом. */
export type MoveKind = 'in' | 'out' | 'writeoff' | 'count';
export type Move = { id: string; kind: MoveKind; item_id: string; item_name: string; qty: number; unit: string; note: string | null; photo: string | null; order_no: string | null; author: string; user_id: string; at: number };
export type Mark = { order_no: string; status: Status; author: string; user_id: string; at: number };
export type Read = { user_id: string; channel: string; at: number };
export type Note = { id: string; client: string; text: string; author: string; user_id: string; at: number };
export type Reaction = { message_id: string; user_id: string; emoji: string; at: number };
export const EMOJI = ['👍', '🔥', '❤️', '😂', '😮', '✅'];

type Data = { people: Person[]; tasks: Task[]; moves: Move[]; marks: Mark[]; reads: Read[]; notes: Note[]; reactions: Reaction[] };
const EMPTY: Data = { people: [], tasks: [], moves: [], marks: [], reads: [], notes: [], reactions: [] };
const DB: Record<Exclude<keyof Data, 'people'>, string> = { tasks: 'tasks', moves: 'stock_moves', marks: 'order_marks', reads: 'chat_reads', notes: 'client_notes', reactions: 'message_reactions' };
const LOCAL = 'avp.team.v1';

type Ctx = Data & {
  me: string;
  /** в базе ещё не выполнен SQL версии 0.7 */
  missing: boolean;
  addTask: (title: string, to: Person | null, due: string | null, channel?: string | null) => Promise<boolean>;
  toggleTask: (t: Task) => Promise<boolean>;
  removeTask: (id: string) => Promise<boolean>;
  addMove: (m: Omit<Move, 'id' | 'author' | 'user_id' | 'at'>) => Promise<string | null>;
  removeMove: (id: string) => Promise<string | null>;
  markOrder: (no: string, status: Status, label: string) => Promise<string | null>;
  markRead: (channel: string, at: number) => void;
  addNote: (client: string, text: string) => Promise<boolean>;
  removeNote: (id: string) => Promise<boolean>;
  toggleReaction: (messageId: string, emoji: string, authorId?: string) => void;
  /** кто сейчас в приложении */
  online: Set<string>;
  /** кто печатает: канал чата */
  typing: { id: string; name: string; ch: string }[];
  setTyping: (ch: string | null) => void;
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
  const sigs = useRef<Partial<Record<keyof Data, string>>>({});

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
      sb.from('stock_moves').select('*').order('at', { ascending: false }).limit(500),
      sb.from('order_marks').select('*'),
      sb.from('chat_reads').select('*'),
      sb.from('client_notes').select('*').order('at', { ascending: false }).limit(300),
      sb.from('message_reactions').select('*').order('at', { ascending: false }).limit(800),
    ]);
    // нет связи — оставляем то, что уже показано
    if (people.error && rest.every((r) => r.error)) return;
    // таблиц нет (SQL не выполнен) — работаем без них
    setMissing(rest.slice(0, 4).some((r) => r.error && /does not exist|schema cache|relation/i.test(r.error.message)));
    const pick = <T,>(r: { data: unknown }) => ((r.data ?? []) as T[]);
    const next: Data = {
      people: pick<Person>(people),
      tasks: pick<Task>(rest[0]).map((x) => ({ ...num(x), done_at: x.done_at ? Number(x.done_at) : null })),
      moves: pick<Move>(rest[1]).map((x) => ({ ...num(x), qty: Number(x.qty), kind: x.kind ?? 'in', order_no: x.order_no ?? null })),
      marks: pick<Mark>(rest[2]).map(num),
      reads: pick<Read>(rest[3]).map(num),
      notes: pick<Note>(rest[4]).map(num),
      reactions: pick<Reaction>(rest[5]).map(num),
    };
    // меняем только те списки, что действительно изменились: иначе всё приложение перерисовывалось бы при каждой проверке
    const changed: Partial<Data> = {};
    for (const k of Object.keys(next) as (keyof Data)[]) {
      const sig = JSON.stringify(next[k]);
      if (sigs.current[k] !== sig) {
        sigs.current[k] = sig;
        (changed as Record<string, unknown>)[k] = next[k];
      }
    }
    if (Object.keys(changed).length) setD((p) => ({ ...p, ...changed }));
  }, [s.name, s.role]);

  useEffect(() => {
    load().catch(() => {});
    if (!supabase) return;
    const sb = supabase;
    let soon: ReturnType<typeof setTimeout> | null = null;
    // несколько изменений подряд — одна перезагрузка
    const refresh = () => {
      if (soon) return;
      soon = setTimeout(() => {
        soon = null;
        load().catch(() => {});
      }, 250);
    };
    let ch = sb.channel('avp-team');
    for (const t of Object.values(DB)) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, refresh);
    sb.auth.getSession().then(({ data }) => {
      if (data.session) sb.realtime.setAuth(data.session.access_token);
      ch.subscribe();
    });
    // подстраховка к живому каналу; в фоне не опрашиваем
    const timer = setInterval(() => AppState.currentState === 'active' && refresh(), 12000);
    const app = AppState.addEventListener('change', (st) => st === 'active' && refresh());
    return () => {
      clearInterval(timer);
      if (soon) clearTimeout(soon);
      app.remove();
      sb.removeChannel(ch);
    };
  }, [load]);

  /* Кто в сети и кто печатает — через живой канал, в базе не хранится. */
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [typing, setTypingList] = useState<{ id: string; name: string; ch: string }[]>([]);
  const presence = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  const typingCh = useRef<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!supabase || !profile) return;
    const sb = supabase;
    const ch = sb.channel('avp-presence', { config: { presence: { key: profile.id } } });
    const sync = () => {
      const st = ch.presenceState<{ name: string; typing: string | null; active: boolean }>();
      const ids = new Set<string>();
      const ty: { id: string; name: string; ch: string }[] = [];
      for (const [id, metas] of Object.entries(st)) {
        const m = metas[metas.length - 1];
        if (m?.active) ids.add(id);
        if (m?.typing && id !== profile.id) ty.push({ id, name: m.name, ch: m.typing });
      }
      setOnline((p) => (p.size === ids.size && [...ids].every((x) => p.has(x)) ? p : ids));
      setTypingList((p) => (JSON.stringify(p) === JSON.stringify(ty) ? p : ty));
    };
    ch.on('presence', { event: 'sync' }, sync);
    sb.auth.getSession().then(({ data }) => {
      if (data.session) sb.realtime.setAuth(data.session.access_token);
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') ch.track({ name: profile.name, typing: null, active: AppState.currentState === 'active' });
      });
    });
    presence.current = ch;
    const app = AppState.addEventListener('change', (st) => ch.track({ name: profile.name, typing: null, active: st === 'active' }));
    return () => {
      app.remove();
      presence.current = null;
      sb.removeChannel(ch);
    };
  }, [profile]);
  const setTyping = useCallback(
    (ch: string | null) => {
      const put = (v: string | null) => {
        if (typingCh.current === v) return;
        typingCh.current = v;
        presence.current?.track({ name: myName, typing: v, active: true });
      };
      if (typingTimer.current) clearTimeout(typingTimer.current);
      // перестал печатать — через 4 секунды надпись у коллег пропадает сама
      if (ch) typingTimer.current = setTimeout(() => put(null), 4000);
      put(ch);
    },
    [myName],
  );

  /** Сначала меняем экран, потом базу; при ошибке перечитываем. */
  const apply = useCallback(
    async (local: (d: Data) => Data, remote: () => PromiseLike<{ error: { message: string } | null }>): Promise<string | null> => {
      sigs.current = {};
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
  const removeMove = useCallback((id: string) => apply((p) => ({ ...p, moves: p.moves.filter((x) => x.id !== id) }), () => supabase!.from('stock_moves').delete().eq('id', id)), [apply]);

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

  const toggleReaction = useCallback(
    (messageId: string, emoji: string, authorId?: string) => {
      const had = dRef.current.reactions.some((r) => r.message_id === messageId && r.user_id === me && r.emoji === emoji);
      const row: Reaction = { message_id: messageId, user_id: me, emoji, at: Date.now() };
      apply(
        (p) => ({ ...p, reactions: had ? p.reactions.filter((r) => !(r.message_id === messageId && r.user_id === me && r.emoji === emoji)) : [row, ...p.reactions] }),
        () => (had ? supabase!.from('message_reactions').delete().match({ message_id: messageId, user_id: me, emoji }) : supabase!.from('message_reactions').insert(row)),
      ).then((err) => {
        const author = dRef.current.people.find((p) => p.id === authorId);
        if (!err && !had && author) notify([author], `${firstName(myName)} ${emoji}`, 'отреагировал(а) на ваше сообщение', { kind: 'chat' });
      });
    },
    [apply, me, myName, notify],
  );

  const value = useMemo(
    () => ({ ...d, me, missing, addTask, toggleTask, removeTask, addMove, removeMove, markOrder, markRead, addNote, removeNote, notify, toggleReaction, online, typing, setTyping }),
    [d, me, missing, addTask, toggleTask, removeTask, addMove, removeMove, markOrder, markRead, addNote, removeNote, notify, toggleReaction, online, typing, setTyping],
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
