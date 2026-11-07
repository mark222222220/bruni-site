import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner, Bar, Button, Empty, Item, List, Screen, Segmented, Stepper, T } from '@/components/ui';
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
    <Screen title="Склад" subtitle="Остатки и заявка поставщику">
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
        <>
          <List>
            {items.length ? (
              items.map((x, i) => {
                const isLow = x.qty <= x.min;
                return (
                  <Item
                    key={x.id}
                    first={i === 0}
                    title={x.name}
                    sub={
                      <T v="small" style={isLow ? { color: t.bad } : undefined}>
                        {fmt(x.qty)} {x.unit} · мин. {fmt(x.min)}
                      </T>
                    }
                    right={<Stepper label={`Остаток ${x.name}`} value={x.qty} onChange={(v) => v !== x.qty && patch('stock', x.id, { qty: v })} />}
                  >
                    <View style={{ marginTop: 6 }}>
                      <Bar value={(x.qty / (x.min * 2)) * 100} color={isLow ? t.bad : t.ok} />
                    </View>
                  </Item>
                );
              })
            ) : (
              <Empty text="Материалов пока нет." />
            )}
          </List>
          <T v="small" style={{ textAlign: 'center' }}>
            Изменения сохраняются сразу и видны всем
          </T>
        </>
      ) : low.length ? (
        <>
          <List>
            {low.map((x, i) => (
              <Item
                key={x.id}
                first={i === 0}
                title={x.name}
                sub={`сейчас ${fmt(x.qty)} · мин. ${fmt(x.min)} · кратно ${fmt(x.pack)}`}
                right={
                  <T v="num">
                    {fmt(needToOrder(x))} {x.unit}
                  </T>
                }
              />
            ))}
          </List>
          <View style={{ flexDirection: 'row' }}>
            <Button title="Отправить заявку в чат «Склад»" icon="send" onPress={sendOrder} />
          </View>
        </>
      ) : (
        <List>
          <Empty text="Всего хватает — заявка пустая." />
        </List>
      )}
    </Screen>
  );
}
