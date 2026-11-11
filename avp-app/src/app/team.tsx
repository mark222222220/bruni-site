import { Platform, Pressable, View } from 'react-native';
import { Appear, Avatar, Banner, Card, Empty, Icon, Screen, T, styles } from '@/components/ui';
import { useCalls } from '@/lib/calls';
import { useSettings } from '@/lib/settings';
import { useTeam } from '@/lib/team';
import { ROLES } from '@/lib/types';

/** Команда: позвонить коллеге голосом или с видео — прямо в приложении. */
export default function Team() {
  const { t, tap } = useSettings();
  const { people, me, online } = useTeam();
  const { startCall } = useCalls();
  const others = people.filter((p) => p.id !== me).sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id)) || a.name.localeCompare(b.name));
  const call = (p: { id: string; name: string }, video: boolean) => {
    tap('success');
    startCall(p, video);
  };
  const round = (icon: string, label: string, onPress: () => void, accent?: boolean) => (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: accent ? t.accent : t.field, opacity: pressed ? 0.7 : 1 })}>
      <Icon name={icon} size={21} color={accent ? t.onAccent : t.fg} stroke={2} />
    </Pressable>
  );
  return (
    <Screen kicker="Команда" title="Звонки" subtitle="Голос и видео идут напрямую между телефонами" back>
      {Platform.OS === 'web' ? <Banner text="Звонки работают в приложении на телефоне." /> : null}
      {others.length ? (
        others.map((p, i) => {
          const on = online.has(p.id);
          return (
            <Appear key={p.id} i={i}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View>
                  <Avatar name={p.name} size={44} />
                  {on ? <View style={{ position: 'absolute', right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7, backgroundColor: t.ok, borderWidth: 2, borderColor: t.bg }} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <T v="b">{p.name}</T>
                  <T v="small" style={on ? { color: t.ok } : undefined}>
                    {ROLES[p.role]?.name} · {on ? 'в приложении' : 'не в сети — придёт уведомление'}
                  </T>
                </View>
                <View style={[styles.row, { gap: 8 }]}>
                  {round('video', `Видеозвонок: ${p.name}`, () => call(p, true))}
                  {round('phone', `Позвонить: ${p.name}`, () => call(p, false), true)}
                </View>
              </Card>
            </Appear>
          );
        })
      ) : (
        <Card>
          <Empty text="В команде пока никого, кроме вас." />
        </Card>
      )}
      <T v="small" style={{ textAlign: 'center' }}>
        Если у коллеги приложение закрыто, ему на экран придёт «Входящий звонок» — нажал, и можно отвечать (есть 45 секунд). Не успел — останется «Пропущенный звонок».
      </T>
    </Screen>
  );
}
