import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Empty, Glass, Pill, Sheet, SheetHeader, T, styles } from '@/components/ui';
import { statusIndex, useData } from '@/lib/data';
import { dm, fmt, today } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { STATUSES } from '@/lib/types';

export default function OrderCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snap, patch, remove } = useData();
  const { s, t, tap } = useSettings();
  const [sure, setSure] = useState(false);
  const o = snap.orders.find((x) => x.id === id);
  if (!o)
    return (
      <Sheet>
        <SheetHeader title="Заказ" />
        <Empty text="Заказ не найден — возможно, его удалили." />
      </Sheet>
    );
  const i = statusIndex(o.status);
  const next = STATUSES[i + 1];
  const canMove = !o.fromSheet && (s.role === 'boss' || s.role === 'store' || (s.role === 'sales' && o.status === 'ready'));
  const late = o.status !== 'shipped' && o.ship < today();
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
      <SheetHeader title={`Заказ №${o.no}`} right={<Pill text={late ? 'просрочен' : STATUSES[i].name} tone={o.status === 'shipped' ? 'ok' : late ? 'bad' : 'neutral'} />} />
      <Glass style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
        {row('Клиент', o.client)}
        {row('Формула', o.formula)}
        {row('Количество', o.sp != null ? `${fmt(o.sp)} СП · ${fmt(o.area, 1)} м²` : `${fmt(o.qty)} шт · ${fmt(o.area, 1)} м²`)}
        {row('Сумма', `${fmt(o.sum)} ₽`)}
        {row('Отгрузка', dm(o.ship), late)}
        {o.note ? row('Комментарий', o.note) : null}
        {o.fromSheet ? row('Источник', 'реестр в таблице') : null}
      </Glass>
      <Glass style={{ padding: 16, gap: 2 }}>
        {STATUSES.map((st, k) => (
          <View key={st.id} style={[styles.row, { paddingVertical: 7 }]}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: k <= i ? t.accent : t.line,
                backgroundColor: k <= i ? t.accent : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {k <= i ? (
                <T v="b" style={{ color: t.onAccent, fontSize: 12 }}>
                  ✓
                </T>
              ) : null}
            </View>
            <T v={k === i ? 'b' : 'body'} style={{ color: k <= i ? t.fg : t.mute }}>
              {st.name}
            </T>
          </View>
        ))}
      </Glass>
      {next && canMove ? (
        <View style={{ flexDirection: 'row' }}>
          <Button
            title={`Перевести в «${next.name}»`}
            onPress={async () => {
              if (await patch('orders', o.id, { status: next.id })) tap('success');
            }}
          />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          title="Обсудить"
          kind="ghost"
          icon="chat"
          onPress={() => {
            router.back();
            router.navigate({ pathname: '/chat', params: { ch: 'orders', q: `Заказ №${o.no} · ${o.client} · ${o.formula}` } });
          }}
        />
        {s.role === 'boss' && !o.fromSheet ? (
          <Button
            title={sure ? 'Точно удалить?' : 'Удалить'}
            kind="danger"
            onPress={async () => {
              if (!sure) return setSure(true);
              tap('warning');
              if (await remove('orders', o.id)) router.back();
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}
