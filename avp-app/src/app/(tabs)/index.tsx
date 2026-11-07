import { Redirect, router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Bar, Card, Glass, Icon, Screen, Section, T, styles, Banner } from '@/components/ui';
import { useData, useDerived, statusIndex } from '@/lib/data';
import { fmt, greeting, money, shortDate, tomorrow, dm } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { pathFor, SECTION_PATH } from '@/lib/nav';
import { ROLE_SECTIONS, STATUSES, type Section as Sec } from '@/lib/types';

export default function Home() {
  const { s, t } = useSettings();
  const { kind, loading, error } = useData();
  const d = useDerived();
  const sections = ROLE_SECTIONS[s.role];
  if (!sections.includes('index')) return <Redirect href={SECTION_PATH[sections[0]] as '/'} />;
  const can = (x: Sec) => sections.includes(x);
  const go = (x: Sec) => router.navigate(pathFor(x, s.role) as '/');
  const ok = d.balance >= d.due;
  const counts = STATUSES.slice(0, 4).map((st) => d.active.filter((o) => statusIndex(o.status) === STATUSES.indexOf(st)).length);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const shades = [t.accent + '66', t.accent + 'AA', t.accent, t.ok];
  const quick = [
    { sec: 'orders' as Sec, label: 'Новый заказ', icon: 'plus', on: () => (s.role === 'boss' || s.role === 'sales' ? router.push('/new-order') : go('orders')) },
    { sec: 'stock' as Sec, label: 'Остатки', icon: 'box', on: () => go('stock') },
    { sec: 'money' as Sec, label: 'Платежи', icon: 'money', on: () => go('money') },
    { sec: 'chat' as Sec, label: 'Написать', icon: 'chat', on: () => go('chat') },
  ].filter((q) => can(q.sec));

  return (
    <Screen title={greeting() + (s.name ? `, ${s.name.split(' ')[0]}` : '')} subtitle={shortDate() + (kind === 'local' ? ' · демо-режим' : '')}>
      {error ? <Banner tone="bad" text={`Нет связи с базой: ${error}`} /> : loading ? <Banner text="Загружаю данные…" /> : null}
      {can('money') ? (
          <Card onPress={() => go('money')}>
            <T v="label">Деньги на счёте · пример</T>
            <T v="big" style={{ color: ok ? t.ok : t.bad }}>
              {fmt(d.balance / 1e6, 1)} <T v="h">млн</T>
            </T>
            <T v="small">
              к оплате ≈ {money(d.due)} ₽ — {ok ? 'хватает' : 'не хватает'}
            </T>
          </Card>
        ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Card onPress={can('margin') ? () => go('margin') : undefined}>
            <T v="label">Маржа</T>
            <T v="big" style={{ color: d.avgMargin < s.thr ? t.bad : t.fg }}>
              {fmt(d.avgMargin)}
              <T v="h">%</T>
            </T>
            <Bar value={d.avgMargin * 2} />
            <T v="small">средняя по клиентам</T>
          </Card>
        </View>
        <View style={{ flex: 1 }}>
          <Card onPress={() => go('orders')}>
            <T v="label">Отгрузки завтра</T>
            <T v="big">{d.shipTomorrow.length}</T>
            <T v="small">
              {fmt(d.shipTomorrow.reduce((a, o) => a + o.area, 0), 1)} м² · {dm(tomorrow())}
            </T>
          </Card>
        </View>
      </View>

      {quick.length ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {quick.map((q) => (
            <Pressable key={q.label} onPress={q.on} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1 })} accessibilityRole="button">
              <Glass style={{ alignItems: 'center', paddingVertical: 12, gap: 6 }} radius={18} interactive>
                <Icon name={q.icon} color={t.accent} size={24} />
                <T v="small" style={{ color: t.fg, fontSize: 12, textAlign: 'center' }} numberOfLines={2}>
                  {q.label}
                </T>
              </Glass>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Section>Производство</Section>
      <Card onPress={() => go('orders')}>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <T v="b">{d.active.length} заказов в работе</T>
          <T v="small">{fmt(d.active.reduce((a, o) => a + o.area, 0), 1)} м²</T>
        </View>
        <View style={{ flexDirection: 'row', height: 32, borderRadius: 12, overflow: 'hidden', gap: 2, marginTop: 4 }}>
          {counts.some(Boolean) ? (
            counts.map((n, i) =>
              n ? (
                <View key={i} style={{ flex: n / total, backgroundColor: shades[i], alignItems: 'center', justifyContent: 'center', minWidth: 28 }}>
                  <T v="b" style={{ color: t.onAccent, fontSize: 13 }}>
                    {n}
                  </T>
                </View>
              ) : null,
            )
          ) : (
            <View style={{ flex: 1, backgroundColor: t.card2, alignItems: 'center', justifyContent: 'center' }}>
              <T v="small">нет заказов</T>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
          {STATUSES.slice(0, 4).map((st, i) => (
            <View key={st.id} style={[styles.row, { gap: 6 }]}>
              <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: shades[i] }} />
              <T v="small">{st.name}</T>
            </View>
          ))}
        </View>
      </Card>

      <Section>{`Сигналы · ${d.signals.length}`}</Section>
      {d.signals.length ? (
        d.signals.map((x) => (
          <Glass key={x.id} style={{ padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: x.level === 'bad' ? t.badBg : t.warnBg }} radius={18}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: x.level === 'bad' ? t.bad : t.warn, marginTop: 6 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <T v="body">{x.title}</T>
              <T v="small">{x.detail}</T>
            </View>
            {can('chat') ? (
              <Pressable
                onPress={() => router.navigate({ pathname: '/chat', params: { ch: x.channel, q: x.title } })}
                style={{ backgroundColor: t.card2, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 }}
                accessibilityRole="button"
              >
                <T v="b" style={{ fontSize: 12 }}>
                  Обсудить
                </T>
              </Pressable>
            ) : null}
          </Glass>
        ))
      ) : (
        <Card>
          <T v="small" style={{ textAlign: 'center' }}>
            Всё спокойно: сигналов нет.
          </T>
        </Card>
      )}
    </Screen>
  );
}
