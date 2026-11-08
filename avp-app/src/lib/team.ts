import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Role } from './types';

export type Member = { id: string; name: string; role: Role; phone: string };

/** Команда из базы. Телефон необязательный: колонка может ещё не существовать. */
export function useTeam() {
  const [team, setTeam] = useState<Member[]>([]);
  const [loading, setLoading] = useState(!!supabase);
  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from('profiles').select('*').order('created_at');
    setTeam(((data ?? []) as Partial<Member>[]).map((m) => ({ id: m.id!, name: m.name ?? '', role: (m.role ?? 'store') as Role, phone: m.phone ?? '' })));
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { team, loading, reload: load };
}

/** Номер для ссылок tel:/facetime: — только цифры и плюс; 8XXXXXXXXXX → +7XXXXXXXXXX */
export function normPhone(p: string) {
  let d = p.replace(/[^\d+]/g, '');
  if (/^8\d{10}$/.test(d)) d = '+7' + d.slice(1);
  if (/^7\d{10}$/.test(d)) d = '+' + d;
  return d;
}

const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';
/** Видеосовещание в Jitsi Meet: случайная комната, которую не угадать. */
export function meetingUrl(myName: string) {
  const room = 'AVP-GlassHouse-' + Array.from({ length: 12 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
  return { room, url: `https://meet.jit.si/${room}#userInfo.displayName=${encodeURIComponent(JSON.stringify(myName))}&config.prejoinConfig.enabled=false` };
}
export const MEET_RE = /https:\/\/meet\.jit\.si\/[A-Za-z0-9-]+[^\s]*/;
