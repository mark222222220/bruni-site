import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Bar, Button, Card, Empty, Item, List, Pill, Screen, T, styles } from '@/components/ui';
import { useData, useDerived } from '@/lib/data';
import { dm, fmt, money, today } from '@/lib/format';
import { useSettings } from '@/lib/settings';

export function MoneyScreen({ back }: { back?: boolean }) {
  const { snap, patch } = useData();
  const d = useDerived();
  const { t, tap } = useSettings();
  const ok = d.balance >= d.due;
  const T0 = today();
  const list = snap.payments.slice().sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Screen title="Деньги" subtitle="Платежи и остаток" back={back}>
      <Card>
        <T v="label">На счёте · пример</T>
        <T v="big">
          {fmt(d.balance / 1e6, 1)} <T v="h">млн</T>
        </T>
        <Bar value={(d.due / d.balance) * 100} color={ok ? t.accent : t.bad} height={10} />
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <T v="small">к оплате ≈ {money(d.due)} ₽</T>
          <T v="small" style={{ color: ok ? t.ok : t.bad }}>
            {ok ? 'хватает' : `не хватает ${money(d.due - d.balance)} ₽`}
          </T>
        </View>
      </Card>
      <List>
        {list.length ? (
          list.map((p, i) => {
            const late = !p.paid && p.date < T0;
            return (
              <Item
                key={p.id}
                first={i === 0}
                title={p.title}
                sub={
                  <T v="small" style={late ? { color: t.bad } : undefined}>
                    {dm(p.date)} · {money(p.amount)} ₽
                  </T>
                }
                right={
                  <Pressable
                    onPress={() => {
                      tap(p.paid ? 'light' : 'success');
                      patch('payments', p.id, { paid: !p.paid });
                    }}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: p.paid }}
                    accessibilityLabel={`Оплата: ${p.title}`}
                    hitSlop={6}
                  >
                    <Pill text={p.paid ? '✓ оплачено' : late ? 'просрочен' : 'ожидается'} tone={p.paid ? 'ok' : late ? 'bad' : 'neutral'} />
                  </Pressable>
                }
              />
            );
          })
        ) : (
          <Empty text="Платежей нет." />
        )}
      </List>
      <View style={{ flexDirection: 'row' }}>
        <Button title="Добавить платёж" icon="plus" kind="ghost" onPress={() => router.push('/new-payment')} />
      </View>
      <T v="small" style={{ textAlign: 'center' }}>
        Нажмите на статус, чтобы отметить оплату
      </T>
    </Screen>
  );
}
