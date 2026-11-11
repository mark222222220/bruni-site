import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Bar, Button, Empty, Glass, Pill, Sheet, SheetHeader, T, styles } from '@/components/ui';
import { isLow, useData } from '@/lib/data';
import { fmt, money } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { hm, MOVE, qtyText, signed } from '@/lib/stock';
import { useTeam } from '@/lib/team';

/** Карточка материала: остаток, запас в днях, кнопки операций и история движений. */
export default function StockItem() {
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  const { snap } = useData();
  const { moves } = useTeam();
  const { s, t } = useSettings();
  const x = snap.stock.find((i) => (id ? i.id === id : i.name === name));
  if (!x)
    return (
      <Sheet>
        <SheetHeader title="Материал" />
        <Empty text={name ? `«${name}» нет в остатках из таблицы.` : 'Материал не найден.'} />
      </Sheet>
    );
  const low = isLow(x);
  const hist = moves.filter((m) => m.item_id === x.id || m.item_name === x.name).slice(0, 30);
  const week = Date.now() - 7 * 864e5;
  const outWeek = -hist.filter((m) => m.at > week && (m.kind === 'out' || m.kind === 'writeoff')).reduce((a, m) => a + m.qty, 0);
  const can = s.role === 'boss' || s.role === 'store';
  const go = (kind: string) => router.push({ pathname: '/stock-move', params: { kind, id: x.id } });
  const row = (k: string, v: string, bad?: boolean) => (
    <View style={[styles.row, { justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: t.line }]}>
      <T v="small">{k}</T>
      <T v="b" style={[{ flexShrink: 1, textAlign: 'right' }, bad ? { color: t.bad } : null]}>
        {v}
      </T>
    </View>
  );

  return (
    <Sheet>
      <SheetHeader kicker={x.group || 'Материал'} title={x.name} right={low ? <Pill text="мало" tone="bad" /> : x.status ? <Pill text={x.status.toLowerCase()} tone="ok" /> : undefined} />
      <Glass style={{ padding: 16, gap: 10 }}>
        <View style={[styles.row, { alignItems: 'flex-end', gap: 8 }]}>
          <T v="huge" style={{ color: low ? t.bad : t.fg }}>
            {fmt(x.qty, x.qty % 1 ? 1 : 0)}
          </T>
          <T v="h" style={{ marginBottom: 8, color: t.dim }}>
            {x.unit}
          </T>
        </View>
        <Bar value={x.days != null ? Math.min(100, (x.days / 30) * 100) : 50} color={low ? t.bad : undefined} height={8} />
        <T v="small">
          {x.days != null ? `хватит на ${fmt(x.days, 1)} дн.` : 'запас не считается'}
          {x.received ? ` · через приложение ${signed(x.received, x.unit)} после ночной загрузки` : ''}
        </T>
      </Glass>
      {can ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Приход" icon="plus" onPress={() => go('in')} />
            <Button title="Выдать" icon="truck" kind="ghost" onPress={() => go('out')} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Списать" icon="trash" kind="ghost" onPress={() => go('writeoff')} />
            <Button title="Пересчитать" icon="check" kind="ghost" onPress={() => router.push({ pathname: '/inventory', params: { only: x.id } })} />
          </View>
        </>
      ) : null}
      <Glass style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
        {row('Расход по таблице', x.weekly ? `${qtyText(x.weekly, x.unit)} в неделю` : '—')}
        {row('Выдано и списано за 7 дней', outWeek ? qtyText(outWeek, x.unit) : '—')}
        {x.toOrder ? row('К заказу по таблице', qtyText(x.toOrder, x.unit), true) : null}
        {x.value ? row('На складе на сумму', `${money(x.value)} ₽`) : null}
        {x.supplier ? row('Поставщик', x.supplier.split('(')[0].trim()) : null}
      </Glass>
      <T v="label" style={{ marginTop: 4 }}>
        История
      </T>
      {hist.length ? (
        <Glass style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
          {hist.map((m, i) => (
            <View key={m.id} style={[styles.row, { justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.line }]}>
              <T v="body" style={{ fontSize: 20 }}>
                {MOVE[m.kind].emoji}
              </T>
              <View style={{ flex: 1 }}>
                <T v="b" style={{ fontSize: 14 }}>
                  {MOVE[m.kind].name}
                  {m.order_no ? ` · заказ №${m.order_no}` : ''}
                </T>
                <T v="small" numberOfLines={2}>
                  {new Date(m.at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} {hm(m.at)} · {m.author}
                  {m.note ? ` · ${m.note}` : ''}
                </T>
              </View>
              <T v="num" style={{ fontSize: 15, color: m.qty > 0 ? t.ok : t.fg }}>
                {signed(m.qty, m.unit)}
              </T>
            </View>
          ))}
        </Glass>
      ) : (
        <Glass style={{ padding: 16 }}>
          <Empty text="Движений через приложение ещё не было." />
        </Glass>
      )}
    </Sheet>
  );
}
