import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Appear, Button, Card, CountUp, Empty, Pill, Screen, T, styles } from '@/components/ui';
import { useData, useDerived } from '@/lib/data';
import { dm, fmt, money, today } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { SHEETS } from '@/lib/sheets';

export function MoneyScreen({ back }: { back?: boolean }) {
  const { snap, patch } = useData();
  const d = useDerived();
  const { t, tap } = useSettings();
  const ok = d.balance >= d.due;
  const T0 = today();
  const paid = snap.payments.filter((p) => p.paid && (!SHEETS || p.date >= T0)).reduce((a, p) => a + p.amount, 0);
  const list = snap.payments.slice().sort((a, b) => a.date.localeCompare(b.date));
  const days = [...new Set(list.map((p) => p.date))];
  const scale = Math.max(d.balance, d.due + paid) || 1;
  let i = 0;

  return (
    <Screen kicker="Деньги" title="Платёжный календарь" subtitle={SHEETS ? SHEETS.payments.head.enough : undefined} back={back}>
      <Appear i={i++}>
        <Card tone={ok ? 'accent' : 'bad'} style={{ gap: 12 }}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <T v="label">На счёте</T>
            <Pill text={SHEETS?.bank ? `Сбер на ${dm(SHEETS.bank.date)}` : 'пример'} />
          </View>
          <View style={[styles.row, { alignItems: 'flex-end', gap: 8 }]}>
            <CountUp v="huge" value={d.balance / 1e6} format={(n) => fmt(n, SHEETS ? 2 : 1)} />
            <T v="h" style={{ marginBottom: 8, color: t.dim }}>
              млн ₽
            </T>
          </View>
          <View style={{ height: 14, borderRadius: 7, backgroundColor: t.card2, flexDirection: 'row', overflow: 'hidden' }}>
            <View style={{ width: `${(paid / scale) * 100}%`, backgroundColor: t.ok, opacity: 0.8 }} />
            <View style={{ width: `${(d.due / scale) * 100}%`, backgroundColor: ok ? t.accent : t.bad }} />
          </View>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={[styles.row, { gap: 6 }]}>
              <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: t.ok }} />
              <T v="small">оплачено {money(paid)}</T>
            </View>
            <View style={[styles.row, { gap: 6 }]}>
              <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: ok ? t.accent : t.bad }} />
              <T v="small">{SHEETS ? 'на 2 недели' : 'к оплате'} {money(d.due)}</T>
            </View>
          </View>
          <T v="b" style={{ color: ok ? t.ok : t.bad }}>
            {ok ? `Хватает: после платежей останется ${money(d.balance - d.due)} ₽` : `Не хватает ${money(d.due - d.balance)} ₽`}
          </T>
        </Card>
      </Appear>

      {days.length ? (
        days.map((day) => (
          <Appear key={day} i={i++}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 52, alignItems: 'center', paddingTop: 16 }}>
                <T v="big" style={{ fontSize: 24, color: day < T0 ? t.bad : t.fg }}>
                  {day.slice(8, 10)}
                </T>
                <T v="label" style={{ fontSize: 10 }}>
                  {new Date(day + 'T12:00:00').toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '')}
                </T>
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                {list
                  .filter((p) => p.date === day)
                  .map((p) => {
                    const late = !p.paid && p.date < T0;
                    return (
                      <Card key={p.id} tone={late ? 'bad' : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 }}>
                        <View style={{ flex: 1, gap: 3 }}>
                          <T v="b" style={{ fontSize: 14, opacity: p.paid ? 0.6 : 1 }}>
                            {p.title}
                          </T>
                          <T v="num" style={{ fontSize: 16, opacity: p.paid ? 0.6 : 1 }}>
                            {p.amountText && !p.amount ? p.amountText : `${fmt(p.amount)} ₽`}
                          </T>
                          {p.comment ? (
                            <T v="small" numberOfLines={2} style={{ fontSize: 12 }}>
                              {p.comment}
                            </T>
                          ) : null}
                        </View>
                        <Pressable
                          onPress={() => {
                            tap(p.paid ? 'light' : 'success');
                            patch('payments', p.id, { paid: !p.paid });
                          }}
                          accessibilityRole="switch"
                          accessibilityState={{ checked: p.paid }}
                          accessibilityLabel={`Оплата: ${p.title}`}
                          hitSlop={8}
                        >
                          <Pill
                            text={p.paid ? '✓ оплачено' : p.status && p.status !== 'ожидается' ? p.status : late ? 'просрочен' : 'ожидается'}
                            tone={p.paid ? 'ok' : (p.status && /не видно/.test(p.status)) || late ? 'bad' : 'accent'}
                            outline={!p.paid && !late && !(p.status && /не видно/.test(p.status))}
                          />
                        </Pressable>
                      </Card>
                    );
                  })}
              </View>
            </View>
          </Appear>
        ))
      ) : (
        <Card>
          <Empty text="Платежей нет." />
        </Card>
      )}
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        <Button title="Добавить платёж" icon="plus" kind="ghost" onPress={() => router.push('/new-payment')} />
      </View>
      <T v="small" style={{ textAlign: 'center' }}>
        Нажмите на статус, чтобы отметить оплату · {dm(T0)}
      </T>
    </Screen>
  );
}
