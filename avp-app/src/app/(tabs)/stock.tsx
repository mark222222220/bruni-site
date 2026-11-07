import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Appear, Banner, Bar, Button, Card, CountUp, Empty, IconBadge, Pill, Screen, Segmented, Stepper, T, styles } from '@/components/ui';
import { needToOrder, useData, useDerived } from '@/lib/data';
import { fmt } from '@/lib/format';
import { useSettings } from '@/lib/settings';

export default function Stock() {
  const { snap, patch, send, loading } = useData();
  const { low } = useDerived();
  const { t, tap } = useSettings();
  const [mode, setMode] = useState<'left' | 'order'>('left');
  const items = snap.stock.slice().sort((a, b) => a.sort - b.sort);

  const sendOrder = async () => {
    const text = 'Заявка поставщику на четверг:\n' + low.map((x) => `• ${x.name} — ${fmt(needToOrder(x))} ${x.unit}`).join('\n');
    if (await send('stock', text)) {
      tap('success');
      router.navigate({ pathname: '/chat', params: { ch: 'stock' } });
    }
  };

  return (
    <Screen kicker="Склад и закупки" title={mode === 'left' ? 'Остатки' : 'Заявка'} subtitle={mode === 'left' ? `${items.length} материалов` : 'Собирается сама по минимумам'}>
      <Appear>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Card tone={low.length ? 'bad' : 'ok'}>
              <T v="label">Ниже минимума</T>
              <CountUp value={low.length} format={(n) => fmt(n)} style={{ color: low.length ? t.bad : t.ok }} />
              <T v="small">{low.length ? 'нужно заказать' : 'всего хватает'}</T>
            </Card>
          </View>
          <View style={{ flex: 1 }}>
            <Card>
              <T v="label">В норме</T>
              <CountUp value={items.length - low.length} format={(n) => fmt(n)} />
              <T v="small">из {items.length} позиций</T>
            </Card>
          </View>
        </View>
      </Appear>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'left', label: 'Остатки' },
          { value: 'order', label: low.length ? `Заявка · ${low.length}` : 'Заявка' },
        ]}
      />
      {loading ? <Banner text="Загружаю остатки…" /> : null}
      {mode === 'left' ? (
        items.length ? (
          items.map((x, i) => {
            const isLow = x.qty <= x.min;
            const p = (x.qty / (x.min * 2)) * 100;
            return (
              <Appear key={x.id} i={i + 1}>
                <Card tone={isLow ? 'bad' : undefined} style={{ gap: 12 }}>
                  <View style={[styles.row, { justifyContent: 'space-between' }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T v="b">{x.name}</T>
                      <T v="small">мин. {fmt(x.min)} · упаковка {fmt(x.pack)}</T>
                    </View>
                    {isLow ? <Pill text="ниже минимума" tone="bad" /> : null}
                  </View>
                  <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'flex-end' }]}>
                    <View style={[styles.row, { alignItems: 'flex-end', gap: 6 }]}>
                      <T v="big" style={{ fontSize: 30, color: isLow ? t.bad : t.fg }}>
                        {fmt(x.qty)}
                      </T>
                      <T v="small" style={{ marginBottom: 5 }}>
                        {x.unit}
                      </T>
                    </View>
                    <Stepper label={`Остаток ${x.name}`} value={x.qty} onChange={(v) => v !== x.qty && patch('stock', x.id, { qty: v })} />
                  </View>
                  <Bar value={p} color={isLow ? t.bad : undefined} height={7} />
                </Card>
              </Appear>
            );
          })
        ) : (
          <Card>
            <Empty text="Материалов пока нет." />
          </Card>
        )
      ) : low.length ? (
        <>
          {low.map((x, i) => (
            <Appear key={x.id} i={i + 1}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconBadge icon="box" tone="accent" />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="b">{x.name}</T>
                  <T v="small">
                    сейчас {fmt(x.qty)} · мин. {fmt(x.min)} · кратно {fmt(x.pack)}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T v="num" style={{ color: t.accent }}>
                    {fmt(needToOrder(x))}
                  </T>
                  <T v="small">{x.unit}</T>
                </View>
              </Card>
            </Appear>
          ))}
          <View style={{ flexDirection: 'row', marginTop: 4 }}>
            <Button title="Отправить в чат «Склад»" icon="send" onPress={sendOrder} />
          </View>
        </>
      ) : (
        <Card>
          <Empty text="Всего хватает — заявка пустая." />
        </Card>
      )}
    </Screen>
  );
}
