import { router } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Appear, Banner, Button, Card, Empty, Glass, Icon, Pill, Screen, Segmented, Steps, T, styles } from '@/components/ui';
import { statusIndex, statusName, useData } from '@/lib/data';
import { dm, fmt, money, today, tomorrow } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import type { Order } from '@/lib/types';

type F = 'work' | 'ready' | 'shipped' | 'all';
const PAGE = 20;

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <T v="label" style={{ fontSize: 10 }}>
        {label}
      </T>
      <T v="num" style={{ fontSize: 16 }}>
        {value}
      </T>
    </View>
  );
}

/** memo: карточка не перерисовывается, пока сам заказ не изменился (поиск и «показать ещё» остаются быстрыми). */
const OrderCard = memo(function OrderCard({ o }: { o: Order }) {
  const { t } = useSettings();
  const T0 = today();
  const late = o.status !== 'shipped' && !!o.ship && o.ship < T0;
  const tone = o.status === 'shipped' ? 'ok' : late ? 'bad' : o.status === 'ready' ? 'warn' : 'neutral';
  const when = o.ship === tomorrow() ? 'завтра' : o.ship === T0 ? 'сегодня' : '';
  return (
    <Card onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.id } })} tone={late ? 'bad' : undefined} style={{ gap: 12 }}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <T v="b" style={{ color: t.accent, fontSize: 13, letterSpacing: 1 }}>
          № {o.no}
        </T>
        <Pill text={late ? (o.fromSheet ? `просрочен ${Math.max(1, Math.round((Date.now() - Date.parse(o.ship)) / 864e5))} дн.` : 'просрочен') : o.fromSheet ? (o.production && o.production !== '—' ? o.production : 'в реестре') : statusName(o.status)} tone={tone} />
      </View>
      <View style={{ gap: 3 }}>
        <T v="h" style={{ fontSize: 18 }} numberOfLines={2}>
          {o.client}
        </T>
        <T v="small" style={{ letterSpacing: 0.4 }}>
          {o.formula}
        </T>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Metric label={o.fromSheet ? 'СП' : 'Штук'} value={o.fromSheet && !o.qty ? '—' : fmt(o.qty)} />
        <Metric label="Площадь" value={`${fmt(o.area, 1)} м²`} />
        <Metric label="Сумма" value={`${money(o.sum)} ₽`} />
      </View>
      <View style={{ gap: 0 }}>
        <Steps index={statusIndex(o.status)} />
        <View style={[styles.row, { justifyContent: 'space-between', marginTop: 10 }]}>
          <View style={[styles.row, { gap: 6 }]}>
            <Icon name="truck" size={16} color={late ? t.bad : t.dim} />
            <T v="small" style={late ? { color: t.bad } : undefined}>
              отгрузка {dm(o.ship)}
              {when ? ` · ${when}` : ''}
            </T>
          </View>
          <Icon name="chev" size={16} color={t.mute} />
        </View>
      </View>
    </Card>
  );
});

export default function Orders() {
  const { snap, loading, offlineAt } = useData();
  const { s, t } = useSettings();
  const [f, setF] = useState<F>('work');
  const [q, setQ] = useState('');
  // длинный список рисуем порциями — экран открывается сразу
  const [shown, setShown] = useState(PAGE);
  const n = (k: F) => snap.orders.filter((o) => (k === 'work' ? o.status !== 'shipped' : k === 'all' ? true : o.status === k)).length;
  const list = useMemo(() => {
    let L = snap.orders.filter((o) => (f === 'work' ? o.status !== 'shipped' : f === 'all' ? true : o.status === f));
    const qq = q.trim().toLowerCase();
    if (qq) L = L.filter((o) => `${o.no} ${o.client} ${o.formula}`.toLowerCase().includes(qq));
    return L.sort((a, b) => (a.ship || '9').localeCompare(b.ship || '9') || a.no - b.no);
  }, [snap.orders, f, q]);
  const sum = list.reduce((a, o) => a + o.sum, 0);

  return (
    <Screen kicker="Производство" title="Заказы" subtitle={`${list.length} на ${money(sum)} ₽`}>
      <Glass radius={18} style={[styles.row, { paddingHorizontal: 16, height: 50 }]}>
        <Icon name="search" size={18} color={t.mute} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Номер, клиент или формула"
          placeholderTextColor={t.mute}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={{ flex: 1, color: t.fg, fontSize: 16, fontFamily: 'Rubik_400Regular', height: '100%' }}
          accessibilityLabel="Поиск заказов"
        />
      </Glass>
      <Segmented
        value={f}
        onChange={(v) => {
          setF(v);
          setShown(PAGE);
        }}
        options={[
          { value: 'work', label: `В работе · ${n('work')}` },
          { value: 'ready', label: `Готовы · ${n('ready')}` },
          { value: 'shipped', label: `Отгружены · ${n('shipped')}` },
          { value: 'all', label: `Все · ${n('all')}` },
        ]}
      />
      {offlineAt ? <Banner tone="bad" text={`Нет связи — данные от ${new Date(offlineAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`} /> : loading ? <Banner text="Загружаю заказы…" /> : null}
      {list.length ? (
        <>
          {list.slice(0, shown).map((o, i) => (
            <Appear key={o.id} i={i < PAGE ? i : 0}>
              <OrderCard o={o} />
            </Appear>
          ))}
          {list.length > shown ? (
            <View style={{ flexDirection: 'row' }}>
              <Button title={`Показать ещё ${Math.min(PAGE, list.length - shown)} из ${list.length - shown}`} kind="ghost" onPress={() => setShown((n) => n + PAGE)} />
            </View>
          ) : null}
        </>
      ) : (
        <Card>
          <Empty text={q ? 'Ничего не нашлось.' : 'Здесь пока пусто.'} />
        </Card>
      )}
      {s.role === 'boss' || s.role === 'sales' ? (
        <View style={{ flexDirection: 'row', marginTop: 4 }}>
          <Button title="Новый заказ" icon="plus" onPress={() => router.push('/new-order')} />
        </View>
      ) : null}
    </Screen>
  );
}
