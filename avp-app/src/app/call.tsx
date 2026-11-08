import type { RealtimeChannel } from '@supabase/supabase-js';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Avatar, T } from '@/components/ui';
import { callTopic, RoundButton, useCalls } from '@/lib/calls';
import { useSettings } from '@/lib/settings';
import { supabase } from '@/lib/supabase';

const PAGE = 'https://avp-system.expo.app/call.html';
type WebHandle = { injectJavaScript: (code: string) => void };
// типы react-native-webview пока не совпадают с React 19 — описываем нужные пропсы сами
const Web = WebView as unknown as ComponentType<{
  ref?: Ref<WebHandle>;
  source: { uri: string };
  onMessage: (e: WebViewMessageEvent) => void;
  mediaCapturePermissionGrantType?: 'grant' | 'deny' | 'prompt';
  allowsInlineMediaPlayback?: boolean;
  mediaPlaybackRequiresUserAction?: boolean;
  javaScriptEnabled?: boolean;
  style?: object;
  containerStyle?: object;
  onError?: () => void;
}>;

/** Экран разговора. Голос и видео идут напрямую между телефонами (WebRTC), договариваются через Supabase Realtime. */
export default function CallScreen() {
  useKeepAwake();
  const { t } = useSettings();
  const ins = useSafeAreaInsets();
  const { current: call, setCurrent, notify, lastResult } = useCalls();
  const web = useRef<WebHandle>(null);
  const ch = useRef<RealtimeChannel | null>(null);
  const queue = useRef<unknown[]>([]);
  const st = useRef({ webReady: false, peerJoined: false, started: false });
  const [status, setStatus] = useState(call?.role === 'caller' ? 'Вызываем…' : 'Соединяем…');
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [muted, setMuted] = useState(false);
  const [cam, setCam] = useState(true);

  const js = (code: string) => web.current?.injectJavaScript(`try{${code}}catch(e){};true;`);
  const deliver = (data: unknown) => {
    if (!st.current.webReady) queue.current.push(data);
    else js(`window.avp.signal(${JSON.stringify(data)})`);
  };
  const tryStart = () => {
    if (call?.role === 'caller' && st.current.webReady && st.current.peerJoined && !st.current.started) {
      st.current.started = true;
      js('window.avp.start()');
    }
  };

  const finish = useCallback(
    (reason?: string) => {
      js('window.avp.hangup()');
      if (ch.current) {
        ch.current.send({ type: 'broadcast', event: 'bye', payload: {} }).catch(() => {});
        setTimeout(() => ch.current && supabase?.removeChannel(ch.current), 800);
      }
      if (call && call.role === 'caller' && !connectedAt) notify(call.peerId, 'cancel', call.id);
      if (reason) setStatus(reason);
      setCurrent(null);
      setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/')), reason ? 1400 : 0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [call, connectedAt],
  );

  // канал разговора
  useEffect(() => {
    if (!supabase || !call) return;
    const c = supabase
      .channel(callTopic(call.id), { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'signal' }, ({ payload }) => deliver(payload))
      .on('broadcast', { event: 'joined' }, () => {
        st.current.peerJoined = true;
        setStatus('Соединяем…');
        tryStart();
      })
      .on('broadcast', { event: 'bye' }, () => finish('Звонок завершён'))
      .subscribe((s) => {
        if (s === 'SUBSCRIBED' && call.role === 'callee') c.send({ type: 'broadcast', event: 'joined', payload: {} });
      });
    ch.current = c;
    // нет ответа 45 секунд
    const noAnswer = setTimeout(() => !st.current.peerJoined && finish('Не отвечает'), 45000);
    return () => {
      clearTimeout(noAnswer);
      supabase?.removeChannel(c);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.id]);

  // собеседник отклонил или занят
  useEffect(() => {
    if (call && lastResult?.callId === call.id) finish(lastResult.event === 'busy' ? 'Занят другим звонком' : 'Отклонил вызов');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastResult]);

  useEffect(() => {
    if (!connectedAt) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [connectedAt]);

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { type: string; data?: unknown; state?: string; message?: string };
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.type === 'ready') {
      st.current.webReady = true;
      queue.current.splice(0).forEach((d) => js(`window.avp.signal(${JSON.stringify(d)})`));
      if (call?.role === 'callee') ch.current?.send({ type: 'broadcast', event: 'joined', payload: {} });
      tryStart();
    } else if (m.type === 'signal') ch.current?.send({ type: 'broadcast', event: 'signal', payload: m.data as object });
    else if (m.type === 'state') {
      if (m.state === 'connected') {
        setStatus('');
        setConnectedAt((v) => v ?? Date.now());
      } else if (m.state === 'failed') finish('Связь прервалась');
      else if (m.state === 'disconnected') setStatus('Плохая связь…');
    } else if (m.type === 'error') finish(m.message);
  };

  if (!call)
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <T v="small">{status || 'Звонок завершён'}</T>
      </View>
    );

  const secs = connectedAt ? Math.floor((now - connectedAt) / 1000) : 0;
  const timer = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0C' }}>
      <Web
        ref={web}
        source={{ uri: `${PAGE}?video=${call.video ? 1 : 0}` }}
        onMessage={onMessage}
        mediaCapturePermissionGrantType="grant"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        style={{ flex: 1, backgroundColor: '#0A0A0C' }}
        containerStyle={{ backgroundColor: '#0A0A0C' }}
        onError={() => finish('Нет интернета для звонка')}
      />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: ins.top + 30, alignItems: 'center', gap: 10 }}>
        {!call.video || !connectedAt ? <Avatar name={call.peerName} size={110} /> : null}
        <T v="title" style={{ textAlign: 'center', color: '#fff' }}>
          {call.peerName}
        </T>
        <T v="b" style={{ color: 'rgba(255,255,255,0.75)' }}>
          {status || timer}
        </T>
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: ins.bottom + 30, flexDirection: 'row', justifyContent: 'space-around' }}>
        <RoundButton
          icon="phone"
          label={muted ? 'Микрофон выкл.' : 'Микрофон'}
          on={muted}
          onPress={() => {
            js(`window.avp.mute(${!muted})`);
            setMuted(!muted);
          }}
        />
        {call.video ? (
          <RoundButton
            icon="video"
            label={cam ? 'Камера' : 'Камера выкл.'}
            on={!cam}
            onPress={() => {
              js(`window.avp.camera(${!cam})`);
              setCam(!cam);
            }}
          />
        ) : null}
        <RoundButton color={t.bad} icon="close" label="Завершить" onPress={() => finish()} />
      </View>
    </View>
  );
}
