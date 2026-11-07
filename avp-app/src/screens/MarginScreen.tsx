import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Bar, Button, Card, Empty, Item, List, Pill, Screen, T, styles } from '@/components/ui';
import { useData } from '@/lib/data';
import { fmt } from '@/lib/format';
import { useSettings } from '@/lib/settings';

export function MarginScreen({ back }: { back?: boolean }) {
  const { snap } = useData();
  const { s, t, set, tap } = useSettings();
  // ползунок двигается плавно по локальному значению, в настройки пишем по отпусканию
  const [live, setLive] = useState<number | null>(null);
  const thr = live ?? s.thr;
  const total = snap.clients.reduce((a, c) => a + c.rev, 0) || 1;
  const below = snap.clients.filter((c) => c.work < thr).length;
  const list = snap.clients.slice().sort((a, b) => b.rev - a.rev);

  return (
    <Screen title="Маржа" subtitle="Кто приносит деньги" back={back}>
      <Card>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <T v="b">Порог маржи</T>
          <View style={[styles.row, { gap: 8 }]}>
            <T v="num">{thr}%</T>
            <Pill text={below ? `ниже: ${below}` : 'все выше'} tone={below ? 'bad' : 'ok'} />
          </View>
        </View>
        <Slider
          style={{ height: 40 }}
          minimumValue={0}
          maximumValue={50}
          step={1}
          value={s.thr}
          onValueChange={(v) => {
            if (Math.round(v) !== live) tap();
            setLive(Math.round(v));
          }}
          onSlidingComplete={(v) => {
            set({ thr: Math.round(v) });
            setLive(null);
          }}
          minimumTrackTintColor={t.accent}
          maximumTrackTintColor={t.card2}
          thumbTintColor="#FFFFFF"
          accessibilityLabel="Порог маржи"
        />
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <T v="small">0%</T>
          <T v="small">25%</T>
          <T v="small">50%</T>
        </View>
      </Card>
      <List>
        {list.length ? (
          list.map((c, i) => {
            const low = c.work < thr;
            const good = c.work >= thr + 20;
            return (
              <Item
                key={c.id}
                first={i === 0}
                onPress={() => router.push({ pathname: '/client/[id]', params: { id: c.id } })}
                title={
                  <View style={[styles.row, { gap: 6, flexWrap: 'wrap' }]}>
                    <T v="b">{c.name}</T>
                    {c.example ? <Pill text="пример" /> : null}
                  </View>
                }
                sub={`${c.kind}${c.city ? ' · ' + c.city : ''} · ${fmt(c.rev, 1)} млн/мес · ${fmt((c.rev / total) * 100)}% оборота`}
                right={
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <T v="num" style={low ? { color: t.bad } : undefined}>
                      {fmt(c.work)}%
                    </T>
                    <Pill text={low ? 'поднять цену' : good ? 'беречь' : 'держать'} tone={low ? 'bad' : good ? 'ok' : 'neutral'} />
                  </View>
                }
              >
                <View style={{ marginTop: 6 }}>
                  <Bar value={c.work * 2} color={low ? t.bad : t.accent} />
                </View>
              </Item>
            );
          })
        ) : (
          <Empty text="Клиентов пока нет." />
        )}
      </List>
      <View style={{ flexDirection: 'row' }}>
        <Button title="Добавить клиента" icon="plus" kind="ghost" onPress={() => router.push({ pathname: '/client/[id]', params: { id: 'new' } })} />
      </View>
      <T v="small" style={{ textAlign: 'center' }}>
        Маржа после работы — выручка минус материалы и труд. Нажмите на клиента, чтобы изменить.
      </T>
    </Screen>
  );
}
