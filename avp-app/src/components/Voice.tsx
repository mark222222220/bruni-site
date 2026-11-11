import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { T } from '@/components/ui';
import { uid } from '@/lib/format';
import { uploadFile, usePhotoUrl } from '@/lib/photos';
import { useSettings } from '@/lib/settings';

/* Голосовые сообщения. Файл лежит в том же закрытом хранилище, что и фото: voice/ГГГГ-ММ/<id>_<длительность мс>.m4a */

const MAX_MS = 5 * 60e3;
export const isVoice = (path?: string | null) => !!path && (/^voice\//.test(path) || /#voice_|\.(m4a|caf|webm|aac)$/i.test(path));
const durationOf = (path: string) => Number(path.match(/_(\d+)\.\w+$/)?.[1] ?? 0);
export const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export async function uploadVoice(uri: string, ms: number) {
  const ext = uri.match(/\.(\w+)$/)?.[1] ?? (uri.startsWith('blob:') ? 'webm' : 'm4a');
  const path = await uploadFile(uri, `voice/${new Date().toISOString().slice(0, 7)}/${uid()}_${Math.round(ms)}.${ext}`, ext === 'webm' ? 'audio/webm' : 'audio/mp4');
  // демо без базы: файл остаётся на телефоне, помечаем его как голосовое
  return path === uri ? `${uri}#voice_${Math.round(ms)}.${ext}` : path;
}

/** Запись: start → stop (вернёт файл и длительность) или cancel. */
export function useVoiceRecorder() {
  const rec = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt]);

  const start = useCallback(async () => {
    setError('');
    try {
      const p = await AudioModule.requestRecordingPermissionsAsync();
      if (!p.granted) return setError('Разрешите микрофон: Настройки iPhone → Expo Go → Микрофон');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await rec.prepareToRecordAsync();
      rec.record();
      setStartedAt(Date.now());
      setNow(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Микрофон недоступен');
    }
  }, [rec]);

  const finish = useCallback(
    async (keep: boolean) => {
      if (!startedAt) return null;
      const ms = Date.now() - startedAt;
      setStartedAt(null);
      try {
        await rec.stop();
      } catch {}
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
      return keep && rec.uri && ms > 700 ? { uri: rec.uri, ms } : null;
    },
    [rec, startedAt],
  );

  const elapsed = startedAt ? Math.max(0, now - startedAt) : 0;
  return { recording: !!startedAt, elapsed, error, start, stop: () => finish(true), cancel: () => finish(false), tooLong: elapsed >= MAX_MS };
}

type BubbleProps = { path: string; light?: boolean; seed: string };

/** Пузырь голосового: кнопка, «волна» с прогрессом, время. Проигрыватель создаётся только после первого нажатия — сотня голосовых в чате ничего не весит. */
export function VoiceBubble(p: BubbleProps) {
  const [armed, setArmed] = useState(false);
  return armed ? <VoicePlayer {...p} /> : <VoiceShell {...p} playing={false} loading={false} pos={0} total={durationOf(p.path)} onPress={() => setArmed(true)} />;
}

function VoicePlayer({ path, light, seed }: BubbleProps) {
  const url = usePhotoUrl(path);
  const player = useAudioPlayer(url ? { uri: url.split('#voice_')[0] } : null);
  const st = useAudioPlayerStatus(player);
  // нажали «слушать» — играем, как только файл загрузится
  const want = useRef(true);
  useEffect(() => {
    if (want.current && st.isLoaded) {
      want.current = false;
      setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
      player.play();
    }
  }, [st.isLoaded, player]);
  const total = (st.duration ? st.duration * 1000 : 0) || durationOf(path);
  const pos = (st.currentTime ?? 0) * 1000;
  const toggle = async () => {
    if (!st.isLoaded) return;
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    if (st.playing) return player.pause();
    if (st.didJustFinish || (total && pos >= total - 150)) await player.seekTo(0);
    player.play();
  };
  return <VoiceShell path={path} light={light} seed={seed} playing={st.playing} loading={!st.isLoaded} pos={pos} total={total} onPress={toggle} />;
}

function VoiceShell({ light, seed, playing, loading, pos, total, onPress }: BubbleProps & { playing: boolean; loading: boolean; pos: number; total: number; onPress: () => void }) {
  const { t } = useSettings();
  const progress = total ? Math.min(1, pos / total) : 0;
  const ink = light ? t.onAccent : t.fg;
  const bars = useMemo(() => {
    let h = 0;
    for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return Array.from({ length: 28 }, (_, i) => {
      h = (h * 1103515245 + 12345) >>> 0;
      return 0.25 + ((h >>> 16) % 100) / 133 + (i % 7 === 3 ? 0.15 : 0);
    });
  }, [seed]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 210 }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={playing ? 'Пауза' : 'Слушать голосовое'} hitSlop={6} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: light ? 'rgba(17,17,19,0.85)' : t.accent, alignItems: 'center', justifyContent: 'center', opacity: loading ? 0.6 : 1 }}>
        <Svg width={16} height={16} viewBox="0 0 16 16">
          {playing ? <Path d="M4 3h3v10H4zM9 3h3v10H9z" fill={light ? t.accent2 : t.onAccent} /> : <Path d="M5 2.5l8 5.5-8 5.5z" fill={light ? t.accent2 : t.onAccent} />}
        </Svg>
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, height: 26 }}>
          {bars.map((b, i) => (
            <View key={i} style={{ flex: 1, height: `${Math.min(100, b * 100)}%`, borderRadius: 2, backgroundColor: ink, opacity: i / bars.length <= progress ? 0.95 : 0.35 }} />
          ))}
        </View>
        <T v="small" style={{ fontSize: 11, color: ink, opacity: 0.75 }}>
          {loading ? 'загружаю…' : playing || pos > 0 ? `${clock(pos)} / ${clock(total)}` : clock(total)}
        </T>
      </View>
    </View>
  );
}
