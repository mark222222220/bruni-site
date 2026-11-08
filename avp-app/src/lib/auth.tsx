import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSettings } from './settings';
import { loginToEmail, supabase } from './supabase';
import type { Role } from './types';

export type Profile = { id: string; name: string; role: Role };
type Ctx = {
  /** true — приложение подключено к закрытой базе и требует входа */
  required: boolean;
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  /** вошёл, но руководитель ещё не добавил в команду */
  noAccess: boolean;
  signIn: (login: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { s, set } = useSettings();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) {
      setProfile(null);
      setNoAccess(false);
      return;
    }
    let off = false;
    supabase
      .from('profiles')
      .select('id,name,role')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (off) return;
        setProfile((data as Profile) ?? null);
        setNoAccess(!data);
        setReady(true);
      });
    return () => {
      off = true;
    };
  }, [session]);

  // имя и роль берём из базы — на телефоне их не поменять
  useEffect(() => {
    if (profile && (profile.name !== s.name || profile.role !== s.role)) set({ name: profile.name, role: profile.role });
  }, [profile, s.name, s.role, set]);

  const signIn = useCallback(async (login: string, password: string) => {
    if (!supabase) return 'База не подключена';
    const { error } = await supabase.auth.signInWithPassword({ email: loginToEmail(login), password });
    if (!error) return null;
    return /invalid/i.test(error.message) ? 'Неверный логин или пароль' : 'Нет связи. Проверьте интернет и попробуйте ещё раз';
  }, []);
  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const value = useMemo(() => ({ required: !!supabase, ready, session, profile, noAccess, signIn, signOut }), [ready, session, profile, noAccess, signIn, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
