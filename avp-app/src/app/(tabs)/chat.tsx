import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import * as Clipboard from 'expo-clipboard';
import { ActivityIndicator, AppState, FlatList, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Fill, Glass, Icon, IconButton, Screen, T, styles } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { clock, isVoice, uploadVoice, useVoiceRecorder, VoiceBubble } from '@/components/Voice';
import { pickPhoto, pickPhotos, uploadPhoto, usePhotoUrl } from '@/lib/photos';
import { useSettings } from '@/lib/settings';
import { EMOJI, firstName, useTeam } from '@/lib/team';
import { CHANNELS, ROLES, type Message } from '@/lib/types';

/** Фото в сообщении: по нажатию — на весь экран. */
function Photo({ path, onOpen }: { path: string; onOpen: (url: string) => void }) {
  const url = usePhotoUrl(path);
  const { t } = useSettings();
  return (
    <Pressable onPress={() => url && onOpen(url)} accessibilityRole="imagebutton" accessibilityLabel="Фото, открыть">
      {url ? (
        <Image source={{ uri: url }} style={{ width: 220, height: 220, borderRadius: 14 }} resizeMode="cover" />
      ) : (
        <View style={{ width: 220, height: 220, borderRadius: 14, backgroundColor: t.card2, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.dim} />
        </View>
      )}
    </Pressable>
  );
}

/** Текст с подсвеченными @упоминаниями. */
function Rich({ text, color, accent }: { text: string; color: string; accent: string }) {
  const parts = text.split(/(@[A-Za-zА-Яа-яЁё0-9_-]+)/);
  return (
    <T v="body" style={{ color }}>
      {parts.map((p, i) =>
        p.startsWith('@') ? (
          <T key={i} v="b" style={{ color: accent }}>
            {p}
          </T>
        ) : (
          p
        ),
      )}
    </T>
  );
}

type Rx = [emoji: string, users: string[]][];
type RowProps = {
  m: Message;
  me: boolean;
  online: boolean;
  /** кто-то из коллег уже прочитал (для своих сообщений) */
  read: boolean;
  /** имена прочитавших — показываем под последним своим сообщением */
  readNames: string;
  reactions?: Rx;
  myId: string;
  cloud: boolean;
  onTap: (m: Message) => void;
  onLong: (m: Message) => void;
  onOpen: (url: string) => void;
  onReact: (m: Message, emoji: string) => void;
};
const timeOf = (m: Message) => new Date(m.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + (m.editedAt ? ' · изм.' : '');

/** Одно сообщение. memo: пока его данные не изменились, оно не перерисовывается — набор текста и новые сообщения не тормозят длинный чат. */
const MessageRow = memo(function MessageRow({ m, me, online, read, readNames, reactions, myId, cloud, onTap, onLong, onOpen, onReact }: RowProps) {
  const { t } = useSettings();
  const media = m.photo ? isVoice(m.photo) ? <VoiceBubble path={m.photo} light={me} seed={m.id} /> : <Photo path={m.photo} onOpen={onOpen} /> : null;
  return (
    <View style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '86%', marginVertical: 4 }}>
      <Pressable onPress={() => onTap(m)} onLongPress={() => onLong(m)} delayLongPress={350}>
        {me ? (
          <View>
            <View style={{ borderRadius: 20, borderTopRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10, gap: 3, overflow: 'hidden', zIndex: 0 }}>
              <Fill colors={[t.accent2, t.accent, t.accent3]} vertical={false} />
              {m.quote ? <T v="small" style={{ color: t.onAccent, opacity: 0.75, borderLeftWidth: 3, borderLeftColor: t.onAccent, paddingLeft: 8 }}>{m.quote}</T> : null}
              {media}
              {m.text ? <Rich text={m.text} color={t.onAccent} accent={t.onAccent} /> : null}
              <T v="small" style={{ color: t.onAccent, opacity: 0.7, fontSize: 11, alignSelf: 'flex-end' }}>
                {timeOf(m)}
                {cloud ? (read ? '  ✓✓' : '  ✓') : ''}
              </T>
            </View>
            {readNames ? (
              <T v="small" style={{ fontSize: 11, alignSelf: 'flex-end', marginTop: 3 }}>
                Прочитали: {readNames}
              </T>
            ) : null}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View>
              <Avatar name={m.author} />
              {online ? <View style={{ position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: 6, backgroundColor: t.ok, borderWidth: 2, borderColor: t.bg }} /> : null}
            </View>
            <Glass radius={20} style={{ borderBottomLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 10, gap: 4, flexShrink: 1 }}>
              <T v="small" style={{ fontSize: 12 }}>
                <T v="b" style={{ fontSize: 12, color: t.accent2 }}>
                  {m.author}
                </T>
                {`  ${ROLES[m.role]?.name ?? ''} · ${timeOf(m)}`}
              </T>
              {m.quote ? <T v="small" style={{ borderLeftWidth: 3, borderLeftColor: t.accent, paddingLeft: 8 }}>{m.quote}</T> : null}
              {media}
              {m.text ? <Rich text={m.text} color={t.fg} accent={t.accent2} /> : null}
            </Glass>
          </View>
        )}
      </Pressable>
      {reactions?.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, alignSelf: me ? 'flex-end' : 'flex-start', marginLeft: me ? 0 : 40 }}>
          {reactions.map(([e, users]) => {
            const mine = users.includes(myId);
            return (
              <Pressable key={e} onPress={() => onReact(m, e)} accessibilityLabel={`${e} ${users.length}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: mine ? t.accent + '33' : t.card2, borderWidth: 1, borderColor: mine ? t.accent : 'transparent' }}>
                <T v="body" style={{ fontSize: 14 }}>
                  {e}
                </T>
                {users.length > 1 ? (
                  <T v="b" style={{ fontSize: 12 }}>
                    {users.length}
                  </T>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
});

function EmptyChat() {
  return (
    <View style={{ transform: [{ scaleY: -1 }], padding: 28 }}>
      <T v="small" style={{ textAlign: 'center' }}>
        В канале пока тихо. Напишите первое сообщение.
      </T>
    </View>
  );
}
const LIST_PAD = { paddingVertical: 12 };
const styles_flex = { flex: 1 };
const keyOf = (m: Message) => m.id;
const NO_READERS: { user_id: string; at: number }[] = [];

export default function Chat() {
  const params = useLocalSearchParams<{ ch?: string; q?: string }>();
  const { snap, send, kind, editMessage, deleteMessage } = useData();
  const { profile } = useAuth();
  const { s, t, set, tap } = useSettings();
  const ins = useSafeAreaInsets();
  const [ch, setCh] = useState(params.ch ?? 'general');
  const [quote, setQuote] = useState<string | null>(params.q ?? null);
  const [text, setText] = useState('');
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [kb, setKb] = useState(false);
  const [menu, setMenu] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [sure, setSure] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const photo = photos[0] ?? null;
  const [attachMenu, setAttachMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [viewer, setViewer] = useState<string | null>(null);
  const team = useTeam();
  const myUid = profile?.id;
  const isMine = useCallback((m: Message) => (m.userId && myUid ? m.userId === myUid : m.author === s.name), [myUid, s.name]);
  const canDelete = (m: Message) => isMine(m) || s.role === 'boss';
  const fmtTime = timeOf;
  const openMenu = useCallback(
    (m: Message) => {
      tap();
      setSure(false);
      setMenu(m);
    },
    [tap],
  );
  // экран чата виден прямо сейчас? (вкладка открыта и приложение на экране)
  const focused = useIsFocused();
  const [awake, setAwake] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setAwake(st === 'active'));
    return () => sub.remove();
  }, []);
  const visible = focused && awake;
  const startEdit = (m: Message) => {
    setMenu(null);
    setQuote(null);
    setEditing(m);
    setText(m.text);
    setTimeout(() => input.current?.focus(), 250);
  };
  const doDelete = async (m: Message) => {
    if (!sure) return setSure(true);
    setMenu(null);
    if (await deleteMessage(m.id)) tap('success');
  };
  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKb(true));
    const b = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKb(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  useEffect(() => {
    if (params.ch) setCh(params.ch);
    if (params.q) {
      setQuote(params.q);
      setTimeout(() => input.current?.focus(), 300);
    }
  }, [params.ch, params.q]);

  const msgs = useMemo(() => snap.messages.filter((m) => m.channel === ch).sort((a, b) => b.at - a.at), [snap.messages, ch]);
  const unreadBy = (id: string) => snap.messages.filter((m) => m.channel === id && m.at > (s.seen[id] ?? 0) && m.author !== s.name).length;

  // отмечаем канал прочитанным — только когда чат действительно на экране
  const { markRead, toggleReaction } = team;
  useEffect(() => {
    if (!visible) return;
    const last = msgs[0]?.at ?? 0;
    if (last > (s.seen[ch] ?? 0)) set({ seen: { ...s.seen, [ch]: last } });
    markRead(ch, last);
  }, [visible, msgs, ch, s.seen, set, markRead]);

  // кто из коллег прочитал: время прочтения по этому каналу
  const readers = useMemo(() => team.reads.filter((r) => r.channel === ch && r.user_id !== team.me), [team.reads, ch, team.me]);
  const lastMineId = useMemo(() => msgs.find((m) => isMine(m))?.id, [msgs, isMine]);
  const names = useMemo(() => new Map(team.people.map((p) => [p.id, firstName(p.name)])), [team.people]);
  // реакции по сообщениям — считаем один раз на изменение, а не для каждой строки
  const rx = useMemo(() => {
    const by = new Map<string, Map<string, string[]>>();
    for (const r of team.reactions) {
      const one = by.get(r.message_id) ?? new Map<string, string[]>();
      one.set(r.emoji, [...(one.get(r.emoji) ?? []), r.user_id]);
      by.set(r.message_id, one);
    }
    const out = new Map<string, Rx>();
    for (const [id, one] of by) out.set(id, [...one.entries()].sort((a, b) => EMOJI.indexOf(a[0]) - EMOJI.indexOf(b[0])));
    return out;
  }, [team.reactions]);

  // @упоминание: подсказки по имени
  const mention = text.match(/(?:^|\s)@([A-Za-zА-Яа-яЁё0-9_-]*)$/)?.[1];
  const hints = mention != null ? [{ id: 'all', name: 'все' }, ...team.people.filter((p) => p.id !== team.me)].filter((p) => firstName(p.name).toLowerCase().startsWith(mention.toLowerCase())).slice(0, 6) : [];
  const putMention = (name: string) => {
    tap();
    setText((v) => v.replace(/@([A-Za-zА-Яа-яЁё0-9_-]*)$/, '@' + firstName(name) + ' '));
  };
  // голосовые
  const voice = useVoiceRecorder();
  const sendVoice = async () => {
    const r = await voice.stop();
    if (!r) return;
    setErr('');
    setBusy(true);
    try {
      const path = await uploadVoice(r.uri, r.ms);
      const q = quote;
      setQuote(null);
      if (await send(ch, '', q, path)) tap('success');
      else setErr('Не отправилось — проверьте связь');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Голосовое не загрузилось');
    }
    setBusy(false);
  };
  useEffect(() => {
    if (voice.tooLong) sendVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.tooLong]);
  useEffect(() => {
    if (voice.error) setErr(voice.error);
  }, [voice.error]);
  const typers = team.typing.filter((x) => x.ch === ch);
  const onType = (v: string) => {
    setText(v);
    if (!editing) team.setTyping(v.trim() ? ch : null);
  };
  const attach = async (from: 'camera' | 'library') => {
    setAttachMenu(false);
    // даём меню закрыться — иначе iPhone не откроет галерею поверх него
    await new Promise((r) => setTimeout(r, 350));
    const got = from === 'camera' ? [await pickPhoto('camera')].filter((u): u is string => !!u) : await pickPhotos(6 - photos.length);
    if (got.length) setPhotos((p) => [...p, ...got].slice(0, 6));
  };

  const submit = async () => {
    const v = text.trim();
    if (!v && !photo) return;
    if (editing) {
      if (!v) return;
      const m = editing;
      setEditing(null);
      setText('');
      if (v !== m.text && !(await editMessage(m.id, v))) {
        setEditing(m);
        setText(v);
      } else tap();
      return;
    }
    setErr('');
    const paths: string[] = [];
    if (photos.length) {
      setBusy(true);
      try {
        for (const u of photos) paths.push(await uploadPhoto(u, 'chat'));
      } catch (e) {
        setBusy(false);
        setErr(e instanceof Error ? e.message : 'Фото не загрузилось');
        return;
      }
      setBusy(false);
    }
    setText('');
    setPhotos([]);
    team.setTyping(null);
    const q = quote;
    setQuote(null);
    // несколько фото — несколько сообщений подряд, подпись у первого
    let ok = await send(ch, v, q, paths[0] ?? null);
    for (const extra of paths.slice(1)) ok = (await send(ch, '', null, extra)) && ok;
    if (!ok) {
      if (!paths.length) {
        setText(v);
        setQuote(q);
      }
      setErr('Не отправилось — проверьте связь');
    } else tap();
  };

  // реакции: двойной тап — 👍
  const lastTap = useRef<{ id: string; at: number } | null>(null);
  const onTapMsg = useCallback(
    (m: Message) => {
      const now = Date.now();
      if (lastTap.current && lastTap.current.id === m.id && now - lastTap.current.at < 320) {
        lastTap.current = null;
        tap('success');
        toggleReaction(m.id, '👍', m.userId);
      } else lastTap.current = { id: m.id, at: now };
    },
    [tap, toggleReaction],
  );
  const onReact = useCallback(
    (m: Message, e: string) => {
      tap();
      toggleReaction(m.id, e, m.userId);
    },
    [tap, toggleReaction],
  );
  const cloud = kind === 'cloud';
  const { online, me: myId } = team;
  const renderMsg = useCallback(
    ({ item: m }: { item: Message }) => {
      const me = isMine(m);
      const rb = me ? readers.filter((r) => r.at >= m.at && r.user_id !== m.userId) : NO_READERS;
      const readNames = me && m.id === lastMineId ? rb.map((r) => names.get(r.user_id) ?? '').filter(Boolean).join(', ') : '';
      return <MessageRow m={m} me={me} online={!me && !!m.userId && online.has(m.userId)} read={rb.length > 0} readNames={readNames} reactions={rx.get(m.id)} myId={myId} cloud={cloud} onTap={onTapMsg} onLong={openMenu} onOpen={setViewer} onReact={onReact} />;
    },
    [isMine, readers, lastMineId, names, online, rx, myId, cloud, onTapMsg, openMenu, onReact],
  );

  return (
    <Screen compact={kb} right={kind === 'cloud' ? <IconButton icon="phone" label="Звонки" onPress={() => router.push('/team')} /> : undefined} kicker="Команда" title="Чаты" subtitle={kind === 'local' ? 'Демо: сообщения видны только на этом телефоне' : 'Общение команды'} scroll={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
            {CHANNELS.map((c) => {
              const on = c.id === ch;
              const u = on ? 0 : unreadBy(c.id);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    tap();
                    setCh(c.id);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  {on ? (
                    <View style={{ backgroundColor: t.accent + '1F', borderWidth: 1.5, borderColor: t.accent, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8 }}>
                      <T v="b" style={{ color: t.fg, fontSize: 14 }}>
                        {c.name}
                      </T>
                    </View>
                  ) : (
                    <Glass radius={20} style={{ paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', gap: 6, alignItems: 'center' }} interactive>
                      <T v="b" style={{ color: t.dim, fontSize: 14 }}>
                        {c.name}
                      </T>
                      {u ? (
                        <View style={{ backgroundColor: t.bad, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                          <T v="b" style={{ color: '#fff', fontSize: 10 }}>
                            {u}
                          </T>
                        </View>
                      ) : null}
                    </Glass>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        <FlatList
          data={msgs}
          inverted
          keyExtractor={keyOf}
          renderItem={renderMsg}
          contentContainerStyle={LIST_PAD}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={EmptyChat}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={9}
          style={styles_flex}
        />
        <View style={{ gap: 6, paddingBottom: kb ? 8 : ins.bottom + 70 }}>
          {editing ? (
            <Glass radius={16} style={[styles.row, { paddingHorizontal: 12, paddingVertical: 8 }]}>
              <View style={{ width: 3, alignSelf: 'stretch', backgroundColor: t.accent, borderRadius: 2 }} />
              <View style={{ flex: 1 }}>
                <T v="b" style={{ fontSize: 12, color: t.accent }}>
                  Изменение сообщения
                </T>
                <T v="small" numberOfLines={1}>
                  {editing.text}
                </T>
              </View>
              <Pressable
                onPress={() => {
                  setEditing(null);
                  setText('');
                }}
                accessibilityLabel="Отменить изменение"
                hitSlop={8}
              >
                <Icon name="close" size={18} color={t.dim} />
              </Pressable>
            </Glass>
          ) : null}
          {quote ? (
            <Glass radius={16} style={[styles.row, { paddingHorizontal: 12, paddingVertical: 8 }]}>
              <View style={{ width: 3, alignSelf: 'stretch', backgroundColor: t.accent, borderRadius: 2 }} />
              <T v="small" style={{ flex: 1 }} numberOfLines={1}>
                {quote}
              </T>
              <Pressable onPress={() => setQuote(null)} accessibilityLabel="Убрать цитату" hitSlop={8}>
                <Icon name="close" size={18} color={t.dim} />
              </Pressable>
            </Glass>
          ) : null}
          {typers.length ? (
            <T v="small" style={{ paddingHorizontal: 10, fontSize: 12 }}>
              {typers.map((x) => firstName(x.name)).join(', ')} {typers.length > 1 ? 'печатают' : 'печатает'}…
            </T>
          ) : null}
          {hints.length ? (
            <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {hints.map((p) => (
                <Pressable key={p.id} onPress={() => putMention(p.name)} accessibilityRole="button" accessibilityLabel={`Упомянуть ${p.name}`}>
                  <Glass radius={16} style={{ paddingHorizontal: 12, paddingVertical: 8 }} interactive>
                    <T v="b" style={{ fontSize: 14 }}>
                      @{firstName(p.name)}
                    </T>
                  </Glass>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          {photos.length ? (
            <Glass radius={16} style={{ padding: 8, gap: 6 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={{ gap: 8 }}>
                {photos.map((u, i) => (
                  <View key={u + i}>
                    <Image source={{ uri: u }} style={{ width: 64, height: 64, borderRadius: 12 }} />
                    <Pressable onPress={() => setPhotos((p) => p.filter((_, k) => k !== i))} accessibilityLabel="Убрать фото" hitSlop={6} style={{ position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="close" size={12} color="#fff" stroke={2.6} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
              <T v="small" style={{ fontSize: 12 }}>
                {busy ? 'Загружаю фото…' : `Фото: ${photos.length}${photos.length < 6 ? ' · можно добавить ещё' : ''}`}
              </T>
            </Glass>
          ) : null}
          {err ? (
            <T v="small" style={{ color: t.bad, paddingHorizontal: 8 }}>
              {err}
            </T>
          ) : null}
          {voice.recording ? (
            <Glass radius={26} style={[styles.row, { padding: 6, paddingLeft: 16, gap: 10 }]}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.bad, opacity: Math.floor(voice.elapsed / 500) % 2 ? 0.35 : 1 }} />
              <T v="num" style={{ fontSize: 17 }}>
                {clock(voice.elapsed)}
              </T>
              <T v="small" style={{ flex: 1 }} numberOfLines={1}>
                Запись… до 5 минут
              </T>
              <Pressable
                onPress={() => {
                  tap('warning');
                  voice.cancel();
                }}
                accessibilityRole="button"
                accessibilityLabel="Отменить запись"
                style={{ paddingHorizontal: 12, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: t.field }}
              >
                <T v="b" style={{ color: t.bad, fontSize: 14 }}>
                  Отмена
                </T>
              </Pressable>
              <Pressable onPress={sendVoice} accessibilityRole="button" accessibilityLabel="Отправить голосовое" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="send" size={20} color={t.onAccent} />
              </Pressable>
            </Glass>
          ) : busy && !photo ? (
            <Glass radius={26} style={[styles.row, { padding: 14, gap: 10 }]}>
              <ActivityIndicator color={t.accent} />
              <T v="small">Отправляю голосовое…</T>
            </Glass>
          ) : (
          <Glass radius={26} style={[styles.row, { padding: 6, gap: 8 }]}>
              {editing ? null : (
                <Pressable onPress={() => { Keyboard.dismiss(); setAttachMenu(true); }} accessibilityRole="button" accessibilityLabel="Прикрепить фото" style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: t.field }}>
                  <Icon name="plus" size={22} color={t.dim} stroke={2.2} />
                </Pressable>
              )}
              <TextInput
                ref={input}
                value={text}
                onChangeText={onType}
                placeholder="Сообщение · @имя"
                placeholderTextColor={t.mute}
                multiline
                maxLength={1000}
                style={{ flex: 1, minHeight: 42, maxHeight: 120, borderRadius: 21, backgroundColor: t.field, color: t.fg, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 16, fontFamily: 'Rubik_400Regular' }}
                accessibilityLabel="Сообщение"
              />
              {!editing && !text.trim() && !photo ? (
                <Pressable
                  onPress={() => {
                    tap();
                    voice.start();
                  }}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Записать голосовое"
                  style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}
                >
                  <Icon name="mic" size={21} color={t.onAccent} stroke={2.1} />
                </Pressable>
              ) : (
                <Pressable onPress={submit} disabled={busy} accessibilityRole="button" accessibilityLabel={editing ? 'Сохранить' : 'Отправить'} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', opacity: text.trim() || photo ? 1 : 0.5 }}>
                  <Icon name={editing ? 'check' : 'send'} size={20} color={t.onAccent} stroke={editing ? 2.6 : 1.9} />
                </Pressable>
              )}
            </Glass>
          )}
        </View>
      </KeyboardAvoidingView>
      <Modal visible={!!menu} transparent animationType="fade" onRequestClose={() => setMenu(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setMenu(null)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: t.premium ? '#141417' : t.dark ? '#1C1C1F' : '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, paddingBottom: ins.bottom + 16, gap: 8 }}>
            <View style={{ padding: 12, borderRadius: 16, backgroundColor: t.card2 }}>
              <T v="small" style={{ fontSize: 12 }}>
                {menu?.author} · {menu ? fmtTime(menu) : ''}
              </T>
              <T v="body" numberOfLines={3}>
                {menu?.text}
              </T>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              {EMOJI.map((e) => {
                const on = !!menu && team.reactions.some((r) => r.message_id === menu.id && r.user_id === team.me && r.emoji === e);
                return (
                  <Pressable
                    key={e}
                    onPress={() => {
                      if (!menu) return;
                      tap('success');
                      team.toggleReaction(menu.id, e, menu.userId);
                      setMenu(null);
                    }}
                    accessibilityLabel={`Реакция ${e}`}
                    style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.accent + '33' : pressed ? t.line : t.card2, transform: [{ scale: pressed ? 1.2 : 1 }] })}
                  >
                    <T v="body" style={{ fontSize: 24 }}>
                      {e}
                    </T>
                  </Pressable>
                );
              })}
            </View>
            {[
              { key: 'reply', label: 'Ответить', icon: 'chat', show: true },
              { key: 'copy', label: 'Копировать', icon: 'orders', show: !!menu?.text },
              { key: 'task', label: 'Сделать задачей', icon: 'tasks', show: true },
              { key: 'edit', label: 'Изменить', icon: 'settings', show: !!menu && isMine(menu) && !!menu.text },
              { key: 'del', label: sure ? 'Точно удалить? Нажмите ещё раз' : 'Удалить', icon: 'close', show: !!menu && canDelete(menu), bad: true },
            ]
              .filter((o) => o.show)
              .map((o) => (
                <Pressable
                  key={o.key}
                  onPress={async () => {
                    const m = menu;
                    if (!m) return;
                    if (o.key === 'reply') {
                      setMenu(null);
                      setEditing(null);
                      setQuote(`${m.author}: ${m.text}`);
                      setTimeout(() => input.current?.focus(), 250);
                    } else if (o.key === 'copy') {
                      await Clipboard.setStringAsync(m.text).catch(() => {});
                      setMenu(null);
                      tap('success');
                    } else if (o.key === 'task') {
                      setMenu(null);
                      router.push({ pathname: '/new-task', params: { text: m.text || (isVoice(m.photo) ? 'По голосовому из чата' : 'По фото из чата'), ch: m.channel, to: isMine(m) ? undefined : m.userId } });
                    } else if (o.key === 'edit') startEdit(m);
                    else doDelete(m);
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.row, { gap: 14, paddingHorizontal: 14, paddingVertical: 15, borderRadius: 16, backgroundColor: pressed ? t.line : 'transparent' }]}
                >
                  <Icon name={o.icon} size={20} color={o.bad ? t.bad : t.fg} />
                  <T v="b" style={{ fontSize: 16, color: o.bad ? t.bad : t.fg }}>
                    {o.label}
                  </T>
                </Pressable>
              ))}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={attachMenu} transparent animationType="fade" onRequestClose={() => setAttachMenu(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setAttachMenu(false)}>
          <Pressable onPress={() => {}} style={{ backgroundColor: t.premium ? '#141417' : t.dark ? '#1C1C1F' : '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, paddingBottom: ins.bottom + 16, gap: 4 }}>
            {[
              { key: 'library' as const, label: 'Фото из галереи', sub: 'можно выбрать до 6 сразу', icon: 'image' },
              { key: 'camera' as const, label: 'Снять на камеру', sub: 'сфотографировать сейчас', icon: 'camera' },
            ].map((o) => (
              <Pressable key={o.key} onPress={() => attach(o.key)} accessibilityRole="button" style={({ pressed }) => [styles.row, { gap: 14, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 16, backgroundColor: pressed ? t.line : 'transparent' }]}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.accent + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={o.icon} size={22} color={t.accent} />
                </View>
                <View>
                  <T v="b" style={{ fontSize: 16 }}>
                    {o.label}
                  </T>
                  <T v="small">{o.sub}</T>
                </View>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }} onPress={() => setViewer(null)} accessibilityLabel="Закрыть фото">
          {viewer ? <Image source={{ uri: viewer }} style={{ width: '100%', height: '80%' }} resizeMode="contain" /> : null}
          <View style={{ position: 'absolute', top: ins.top + 12, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={20} color="#fff" />
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}
