import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Fill, Glass, Icon, IconButton, Screen, T, styles } from '@/components/ui';
import { MEET_RE } from '@/lib/team';
import { useData } from '@/lib/data';
import { useSettings } from '@/lib/settings';
import { CHANNELS, ROLES, type Message } from '@/lib/types';

function JoinButton({ url, dark }: { url: string; dark?: boolean }) {
  const { t, tap } = useSettings();
  return (
    <Pressable
      onPress={() => {
        tap('success');
        Linking.openURL(url).catch(() => {});
      }}
      accessibilityRole="button"
      style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: dark ? 'rgba(17,17,19,0.85)' : t.accent }}
    >
      <Icon name="video" size={18} color={dark ? t.accent2 : t.onAccent} />
      <T v="b" style={{ color: dark ? t.accent2 : t.onAccent, fontSize: 14 }}>
        Присоединиться
      </T>
    </Pressable>
  );
}

export default function Chat() {
  const params = useLocalSearchParams<{ ch?: string; q?: string }>();
  const { snap, send, kind } = useData();
  const { s, t, set, tap } = useSettings();
  const ins = useSafeAreaInsets();
  const [ch, setCh] = useState(params.ch ?? 'general');
  const [quote, setQuote] = useState<string | null>(params.q ?? null);
  const [text, setText] = useState('');
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [kb, setKb] = useState(false);
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
  }, [msgs, ch, s.seen, set]);

  const submit = async () => {
    const v = text.trim();
    if (!v) return;
    setText('');
    const q = quote;
    setQuote(null);
    if (!(await send(ch, v, q))) {
      setText(v);
      setQuote(q);
    } else tap();
  };

  const renderMsg = ({ item: m }: { item: Message }) => {
    const me = m.author === s.name;
    return (
      <View style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '86%', marginVertical: 4 }}>
        {me ? (
          <View style={{ borderRadius: 20, borderTopRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10, gap: 3, overflow: 'hidden', zIndex: 0 }}>
            <Fill colors={[t.accent2, t.accent, t.accent3]} vertical={false} />
            {m.quote ? <T v="small" style={{ color: t.onAccent, opacity: 0.75, borderLeftWidth: 3, borderLeftColor: t.onAccent, paddingLeft: 8 }}>{m.quote}</T> : null}
            <T v="body" style={{ color: t.onAccent }} selectable>
              {m.text.replace(MEET_RE, '').trim()}
            </T>
            {MEET_RE.test(m.text) ? <JoinButton url={m.text.match(MEET_RE)![0]} dark /> : null}
            <T v="small" style={{ color: t.onAccent, opacity: 0.7, fontSize: 11, alignSelf: 'flex-end' }}>
              {new Date(m.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </T>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <Avatar name={m.author} />
            <Glass radius={20} style={{ borderBottomLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 10, gap: 4, flexShrink: 1 }}>
              <T v="small" style={{ fontSize: 12 }}>
                <T v="b" style={{ fontSize: 12, color: t.accent2 }}>
                  {m.author}
                </T>
                {`  ${ROLES[m.role]?.name ?? ''} · ${new Date(m.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`}
              </T>
              {m.quote ? <T v="small" style={{ borderLeftWidth: 3, borderLeftColor: t.accent, paddingLeft: 8 }}>{m.quote}</T> : null}
              <T v="body" selectable>
                {m.text.replace(MEET_RE, '').trim()}
              </T>
              {MEET_RE.test(m.text) ? <JoinButton url={m.text.match(MEET_RE)![0]} /> : null}
            </Glass>
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen compact={kb} right={kind === 'cloud' ? <IconButton icon="phone" label="Звонки и видеосовещание" onPress={() => router.push('/team')} /> : undefined} kicker="Команда" title="Чаты" subtitle={kind === 'local' ? 'Демо: сообщения видны только на этом телефоне' : 'Общение команды'} scroll={false}>
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
          <Glass radius={26} style={[styles.row, { padding: 6, gap: 8 }]}>
            <TextInput
              ref={input}
              value={text}
              onChangeText={setText}
              placeholder="Сообщение"
              placeholderTextColor={t.mute}
              multiline
              maxLength={1000}
              style={{ flex: 1, minHeight: 42, maxHeight: 120, borderRadius: 21, backgroundColor: t.field, color: t.fg, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 16, fontFamily: 'Rubik_400Regular' }}
              accessibilityLabel="Сообщение"
            />
            <Pressable onPress={submit} accessibilityRole="button" accessibilityLabel="Отправить" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', opacity: text.trim() ? 1 : 0.5 }}>
              <Icon name="send" size={20} color={t.onAccent} />
            </Pressable>
          </Glass>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
