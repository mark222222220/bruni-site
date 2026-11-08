import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { Appear, Avatar, Banner, Button, Card, Icon, Pill, Screen, Section, T, styles } from '@/components/ui';
import { useCalls } from '@/lib/calls';
import { useData } from '@/lib/data';
import { useSettings } from '@/lib/settings';
import { meetingUrl, normPhone, useTeam } from '@/lib/team';
import { ROLES } from '@/lib/types';

/** Команда: звонки и FaceTime конкретному сотруднику, видеосовещание с выбранными. */
export default function Team() {
  const { s, t, tap } = useSettings();
  const { send } = useData();
  const { team, loading } = useTeam();
  const { startCall } = useCalls();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [err, setErr] = useState('');
  const others = team.filter((m) => m.name !== s.name);

  const open = async (url: string) => {
    tap();
    try {
      await Linking.openURL(url);
    } catch {
      setErr('Не получилось открыть звонок на этом устройстве');
    }
  };
  const toggle = (id: string) => {
    tap();
    setPicked((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const startMeeting = async () => {
    const names = others.filter((m) => picked.has(m.id)).map((m) => m.name);
    const { url } = meetingUrl(s.name);
    const ok = await send('general', `📹 Видеосовещание — ${s.name} зовёт: ${names.join(', ')}\nНажмите «Присоединиться».\n${url}`);
    if (!ok) {
      setErr('Не получилось отправить приглашение в чат');
      return;
    }
    tap('success');
    setPicked(new Set());
    await Linking.openURL(url).catch(() => {});
    router.navigate({ pathname: '/chat', params: { ch: 'general' } });
  };

  return (
    <Screen kicker="Команда" title="Звонки" subtitle="Звонок внутри AVP по Wi-Fi или интернету" back>
      {err ? <Banner tone="bad" text={err} /> : null}
      {loading ? <Banner text="Загружаю команду…" /> : null}
      {others.map((m, i) => {
        const ph = normPhone(m.phone);
        const on = picked.has(m.id);
        return (
          <Appear key={m.id} i={i}>
            <Card style={{ gap: 12, borderColor: on ? t.accent : undefined }}>
              <View style={[styles.row, { gap: 12 }]}>
                <Pressable onPress={() => toggle(m.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`Позвать ${m.name} на видеосовещание`} hitSlop={8}>
                  <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <Icon name="check" size={16} color={t.onAccent} stroke={3} /> : null}
                  </View>
                </Pressable>
                <Avatar name={m.name} size={42} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="b" style={{ fontSize: 16 }}>
                    {m.name}
                  </T>
                  <T v="small">{ph || 'номер не указан'}</T>
                </View>
                <Pill text={ROLES[m.role]?.name ?? ''} tone={m.role === 'boss' ? 'accent' : 'neutral'} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button title="Звонок" icon="phone" onPress={() => startCall({ id: m.id, name: m.name }, false)} />
                <Button title="Видео" icon="video" onPress={() => startCall({ id: m.id, name: m.name }, true)} />
              </View>
              {ph ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button title="По телефону" icon="phone" kind="ghost" onPress={() => open(`tel:${ph}`)} />
                  {Platform.OS === 'ios' ? <Button title="FaceTime" icon="video" kind="ghost" onPress={() => open(`facetime:${ph}`)} /> : null}
                </View>
              ) : (
                <T v="small">Звонок и видео — через интернет внутри AVP. Для обычного звонка {m.name} нужно вписать номер в «Настройки → Мой телефон».</T>
              )}
            </Card>
          </Appear>
        );
      })}
      {!loading && !others.length ? <Banner text="В команде пока никого, кроме вас." /> : null}

      <Section>Видеосовещание</Section>
      <Card tone="accent" style={{ gap: 10 }}>
        <T v="b">{picked.size ? `Выбрано: ${picked.size}` : 'Отметьте галочками, кого позвать'}</T>
        <T v="small">Выбранным придёт приглашение в «Общий» чат с кнопкой «Присоединиться». Видео откроется в браузере через Jitsi Meet — ничего ставить не нужно.</T>
      </Card>
      <View style={{ flexDirection: 'row' }}>
        <Button title="Начать видеосовещание" icon="video" disabled={!picked.size} onPress={startMeeting} />
      </View>
    </Screen>
  );
}
