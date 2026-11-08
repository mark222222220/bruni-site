import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Appear, Banner, Bar, Button, Card, CountUp, Empty, IconBadge, Pill, Screen, Segmented, Stepper, T, styles } from '@/components/ui';
import { isLow, needToOrder, useData, useDerived } from '@/lib/data';
import { money } from '@/lib/format';
import { fmt } from '@/lib/format';
import { useSettings } from '@/lib/settings';

export default function Stock() {
  const { snap, patch, send, loading } = useData();
  const { low } = useDerived();
  const { t, tap } = useSettings();
  const [mode, setMode] = useState<'left' | 'order'>('left');
  const all = snap.stock.slice().sort((a, b) => a.sort - b.sort);
  const items = all.filter((x) => x.status !== 'Нет расхода');
  const idle = all.length - items.length;
  const sheet = all.some((x) => x.fromSheet);
  const total = all.reduce((a, x) => a + (x.value ?? 0), 0);

  const sendOrder = async () => {
    const text = 'Заявка поставщику:\n' + low.map((x) => `• ${x.name} — ${fmt(needToOrder(x) || Math.ceil(x.weekly ?? 0))} ${x.unit}`).join('\n');
    if (await send('stock', text)) {
      tap('success');
      router.navigate({ pathname: '/chat', params: { ch: 'stock' } });
    }
  };

  return (
    <Screen kicker="Склад и закупки" title={mode === 'left' ? 'Остатки' : 'Заявка'} subtitle={mode === 'left' ? (sheet ? `${items.length} в работе · склад на ${money(total)} ₽` : `${items.length} материалов`) : sheet ? 'По расходу из таблицы' : 'Собирается сама по минимумам'}>
      <Appear>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Card tone={low.length ? 'bad' : 'ok'}>
              <T v="label">{sheet ? 'Мало на складе' : 'Ниже минимума'}</T>
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
            const low = isLow(x);
            const p = x.days != null ? Math.min(100, (x.days / 30) * 100) : (x.qty / (x.min * 2)) * 100;
            return (
              <Appear key={x.id} i={i + 1}>
                <Card tone={low ? 'bad' : undefined} style={{ gap: 12 }}>
                  <View style={[styles.row, { justifyContent: 'space-between' }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T v="b">{x.name}</T>
                      <T v="small" numberOfLines={1}>
                        {x.fromSheet ? `${x.group} · ${(x.supplier ?? '').split('(')[0].trim()}` : `мин. ${fmt(x.min)} · упаковка ${fmt(x.pack)}`}
                      </T>
                    </View>
                    {low ? <Pill text={x.fromSheet ? 'мало' : 'ниже минимума'} tone="bad" /> : null}
                  </View>
                  <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'flex-end' }]}>
                    <View style={[styles.row, { alignItems: 'flex-end', gap: 6 }]}>
                      <T v="big" style={{ fontSize: 30, color: low ? t.bad : t.fg }}>
                        {fmt(x.qty, x.qty % 1 ? 1 : 0)}
                      </T>
                      <T v="small" style={{ marginBottom: 5 }}>
                        {x.unit}
                      </T>
                    </View>
                    {x.fromSheet ? (
                      <View style={{ alignItems: 'flex-end' }}>
                        <T v="num" style={{ color: low ? t.bad : t.fg }}>
                          {x.days != null ? `${fmt(x.days, x.days < 10 ? 1 : 0)} дн.` : '—'}
                        </T>
                        <T v="small">хватит</T>
                      </View>
                    ) : (
                      <Stepper label={`Остаток ${x.name}`} value={x.qty} onChange={(v) => v !== x.qty && patch('stock', x.id, { qty: v })} />
                    )}
                  </View>
                  <Bar value={p} color={low ? t.bad : undefined} height={7} />
                  {x.fromSheet ? (
                    <T v="small">
                      расход {fmt(x.weekly ?? 0)} {x.unit} в неделю · на складе {money(x.value ?? 0)} ₽
                    </T>
                  ) : null}
                </Card>
              </Appear>
            );
          })
        ) : (
          <Card>
            <Empty text="Материалов пока нет." />
          </Card>
        )
      ) : null}
      {mode === 'left' && idle ? (
        <T v="small" style={{ textAlign: 'center' }}>
          Ещё {idle} позиций без расхода за последние недели
        </T>
      ) : null}
      {mode === 'left' ? null : low.length ? (
        <>
          {low.map((x, i) => (
            <Appear key={x.id} i={i + 1}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconBadge icon="box" tone="accent" />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="b">{x.name}</T>
                  <T v="small">
                    {x.fromSheet ? `сейчас ${fmt(x.qty, 1)} ${x.unit} · хватит на ${fmt(x.days ?? 0, 1)} дн. · ${x.supplier}` : `сейчас ${fmt(x.qty)} · мин. ${fmt(x.min)} · кратно ${fmt(x.pack)}`}
                  </T>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <T v="num" style={{ color: t.accent }}>
                    {x.fromSheet && !needToOrder(x) ? fmt(Math.ceil((x.weekly ?? 0) - x.qty > 0 ? (x.weekly ?? 0) - x.qty : x.weekly ?? 0)) : fmt(needToOrder(x))}
                  </T>
                  <T v="small">{x.fromSheet && !needToOrder(x) ? `${x.unit} на неделю` : x.unit}</T>
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
