import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Card, T, styles } from '@/components/ui';
import { addDays, dm, money, today } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import type { Order, Payment } from '@/lib/types';

const DAYS = 30;

/** Остаток на каждый день: сегодня — баланс минус всё неоплаченное до сегодня (включая просроченное). */
export function forecast(balance: number, payments: Payment[], orders: Order[]) {
  const T0 = today();
  const out: { day: string; base: number; withIn: number }[] = [];
  let base = balance;
  let inc = 0;
  for (let i = 0; i <= DAYS; i++) {
    const day = addDays(i);
    base -= payments.filter((p) => !p.paid && (i === 0 ? p.date <= T0 : p.date === day)).reduce((a, p) => a + (Number(p.amount) || 0), 0);
    inc += orders.filter((o) => o.status !== 'shipped' && o.ship === day).reduce((a, o) => a + (o.sum || 0), 0);
    out.push({ day, base, withIn: base + inc });
  }
  return out;
}

export function ForecastCard({ balance, payments, orders }: { balance: number; payments: Payment[]; orders: Order[] }) {
  const { t } = useSettings();
  const [w, setW] = useState(0);
  const data = useMemo(() => forecast(balance, payments, orders), [balance, payments, orders]);
  const H = 130;
  const vals = data.flatMap((d) => [d.base, d.withIn]);
  const max = Math.max(...vals, 0);
  const min = Math.min(...vals, 0);
  const span = max - min || 1;
  const x = (i: number) => (i / DAYS) * w;
  const y = (v: number) => 8 + (1 - (v - min) / span) * (H - 16);
  const path = (k: 'base' | 'withIn') => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ');
  const low = data.reduce((a, d, i) => (d.base < data[a].base ? i : a), 0);
  const minus = data.find((d) => d.base < 0);
  const end = data[data.length - 1];
  const hasIn = end.withIn !== end.base;

  return (
    <Card tone={minus ? 'bad' : undefined} style={{ gap: 12 }}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <T v="label">Прогноз на 30 дней</T>
        <T v="small">до {dm(end.day)}</T>
      </View>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: H }}>
        {w ? (
          <Svg width={w} height={H}>
            {min < 0 ? <Line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke={t.bad} strokeWidth={1} strokeDasharray="4 4" opacity={0.7} /> : null}
            {hasIn ? <Path d={path('withIn')} stroke={t.ok} strokeWidth={2} fill="none" strokeDasharray="5 5" opacity={0.8} /> : null}
            <Path d={path('base')} stroke={minus ? t.bad : t.accent} strokeWidth={2.6} fill="none" strokeLinejoin="round" />
            <Circle cx={x(low)} cy={y(data[low].base)} r={4.5} fill={data[low].base < 0 ? t.bad : t.accent} />
          </Svg>
        ) : null}
      </View>
      <View style={[styles.row, { gap: 14, flexWrap: 'wrap' }]}>
        <View style={[styles.row, { gap: 6 }]}>
          <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: minus ? t.bad : t.accent }} />
          <T v="small">только платежи</T>
        </View>
        {hasIn ? (
          <View style={[styles.row, { gap: 6 }]}>
            <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: t.ok, opacity: 0.8 }} />
            <T v="small">+ оплата за отгрузки</T>
          </View>
        ) : null}
      </View>
      <T v="b" style={{ color: minus ? t.bad : t.fg }}>
        {minus ? `${dm(minus.day)} денег не хватит: ${money(minus.base)} ₽` : `Минимум ${money(data[low].base)} ₽ — ${dm(data[low].day)}`}
      </T>
      <T v="small">
        К {dm(end.day)}: {money(end.base)} ₽{hasIn ? `, а если клиенты платят в день отгрузки — ${money(end.withIn)} ₽` : ''}. Поступления от клиентов в таблице не запланированы, поэтому это осторожная оценка.
      </T>
    </Card>
  );
}
