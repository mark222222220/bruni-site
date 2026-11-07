import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Appear, Bar, Button, Card, Empty, Pill, Ring, Screen, T, styles } from '@/components/ui';
import { useData, useDerived } from '@/lib/data';
import { fmt } from '@/lib/format';
import { useSettings } from '@/lib/settings';

export function MarginScreen({ back }: { back?: boolean }) {
  const { snap } = useData();
  const { avgMargin } = useDerived();
  const { s, t, set, tap } = useSettings();
  // ползунок двигается по локальному значению, в настройки пишем по отпусканию
  const [live, setLive] = useState<number | null>(null);
  const thr = live ?? s.thr;
  const total = snap.clients.reduce((a, c) => a + c.rev, 0) || 1;
  const below = snap.clients.filter((c) => c.work < thr);
  const list = snap.clients.slice().sort((a, b) => b.rev - a.rev);

  return (
    <Screen kicker="Маржа" title="Кто приносит деньги" back={back}>
      <Appear>
        <Card style={{ gap: 14 }}>
          <View style={[styles.row, { gap: 16 }]}>
            <Ring value={avgMargin / 50} size={96} stroke={9} color={avgMargin < thr ? t.bad : undefined}>
              <T v="num" style={{ fontSize: 22 }}>
                {fmt(avgMargin)}%
              </T>
            </Ring>
            <View style={{ flex: 1, gap: 4 }}>
              <T v="label">Средняя маржа</T>
              <T v="b">после материалов и работы</T>
              <T v="small">
                {below.length ? `${below.length} клиента ниже порога — ${fmt(below.reduce((a, c) => a + c.rev, 0), 1)} млн/мес оборота` : 'Все клиенты выше порога'}
              </T>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: t.line }} />
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <T v="label">Порог маржи</T>
            <T v="big" style={{ fontSize: 26, color: t.accent }}>
              {thr}%
            </T>
          </View>
          <Slider
            style={{ height: 40, marginHorizontal: -6 }}
            minimumValue={0}
            maximumValue={50}
            step={1}
            value={s.thr}
            onValueChange={(v) => {
              const r = Math.round(v);
              if (r !== thr) tap();
              setLive(r);
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
          <View style={[styles.row, { justifyContent: 'space-between', marginTop: -6 }]}>
            <T v="small">0%</T>
            <T v="small">25%</T>
            <T v="small">50%</T>
          </View>
        </Card>
      </Appear>
      {list.length ? (
        list.map((c, i) => {
          const low = c.work < thr;
          const good = c.work >= thr + 20;
          return (
            <Appear key={c.id} i={i + 1}>
              <Card onPress={() => router.push({ pathname: '/client/[id]', params: { id: c.id } })} tone={low ? 'bad' : undefined} style={{ gap: 10 }}>
                <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={[styles.row, { gap: 6, flexWrap: 'wrap' }]}>
                      <T v="b" style={{ fontSize: 16 }}>
                        {c.name}
                      </T>
                      {c.example ? <Pill text="пример" /> : null}
                    </View>
                    <T v="small">
                      {c.kind}
                      {c.city ? ` · ${c.city}` : ''}
                    </T>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <T v="big" style={{ fontSize: 28, color: low ? t.bad : good ? t.ok : t.fg }}>
                      {fmt(c.work)}%
                    </T>
                    <Pill text={low ? 'поднять цену' : good ? 'беречь' : 'держать'} tone={low ? 'bad' : good ? 'ok' : 'neutral'} />
                  </View>
                </View>
                <Bar value={c.work * 2} color={low ? t.bad : undefined} height={7} />
                <T v="small">
                  <T v="b" style={{ fontSize: 13, color: t.fg }}>
                    {fmt(c.rev, 1)} млн/мес
                  </T>
                  {` · ${fmt((c.rev / total) * 100)}% оборота · после материалов ${fmt(c.mat)}%`}
                </T>
              </Card>
            </Appear>
          );
        })
      ) : (
        <Card>
          <Empty text="Клиентов пока нет." />
        </Card>
      )}
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        <Button title="Добавить клиента" icon="plus" kind="ghost" onPress={() => router.push({ pathname: '/client/[id]', params: { id: 'new' } })} />
      </View>
    </Screen>
  );
}
