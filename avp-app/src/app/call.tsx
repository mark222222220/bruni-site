import type { RealtimeChannel } from '@supabase/supabase-js';
import { setAudioModeAsync } from 'expo-audio';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type Ref } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { APP_BUILD, Avatar, T } from '@/components/ui';
import { callPage } from '@/lib/callPage';
import { callTopic, RoundButton, useCalls } from '@/lib/calls';
import { useSettings } from '@/lib/settings';
import { supabase } from '@/lib/supabase';

type WebHandle = { injectJavaScript: (code: string) => void };
// типы react-native-webview пока не совпадают с React 19 — описываем нужные пропсы сами
const Web = WebView as unknown as ComponentType<{
  ref?: Ref<WebHandle>;
  source: { html: string; baseUrl: string };
  originWhitelist?: string[];
  allowsAirPlayForMediaPlayback?: boolean;
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
  const { t, s } = useSettings();
  const ins = useSafeAreaInsets();
  const { current: call, setCurrent, notify, lastResult, ring, pushCall } = useCalls();
  const web = useRef<WebHandle>(null);
  // https-адрес нужен только чтобы iPhone разрешил микрофон; в сеть за страницей приложение не ходит
  const page = useMemo(() => ({ html: callPage(!!call?.video, call?.role === 'caller'), baseUrl: 'https://avp.local/' }), [call?.video, call?.role]);
  const ch = useRef<RealtimeChannel | null>(null);
  const queue = useRef<unknown[]>([]);
  const st = useRef({ webReady: false, peerJoined: false, started: false });
  const [status, setStatus] = useState(call?.role === 'caller' ? 'Вызываем…' : 'Соединяем…');
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [muted, setMuted] = useState(false);
  const [cam, setCam] = useState(true);
  // громкая связь: у видеозвонка включена сразу, у голосового — звук в «трубку» у уха
  const [speaker, setSpeaker] = useState(!!call?.video);
  const route = useCallback((on: boolean) => {
    setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldRouteThroughEarpiece: !on }).catch(() => {});
  }, []);
  useEffect(() => {
    route(speaker);
  }, [speaker, route]);
  useEffect(
    () => () => {
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldRouteThroughEarpiece: false }).catch(() => {});
    },
    [],
  );
  // прямое соединение не вышло — голос идёт через базу
  const [relay, setRelay] = useState(false);
  // у собеседника не та версия приложения — звонок может оборваться
  const [oldPeer, setOldPeer] = useState(!!call && call.role === 'callee' && call.peerVersion !== APP_BUILD);
  // ход соединения — видно на экране, пока не соединились (и по нажатию на имя)
  const [steps, setSteps] = useState<string[]>([]);
  const [showSteps, setShowSteps] = useState(false);
  const all = useRef<string[]>([]);
  const t0 = useRef(Date.now());
  const step = useCallback((m: string) => {
    all.current.push(`${((Date.now() - t0.current) / 1000).toFixed(1)} ${m}`);
    setSteps((p) => (p[p.length - 1] === m ? p : [...p, m].slice(-9)));
  }, []);
  const done = useRef(false);
  const ticks = useRef(0);

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
    (reason?: string, tone?: 'busy' | 'bye') => {
      if (done.current) return;
      done.current = true;
      // отчёт о звонке — в служебный канал базы (в чатах не виден), чтобы можно было разобраться, если не соединило
      if (supabase && call) {
        const text = `${APP_BUILD} ${Platform.OS} ${Platform.Version} · ${call.role} · ${call.video ? 'video' : 'audio'} · итог: ${reason ?? 'завершил сам'}${connectedAt ? ` · говорили ${Math.round((Date.now() - connectedAt) / 1000)} c` : ''}\n${all.current.join('\n')}`.slice(0, 1000);
        supabase.from('messages').insert({ id: `dbg${call.id}${call.role}`, channel: 'debug', author: s.name || '?', role: s.role, text, at: Date.now() }).then(() => {});
      }
      if (tone) js(`window.avp.${tone}()`);
      else js('window.avp.ringback(false)');
      if (ch.current) {
        ch.current.send({ type: 'broadcast', event: 'bye', payload: {} }).catch(() => {});
        setTimeout(() => ch.current && supabase?.removeChannel(ch.current), 800);
      }
      if (call && call.role === 'caller' && !connectedAt) {
        notify(call.peerId, 'cancel', call.id);
        // не дозвонились — оставляем «пропущенный» на экране телефона
        if (tone !== 'busy') pushCall(call, 'missed');
      }
      if (reason) setStatus(reason);
      // страницу звонка держим ещё секунду-две, чтобы доиграли короткие гудки
      setTimeout(
        () => {
          js('window.avp.hangup()');
          setCurrent(null);
          if (router.canGoBack()) router.back();
          else router.replace('/');
        },
        tone === 'busy' ? 2300 : reason ? 1400 : 350,
      );
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
      .on('broadcast', { event: 'joined' }, ({ payload }) => {
        const v = (payload as { v?: string } | undefined)?.v ?? 'old';
        if (!st.current.peerJoined) step(`собеседник ответил (версия ${v === 'old' ? 'старая' : v})`);
        if (v !== APP_BUILD) setOldPeer(true);
        st.current.peerJoined = true;
        setStatus('Соединяем…');
        tryStart();
      })
      .on('broadcast', { event: 'relay' }, () => js('window.avp.relay()'))
      .on('broadcast', { event: 'audio' }, ({ payload }) => js(`window.avp.play(${JSON.stringify((payload as { d?: string }).d ?? '')})`))
      .on('broadcast', { event: 'bye' }, () => finish('Звонок завершён', 'bye'))
      .subscribe((s) => {
        step(s === 'SUBSCRIBED' ? 'канал связи открыт' : `канал связи: ${s}`);
        if (s === 'SUBSCRIBED' && call.role === 'callee') c.send({ type: 'broadcast', event: 'joined', payload: { v: APP_BUILD } });
      });
    ch.current = c;
    // нет ответа 45 секунд; пока ждём — повторяем вызов (вдруг собеседник только открыл приложение по уведомлению)
    const noMic = setTimeout(() => !st.current.webReady && !done.current && setStatus('Микрофон не запускается…'), 12000);
    const noAnswer = setTimeout(() => !st.current.peerJoined && finish('Не отвечает'), 45000);
    const again = setInterval(() => {
      if (call.role !== 'caller' || st.current.peerJoined || done.current) return;
      ring(call);
      // приложение у собеседника закрыто — уведомление «звонит» повторяем, как гудки
      ticks.current += 1;
      if (ticks.current === 3 || ticks.current === 7 || ticks.current === 11) pushCall(call, 'ring');
    }, 3000);
    return () => {
      clearTimeout(noAnswer);
      clearTimeout(noMic);
      clearInterval(again);
      supabase?.removeChannel(c);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call?.id]);

  // собеседник отклонил или занят
  useEffect(() => {
    if (call && lastResult?.callId === call.id) finish(lastResult.event === 'busy' ? 'Занят другим звонком' : 'Отклонил вызов', 'busy');
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
    if (m.type === 'log') return step((m as { m?: string }).m ?? '');
    if (m.type === 'ready') {
      st.current.webReady = true;
      queue.current.splice(0).forEach((d) => js(`window.avp.signal(${JSON.stringify(d)})`));
      route(speaker); // страница заняла микрофон — возвращаем выбранный выход звука
      if (call?.role === 'callee') ch.current?.send({ type: 'broadcast', event: 'joined', payload: { v: APP_BUILD } });
      tryStart();
    } else if (m.type === 'signal') ch.current?.send({ type: 'broadcast', event: 'signal', payload: m.data as object });
    else if (m.type === 'audio') ch.current?.send({ type: 'broadcast', event: 'audio', payload: { d: (m as { d?: string }).d ?? '' } });
    else if (m.type === 'relay') ch.current?.send({ type: 'broadcast', event: 'relay', payload: {} });
    else if (m.type === 'state') {
      if (m.state === 'connected') {
        setStatus('');
        setConnectedAt((v) => v ?? Date.now());
        setRelay(false);
        route(speaker);
      } else if (m.state === 'relay') {
        setStatus('');
        setRelay(true);
        setConnectedAt((v) => v ?? Date.now());
        route(speaker);
      } else if (m.state === 'lost') {
        finish('Собеседник пропал со связи');
      } else if (m.state === 'failed') finish('Связь прервалась (прямой канал)');
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
        source={page}
        originWhitelist={['*']}
        onMessage={onMessage}
        mediaCapturePermissionGrantType="grant"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        style={{ flex: 1, backgroundColor: '#0A0A0C' }}
        containerStyle={{ backgroundColor: '#0A0A0C' }}
        onError={() => finish('Не открылась страница звонка')}
      />
      <View style={{ position: 'absolute', left: 0, right: 0, top: ins.top + 30, alignItems: 'center', gap: 10 }} onTouchEnd={() => setShowSteps((v) => !v)}>
        {!call.video || !connectedAt || relay ? <Avatar name={call.peerName} size={110} /> : null}
        <T v="title" style={{ textAlign: 'center', color: '#fff' }}>
          {call.peerName}
        </T>
        <T v="b" style={{ color: 'rgba(255,255,255,0.75)' }}>
          {status || timer}
        </T>
        {(!connectedAt || showSteps) && steps.length ? (
          <View style={{ marginTop: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '86%' }}>
            {steps.map((x, i) => (
              <T key={i} v="small" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                {i + 1}. {x}
              </T>
            ))}
          </View>
        ) : null}
        {oldPeer ? (
          <View style={{ backgroundColor: 'rgba(255,170,0,0.18)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, maxWidth: '86%' }}>
            <T v="small" style={{ color: '#FFC55C', textAlign: 'center' }}>
              У собеседника другая версия AVP (у вас {APP_BUILD}). Пусть обновит приложение — иначе звонок может оборваться.
            </T>
          </View>
        ) : null}
        {relay && !status ? (
          <T v="small" style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', paddingHorizontal: 30 }}>
            {call.video ? 'Напрямую соединиться не удалось — идёт только голос, через сервер' : 'Голос идёт через сервер'}
          </T>
        ) : null}
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: ins.bottom + 30, flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', rowGap: 18 }}>
        <RoundButton
          icon="mic"
          label={muted ? 'Микрофон выкл.' : 'Микрофон'}
          on={muted}
          onPress={() => {
            js(`window.avp.mute(${!muted})`);
            setMuted(!muted);
          }}
        />
        <RoundButton icon="speaker" label={speaker ? 'Громкая вкл.' : 'Громкая связь'} on={speaker} onPress={() => setSpeaker(!speaker)} />
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
        {call.video ? <RoundButton icon="camera" label="Повернуть" onPress={() => js('window.avp.flip()')} /> : null}
        <RoundButton color={t.bad} icon="close" label="Завершить" onPress={() => finish(undefined, connectedAt ? 'bye' : undefined)} />
      </View>
    </View>
  );
}
