import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Glass } from '@/components/ui';
import { shareLabels } from '@/lib/labels';
import { MOVE, signed } from '@/lib/stock';
import { useTeam, type MoveKind } from '@/lib/team';
import { Appear, Banner, Bar, Button, Card, CountUp, Empty, Icon, IconBadge, Pill, Screen, Segmented, Stepper, T, styles } from '@/components/ui';
import { isLow, needToOrder, useData, useDerived } from '@/lib/data';
import { money } from '@/lib/format';
import { fmt } from '@/lib/format';
import { useSettings } from '@/lib/settings';

export default function Stock() {
  const { snap, patch, send, loading, offlineAt } = useData();
  const { low } = useDerived();
  const { s, t, tap } = useSettings();
  const canReceive = s.role === 'boss' || s.role === 'store';
  const [mode, setMode] = useState<'left' | 'order'>('left');
  const { moves } = useTeam();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('Все');
  const [pdf, setPdf] = useState('');
  const all = snap.stock.slice().sort((a, b) => a.sort - b.sort);
  const groups = ['Все', ...new Set(all.filter((x) => x.status !== 'Нет расхода').map((x) => x.group || 'Прочее'))];
  const qq = q.trim().toLowerCase();
  // при поиске показываем и позиции без расхода
  const items = all.filter((x) => (qq ? x.name.toLowerCase().includes(qq) : x.status !== 'Нет расхода') && (group === 'Все' || (x.group || 'Прочее') === group));
  const dayStart = new Date(new Date().toDateString()).getTime();
  const todayMoves = moves.filter((m) => m.at >= dayStart);
  const todayN = (k: MoveKind) => todayMoves.filter((m) => m.kind === k).length;
  const tiles: { label: string; sub: string; icon: string; on: () => void; accent?: boolean }[] = [
    { label: 'Приход', sub: 'принять', icon: 'plus', on: () => router.push({ pathname: '/stock-move', params: { kind: 'in' } }), accent: true },
    { label: 'В цех', sub: 'выдать', icon: 'truck', on: () => router.push({ pathname: '/stock-move', params: { kind: 'out' } }) },
    { label: 'Списание', sub: 'брак, бой', icon: 'trash', on: () => router.push({ pathname: '/stock-move', params: { kind: 'writeoff' } }) },
    { label: 'Пересчёт', sub: 'инвентаризация', icon: 'check', on: () => router.push('/inventory') },
    { label: 'Журнал', sub: `сегодня ${todayMoves.length}`, icon: 'orders', on: () => router.push('/stock-log') },
    { label: 'Сканер', sub: 'QR на полке', icon: 'camera', on: () => router.push('/scan') },
  ];
  const idle = all.filter((x) => x.status === 'Нет расхода').length;
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
      {canReceive ? (
        <Appear>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {tiles.map((x) => (
              <Pressable
                key={x.label}
                onPress={() => {
                  tap();
                  x.on();
                }}
                accessibilityRole="button"
                accessibilityLabel={x.label}
                style={({ pressed }) => ({ flexGrow: 1, flexBasis: '30%', transform: [{ scale: pressed ? 0.96 : 1 }] })}
              >
                <Glass radius={20} style={{ padding: 12, gap: 8, minHeight: 104, borderWidth: x.accent ? 1.5 : 0, borderColor: t.accent }}>
                  <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: x.accent ? t.accent : t.accent + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={x.icon} size={19} color={x.accent ? t.onAccent : t.accent} stroke={2.1} />
                  </View>
                  <View>
                    <T v="b" style={{ fontSize: 14 }} numberOfLines={1}>
                      {x.label}
                    </T>
                    <T v="small" style={{ fontSize: 11 }} numberOfLines={1}>
                      {x.sub}
                    </T>
                  </View>
                </Glass>
              </Pressable>
            ))}
          </View>
          {todayMoves.length ? (
            <T v="small" style={{ textAlign: 'center', marginTop: 10 }}>
              Сегодня: {MOVE.in.emoji} приход {todayN('in')} · {MOVE.out.emoji} выдано {todayN('out')} · {MOVE.writeoff.emoji} списано {todayN('writeoff')}
              {todayN('count') ? ` · ${MOVE.count.emoji} пересчёт ${todayN('count')}` : ''}
            </T>
          ) : null}
        </Appear>
      ) : null}
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
      {offlineAt ? <Banner tone="bad" text={`Нет связи — данные от ${new Date(offlineAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`} /> : loading ? <Banner text="Загружаю остатки…" /> : null}
      {mode === 'left' ? (
        items.length ? (
          items.map((x, i) => {
            const low = isLow(x);
            const p = x.days != null ? Math.min(100, (x.days / 30) * 100) : (x.qty / (x.min * 2)) * 100;
            return (
              <Appear key={x.id} i={i + 1}>
                <Card onPress={() => router.push({ pathname: '/stock-item', params: { id: x.id } })} tone={low ? 'bad' : undefined} style={{ gap: 12 }}>
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
                  {x.received ? (
                    <T v="small" style={{ color: x.received > 0 ? t.ok : t.dim }}>
                      {signed(x.received, x.unit)} через приложение после ночной загрузки
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
      {mode === 'left' && canReceive ? (
        <View style={{ flexDirection: 'row' }}>
          <Button
            title={pdf || 'Наклейки с QR для полок (PDF)'}
            icon="doc"
            kind="ghost"
            onPress={async () => {
              setPdf('Готовлю наклейки…');
              await shareLabels(items.length ? items : all).catch(() => {});
              setPdf('');
            }}
          />
        </View>
      ) : null}
      {mode === 'left' && idle && !qq ? (
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
