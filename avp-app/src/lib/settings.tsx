import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';
import type { Role } from './types';

export type Skin = 'avp' | 'auto' | 'glass-dark' | 'glass-light' | 'solid-dark' | 'solid-light';
export type Accent = 'orange' | 'blue' | 'green' | 'violet';

export type Settings = {
  skin: Skin;
  accent: Accent;
  big: boolean;
  haptics: boolean;
  badges: boolean;
  /** уведомления о новых сообщениях в чате */
  notify: boolean;
  thr: number;
  name: string;
  role: Role;
  /** время последнего прочитанного сообщения по каналам */
  seen: Record<string, number>;
};

export const DEFAULTS: Settings = {
  skin: 'avp',
  accent: 'orange',
  big: false,
  haptics: true,
  badges: true,
  notify: true,
  thr: 15,
  name: '',
  role: 'boss',
  seen: {},
};

export type Theme = {
  dark: boolean;
  glass: boolean;
  /** фирменная тема AVP: градиентные карточки, свечение, точечная сетка */
  premium: boolean;
  cardFrom: string;
  cardTo: string;
  edge: string;
  accent2: string;
  accent3: string;
  bg: string;
  fg: string;
  dim: string;
  mute: string;
  line: string;
  card: string;
  card2: string;
  field: string;
  accent: string;
  onAccent: string;
  ok: string;
  warn: string;
  bad: string;
  okBg: string;
  warnBg: string;
  badBg: string;
  /** радиальные пятна фона для стеклянных тем */
  wallpaper?: string;
  fs: number;
};

const ACCENTS: Record<Accent, { c: string; on: string }> = {
  orange: { c: '#FF6A1A', on: '#140800' },
  blue: { c: '#0A84FF', on: '#FFFFFF' },
  green: { c: '#30B94F', on: '#FFFFFF' },
  violet: { c: '#A95CF0', on: '#FFFFFF' },
};

const ACCENT_SHADES: Record<Accent, [string, string]> = {
  orange: ['#FF9A5C', '#C9470A'],
  blue: ['#5AB0FF', '#0060C0'],
  green: ['#6BD884', '#1E8A3A'],
  violet: ['#C99BFF', '#7A35C0'],
};

export function makeTheme(s: Settings, system: 'light' | 'dark' | null | undefined): Theme {
  const skin: Exclude<Skin, 'auto'> = s.skin === 'auto' ? (system === 'light' ? 'glass-light' : 'glass-dark') : s.skin;
  const premium = skin === 'avp';
  const dark = premium || skin.endsWith('dark');
  const glass = skin.startsWith('glass');
  const a = ACCENTS[s.accent];
  const [a2, a3] = ACCENT_SHADES[s.accent];
  const base = premium
    ? {
        bg: '#0A0A0C',
        fg: '#F4F4F2',
        dim: 'rgba(244,244,242,0.62)',
        mute: 'rgba(244,244,242,0.36)',
        line: 'rgba(255,255,255,0.07)',
        card: '#18181B',
        card2: '#2A2A30',
        field: '#101013',
        ok: '#4FD18B',
        warn: '#FFB020',
        bad: '#FF4D3D',
        okBg: 'rgba(79,209,139,0.14)',
        warnBg: 'rgba(255,176,32,0.14)',
        badBg: 'rgba(255,77,61,0.14)',
      }
    : dark
    ? {
        bg: glass ? '#08080C' : '#0C0C0E',
        fg: '#F5F5F7',
        dim: 'rgba(235,235,245,0.64)',
        mute: 'rgba(235,235,245,0.42)',
        line: glass ? 'rgba(255,255,255,0.10)' : '#2C2C31',
        card: glass ? 'rgba(255,255,255,0.07)' : '#18181B',
        card2: glass ? 'rgba(255,255,255,0.14)' : '#26262B',
        field: glass ? 'rgba(255,255,255,0.08)' : '#0C0C0E',
        ok: '#32D74B',
        warn: '#FFD60A',
        bad: '#FF453A',
        okBg: 'rgba(50,215,75,0.16)',
        warnBg: 'rgba(255,214,10,0.14)',
        badBg: 'rgba(255,69,58,0.17)',
      }
    : {
        bg: glass ? '#E9EBF3' : '#F2F2F6',
        fg: '#1C1C1E',
        dim: 'rgba(60,60,67,0.72)',
        mute: 'rgba(60,60,67,0.48)',
        line: glass ? 'rgba(60,60,67,0.12)' : '#E3E3E8',
        card: glass ? 'rgba(255,255,255,0.55)' : '#FFFFFF',
        card2: glass ? 'rgba(255,255,255,0.85)' : '#EBEBF0',
        field: glass ? 'rgba(255,255,255,0.7)' : '#F2F2F6',
        ok: '#248A3D',
        warn: '#A35200',
        bad: '#D70015',
        okBg: 'rgba(52,199,89,0.16)',
        warnBg: 'rgba(255,149,0,0.18)',
        badBg: 'rgba(255,59,48,0.13)',
      };
  const wallpaper = glass
    ? `radial-gradient(circle at 10% 5%, ${a.c}${dark ? '88' : '55'} 0%, transparent 55%), radial-gradient(circle at 95% 45%, #6B3CFF${dark ? '77' : '44'} 0%, transparent 55%), radial-gradient(circle at 20% 100%, #0A84FF${dark ? '55' : '33'} 0%, transparent 55%)`
    : undefined;
  return {
    ...base,
    dark,
    glass,
    premium,
    cardFrom: premium ? '#222226' : base.card,
    cardTo: premium ? '#141417' : base.card,
    edge: premium ? 'rgba(255,255,255,0.075)' : base.line,
    accent: a.c,
    accent2: a2,
    accent3: a3,
    onAccent: a.on,
    wallpaper,
    fs: s.big ? 18 : 16,
  };
}

type Ctx = {
  s: Settings;
  t: Theme;
  ready: boolean;
  set: (patch: Partial<Settings>) => void;
  reset: () => void;
  tap: (kind?: 'light' | 'success' | 'warning') => void;
};

const SettingsCtx = createContext<Ctx | null>(null);
const KEY = 'avp.settings.v1';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const system = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setS({ ...DEFAULTS, ...JSON.parse(raw) }))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const set = useCallback((patch: Partial<Settings>) => {
    setS((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setS((prev) => {
      const next = { ...DEFAULTS, name: prev.name, role: prev.role, seen: prev.seen };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const tap = useCallback(
    (kind: 'light' | 'success' | 'warning' = 'light') => {
      if (!s.haptics || Platform.OS === 'web') return;
      if (kind === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      else Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
    },
    [s.haptics],
  );

  const t = useMemo(() => makeTheme(s, system), [s, system]);
  const value = useMemo(() => ({ s, t, ready, set, reset, tap }), [s, t, ready, set, reset, tap]);
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings() {
  const c = useContext(SettingsCtx);
  if (!c) throw new Error('useSettings outside SettingsProvider');
  return c;
}
