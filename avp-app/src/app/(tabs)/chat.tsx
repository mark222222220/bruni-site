import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import * as Clipboard from 'expo-clipboard';
import { ActivityIndicator, FlatList, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Fill, Glass, Icon, Screen, T, styles } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { pickPhoto, uploadPhoto, usePhotoUrl } from '@/lib/photos';
import { useSettings } from '@/lib/settings';
import { firstName, useTeam } from '@/lib/team';
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
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [viewer, setViewer] = useState<string | null>(null);
  const team = useTeam();
  const isMine = (m: Message) => (m.userId && profile ? m.userId === profile.id : m.author === s.name);
  const canDelete = (m: Message) => isMine(m) || s.role === 'boss';
  const fmtTime = (m: Message) => new Date(m.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + (m.editedAt ? ' · изм.' : '');
  const openMenu = (m: Message) => {
    tap();
    setSure(false);
    setMenu(m);
  };
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

  // отмечаем канал прочитанным
  useEffect(() => {
    const last = msgs[0]?.at ?? 0;
    if (last > (s.seen[ch] ?? 0)) set({ seen: { ...s.seen, [ch]: last } });
    team.markRead(ch, last);
  }, [msgs, ch, s.seen, set, team.markRead]);

  // кто из коллег прочитал: время прочтения по этому каналу
  const readers = team.reads.filter((r) => r.channel === ch && r.user_id !== team.me);
  const readBy = (m: Message) => readers.filter((r) => r.at >= m.at && r.user_id !== m.userId);
  const lastMine = msgs.find((m) => isMine(m));
  const nameOf = (id: string) => firstName(team.people.find((p) => p.id === id)?.name ?? '');

  // @упоминание: подсказки по имени
  const mention = text.match(/(?:^|\s)@([A-Za-zА-Яа-яЁё0-9_-]*)$/)?.[1];
  const hints = mention != null ? [{ id: 'all', name: 'все' }, ...team.people.filter((p) => p.id !== team.me)].filter((p) => firstName(p.name).toLowerCase().startsWith(mention.toLowerCase())).slice(0, 6) : [];
  const putMention = (name: string) => {
    tap();
    setText((v) => v.replace(/@([A-Za-zА-Яа-яЁё0-9_-]*)$/, '@' + firstName(name) + ' '));
  };
  const attach = async (from: 'camera' | 'library') => {
    const uri = await pickPhoto(from);
    if (uri) setPhoto(uri);
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
    let path: string | null = null;
    if (photo) {
      setBusy(true);
      try {
        path = await uploadPhoto(photo, 'chat');
      } catch (e) {
        setBusy(false);
        setErr(e instanceof Error ? e.message : 'Фото не загрузилось');
        return;
      }
      setBusy(false);
    }
    setText('');
    setPhoto(null);
    const q = quote;
    setQuote(null);
    if (!(await send(ch, v, q, path))) {
      setText(v);
      setQuote(q);
      setErr('Не отправилось — проверьте связь');
    } else tap();
  };

  const renderMsg = ({ item: m }: { item: Message }) => {
    const me = isMine(m);
    return (
      <Pressable onLongPress={() => openMenu(m)} delayLongPress={350} style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '86%', marginVertical: 4 }}>
        {me ? (
          <View>
          <View style={{ borderRadius: 20, borderTopRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10, gap: 3, overflow: 'hidden', zIndex: 0 }}>
            <Fill colors={[t.accent2, t.accent, t.accent3]} vertical={false} />
            {m.quote ? <T v="small" style={{ color: t.onAccent, opacity: 0.75, borderLeftWidth: 3, borderLeftColor: t.onAccent, paddingLeft: 8 }}>{m.quote}</T> : null}
            {m.photo ? <Photo path={m.photo} onOpen={setViewer} /> : null}
            {m.text ? <Rich text={m.text} color={t.onAccent} accent={t.onAccent} /> : null}
            <T v="small" style={{ color: t.onAccent, opacity: 0.7, fontSize: 11, alignSelf: 'flex-end' }}>
              {fmtTime(m)}
              {kind === 'cloud' ? (readBy(m).length ? '  ✓✓' : '  ✓') : ''}
            </T>
          </View>
          {m.id === lastMine?.id && readBy(m).length ? (
            <T v="small" style={{ fontSize: 11, alignSelf: 'flex-end', marginTop: 3 }}>
              Прочитали: {readBy(m).map((r) => nameOf(r.user_id)).filter(Boolean).join(', ')}
            </T>
          ) : null}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <Avatar name={m.author} />
            <Glass radius={20} style={{ borderBottomLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 10, gap: 4, flexShrink: 1 }}>
              <T v="small" style={{ fontSize: 12 }}>
                <T v="b" style={{ fontSize: 12, color: t.accent2 }}>
                  {m.author}
                </T>
                {`  ${ROLES[m.role]?.name ?? ''} · ${fmtTime(m)}`}
              </T>
              {m.quote ? <T v="small" style={{ borderLeftWidth: 3, borderLeftColor: t.accent, paddingLeft: 8 }}>{m.quote}</T> : null}
              {m.photo ? <Photo path={m.photo} onOpen={setViewer} /> : null}
              {m.text ? <Rich text={m.text} color={t.fg} accent={t.accent2} /> : null}
            </Glass>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Screen compact={kb} kicker="Команда" title="Чаты" subtitle={kind === 'local' ? 'Демо: сообщения видны только на этом телефоне' : 'Общение команды'} scroll={false}>
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
          keyExtractor={(m) => m.id}
          renderItem={renderMsg}
          contentContainerStyle={{ paddingVertical: 12 }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={{ transform: [{ scaleY: -1 }], padding: 28 }}>
              <T v="small" style={{ textAlign: 'center' }}>
                В канале пока тихо. Напишите первое сообщение.
              </T>
            </View>
          }
          style={{ flex: 1 }}
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
          {photo ? (
            <Glass radius={16} style={[styles.row, { padding: 8, gap: 10 }]}>
              <Image source={{ uri: photo }} style={{ width: 56, height: 56, borderRadius: 10 }} />
              <T v="small" style={{ flex: 1 }}>
                {busy ? 'Загружаю фото…' : 'Фото будет отправлено'}
              </T>
              <Pressable onPress={() => setPhoto(null)} accessibilityLabel="Убрать фото" hitSlop={8}>
                <Icon name="close" size={18} color={t.dim} />
              </Pressable>
            </Glass>
          ) : null}
          {err ? (
            <T v="small" style={{ color: t.bad, paddingHorizontal: 8 }}>
              {err}
            </T>
          ) : null}
          <Glass radius={26} style={[styles.row, { padding: 6, gap: 8 }]}>
            {editing ? null : (
              <Pressable onPress={() => attach('camera')} onLongPress={() => attach('library')} accessibilityRole="button" accessibilityLabel="Фото: нажмите — камера, удерживайте — галерея" style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: t.field }}>
                <Icon name="camera" size={21} color={t.dim} />
              </Pressable>
            )}
            <TextInput
              ref={input}
              value={text}
              onChangeText={setText}
              placeholder="Сообщение · @имя"
              placeholderTextColor={t.mute}
              multiline
              maxLength={1000}
              style={{ flex: 1, minHeight: 42, maxHeight: 120, borderRadius: 21, backgroundColor: t.field, color: t.fg, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 16, fontFamily: 'Rubik_400Regular' }}
              accessibilityLabel="Сообщение"
            />
            <Pressable onPress={submit} disabled={busy} accessibilityRole="button" accessibilityLabel={editing ? 'Сохранить' : 'Отправить'} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', opacity: text.trim() || photo ? 1 : 0.5 }}>
              <Icon name={editing ? 'check' : 'send'} size={20} color={t.onAccent} stroke={editing ? 2.6 : 1.9} />
            </Pressable>
          </Glass>
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
                      router.push({ pathname: '/new-task', params: { text: m.text || 'По фото из чата', ch: m.channel, to: isMine(m) ? undefined : m.userId } });
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
