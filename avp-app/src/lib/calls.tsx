import type { RealtimeChannel } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, Vibration, View } from 'react-native';
import { APP_BUILD, Avatar, Fill, Icon, T, Wallpaper } from '@/components/ui';
import { useAuth } from './auth';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useSettings } from './settings';
import { useTeam } from './team';
import { supabase } from './supabase';

export type CallInfo = { id: string; peerId: string; peerName: string; video: boolean; role: 'caller' | 'callee'; /** версия приложения у собеседника, если он её прислал */ peerVersion?: string };
type Ring = { callId: string; fromId: string; fromName: string; video: boolean; v?: string };

type Ctx = {
  startCall: (peer: { id: string; name: string }, video: boolean) => void;
  /** сообщить собеседнику (ему в личный канал вызовов) */
  notify: (peerId: string, event: 'decline' | 'cancel' | 'busy', callId: string) => void;
  current: CallInfo | null;
  setCurrent: (c: CallInfo | null) => void;
  lastResult: { callId: string; event: string } | null;
  /** повторить вызов собеседнику */
  ring: (c: CallInfo) => void;
  /** уведомление на экран телефона собеседника: «звонит» или «пропущенный» */
  pushCall: (c: CallInfo, kind: 'ring' | 'missed') => void;
};
const CallCtx = createContext<Ctx | null>(null);

const rid = () => Array.from({ length: 16 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');

/** Личный канал вызовов сотрудника: сюда приходят «звонит», «отклонил», «отменил». */
const ringTopic = (userId: string) => `avp-ring-${userId}`;

async function sendOnce(topic: string, event: string, payload: Record<string, unknown>) {
  if (!supabase) return;
  const ch = supabase.channel(topic, { config: { broadcast: { self: false, ack: true } } });
  await new Promise<void>((res) => {
    const t = setTimeout(res, 4000);
    ch.subscribe((st) => {
      if (st === 'SUBSCRIBED') {
        clearTimeout(t);
        res();
      }
    });
  });
  await ch.send({ type: 'broadcast', event, payload }).catch(() => {});
  setTimeout(() => supabase?.removeChannel(ch), 1500);
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { profile, session } = useAuth();
  const { t } = useSettings();
  const [incoming, setIncoming] = useState<Ring | null>(null);
  const [current, setCurrent] = useState<CallInfo | null>(null);
  const [lastResult, setLastResult] = useState<Ctx['lastResult']>(null);
  const currentRef = useRef<CallInfo | null>(null);
  currentRef.current = current;
  const incomingRef = useRef<Ring | null>(null);
  incomingRef.current = incoming;
  const declined = useRef(new Set<string>());
  const { people } = useTeam();

  // слушаем свой канал вызовов
  useEffect(() => {
    if (!supabase || !profile || !session) return;
    supabase.realtime.setAuth(session.access_token);
    const ch: RealtimeChannel = supabase
      .channel(ringTopic(profile.id), { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'ring' }, ({ payload }) => {
        const r = payload as Ring;
        // повтор того же вызова
        if (currentRef.current?.id === r.callId || incomingRef.current?.callId === r.callId || declined.current.has(r.callId)) return;
        if (currentRef.current || incomingRef.current) {
          sendOnce(ringTopic(r.fromId), 'busy', { callId: r.callId });
          return;
        }
        setIncoming(r);
      })
      .on('broadcast', { event: 'cancel' }, ({ payload }) => {
        declined.current.add((payload as Ring).callId);
        setIncoming((cur) => (cur && cur.callId === (payload as Ring).callId ? null : cur));
      })
      .on('broadcast', { event: 'decline' }, ({ payload }) => setLastResult({ callId: (payload as Ring).callId, event: 'decline' }))
      .on('broadcast', { event: 'busy' }, ({ payload }) => setLastResult({ callId: (payload as Ring).callId, event: 'busy' }))
      .subscribe();
    return () => {
      supabase?.removeChannel(ch);
    };
  }, [profile, session]);

  // вибрация, пока звонят
  useEffect(() => {
    if (!incoming) return;
    Vibration.vibrate([0, 700, 900], true);
    // мелодия звонка (в беззвучном режиме — только вибрация)
    let player: ReturnType<typeof createAudioPlayer> | null = null;
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: false, shouldRouteThroughEarpiece: false })
      .catch(() => {})
      .then(() => {
        try {
          player = createAudioPlayer(require('../../assets/ring.wav'));
          player.loop = true;
          player.play();
        } catch {}
      });
    const auto = setTimeout(() => {
      declined.current.add(incoming.callId);
      setIncoming(null);
    }, 45000);
    return () => {
      try {
        player?.pause();
        player?.remove();
      } catch {}
      Vibration.cancel();
      clearTimeout(auto);
    };
  }, [incoming]);

  const startCall = useCallback(
    (peer: { id: string; name: string }, video: boolean) => {
      if (!profile) return;
      const c: CallInfo = { id: rid(), peerId: peer.id, peerName: peer.name, video, role: 'caller' };
      setCurrent(c);
      sendOnce(ringTopic(peer.id), 'ring', { callId: c.id, fromId: profile.id, fromName: profile.name, video, v: APP_BUILD });
      pushCallRef.current(c, 'ring');
      router.push({ pathname: '/call', params: { id: c.id } });
    },
    [profile, people],
  );
  const pushCall = useCallback(
    (c: CallInfo, kind: 'ring' | 'missed') => {
      const token = people.find((p) => p.id === c.peerId)?.push_token;
      if (!profile || !token || !token.startsWith('ExponentPushToken')) return;
      const ringing = kind === 'ring';
      fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: token,
          title: ringing ? (c.video ? '📹 Входящий видеозвонок' : '📞 Входящий звонок') : '📵 Пропущенный звонок',
          body: ringing ? `${profile.name} звонит вам в AVP — нажмите, чтобы ответить` : `${profile.name} звонил(а) вам в AVP`,
          sound: 'default',
          priority: 'high',
          interruptionLevel: ringing ? 'time-sensitive' : 'active',
          ttl: ringing ? 40 : 86400,
          data: ringing ? { kind: 'call', callId: c.id, fromId: profile.id, fromName: profile.name, video: c.video, at: Date.now() } : { kind: 'missed' },
        }),
      }).catch(() => {});
    },
    [people, profile],
  );
  const pushCallRef = useRef(pushCall);
  pushCallRef.current = pushCall;

  // открыли приложение по уведомлению «звонит» — сразу показываем входящий
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (n?: Notifications.Notification | null) => {
      const d = n?.request.content.data as { kind?: string; callId?: string; fromId?: string; fromName?: string; video?: boolean; at?: number } | undefined;
      if (d?.kind !== 'call' || !d.callId || !d.fromId || Date.now() - (d.at ?? 0) > 45000) return;
      if (currentRef.current || incomingRef.current || declined.current.has(d.callId)) return;
      setIncoming({ callId: d.callId, fromId: d.fromId, fromName: d.fromName ?? 'Коллега', video: !!d.video });
    };
    Notifications.getLastNotificationResponseAsync().then((r) => open(r?.notification)).catch(() => {});
    const a = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification));
    return () => a.remove();
  }, []);

  const ring = useCallback(
    (c: CallInfo) => {
      if (profile) sendOnce(ringTopic(c.peerId), 'ring', { callId: c.id, fromId: profile.id, fromName: profile.name, video: c.video, v: APP_BUILD });
    },
    [profile],
  );
  const notify = useCallback((peerId: string, event: 'decline' | 'cancel' | 'busy', callId: string) => {
    sendOnce(ringTopic(peerId), event, { callId });
  }, []);

  const accept = () => {
    if (!incoming) return;
    const c: CallInfo = { id: incoming.callId, peerId: incoming.fromId, peerName: incoming.fromName, video: incoming.video, role: 'callee', peerVersion: incoming.v ?? 'old' };
    setIncoming(null);
    setCurrent(c);
    router.push({ pathname: '/call', params: { id: c.id } });
  };
  const decline = () => {
    if (!incoming) return;
    declined.current.add(incoming.callId);
    notify(incoming.fromId, 'decline', incoming.callId);
    setIncoming(null);
  };

  const value = useMemo(() => ({ startCall, notify, current, setCurrent, lastResult, ring, pushCall }), [startCall, notify, current, lastResult, ring, pushCall]);
  return (
    <CallCtx.Provider value={value}>
      {children}
      <Modal visible={!!incoming} animationType="slide" presentationStyle="fullScreen" onRequestClose={decline}>
        <View style={{ flex: 1, backgroundColor: t.bg }}>
          <Wallpaper />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <T v="kicker">{incoming?.video ? 'Видеозвонок AVP' : 'Звонок AVP'}</T>
            <Avatar name={incoming?.fromName ?? ''} size={120} />
            <T v="title" style={{ textAlign: 'center' }}>
              {incoming?.fromName}
            </T>
            <T v="small">звонит вам…</T>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 90 }}>
            <RoundButton color={t.bad} icon="close" label="Отклонить" onPress={decline} />
            <RoundButton color={t.ok} icon={incoming?.video ? 'video' : 'phone'} label="Ответить" onPress={accept} />
          </View>
        </View>
      </Modal>
    </CallCtx.Provider>
  );
}

export function RoundButton({ color, icon, label, onPress, on }: { color?: string; icon: string; label: string; onPress: () => void; on?: boolean }) {
  const { t, tap } = useSettings();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ alignItems: 'center', gap: 8, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 74, height: 74, borderRadius: 37, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: color ?? (on ? '#FFFFFF' : 'rgba(255,255,255,0.16)'), zIndex: 0 }}>
        {color ? <Fill colors={[color, color]} /> : null}
        <Icon name={icon} size={30} color={on && !color ? '#111113' : '#FFFFFF'} stroke={2.2} />
      </View>
      <T v="small" style={{ color: t.fg, fontSize: 12 }}>
        {label}
      </T>
    </Pressable>
  );
}

export function useCalls() {
  const c = useContext(CallCtx);
  if (!c) throw new Error('useCalls outside CallProvider');
  return c;
}

export const callTopic = (callId: string) => `avp-call-${callId}`;
