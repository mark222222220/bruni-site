import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Appear, Banner, Card, CountUp, HeroCard, IconBadge, Press, Ring, Screen, Section, Spark, T, styles } from '@/components/ui';
import { statusIndex, useData, useDerived } from '@/lib/data';
import { CASH_HISTORY } from '@/lib/demo';
import { dm, fmt, greeting, money, shortDate, tomorrow } from '@/lib/format';
import { pathFor, SECTION_PATH } from '@/lib/nav';
import { useSettings } from '@/lib/settings';
import { updatedLabel, useSheets } from '@/lib/sheets';
import { ROLE_SECTIONS, STATUSES, type Section as Sec } from '@/lib/types';

export default function Home() {
  const { s, t } = useSettings();
  const { kind, loading, error } = useData();
  const d = useDerived();
  const SHEETS = useSheets();
  const [heroW, setHeroW] = useState(0);
  const sections = ROLE_SECTIONS[s.role];
  if (!sections.includes('index')) return <Redirect href={SECTION_PATH[sections[0]] as '/'} />;
  const can = (x: Sec) => sections.includes(x);
  const go = (x: Sec) => router.navigate(pathFor(x, s.role) as '/');
  const ok = d.balance >= d.due;
  const sh = SHEETS?.main;
  const spark = sh?.weekly.length ? sh.weekly.map((w) => w.rev ?? 0) : CASH_HISTORY;
  const marginPct = sh?.margin.pct ?? d.avgMargin;
  const overdueM = SHEETS?.shipments.overdueSummary.match(/(\d+)\s*заказ/);
  const overdueN = overdueM ? Number(overdueM[1]) : d.overdue.length;
  const shipM = sh?.shipping.detail.match(/([\d\s,]+)\s*м²/);
  const moneyLabel = sh ? sh.money.label.replace(/^ДЕНЬГИ НА СЧЁТЕ\s*·\s*/i, '') : 'пример';
  const area = d.active.reduce((a, o) => a + o.area, 0);
  const stages = STATUSES.slice(0, 4).map((st, k) => {
    const list = d.active.filter((o) => statusIndex(o.status) === k);
    return { ...st, n: list.length, m2: list.reduce((a, o) => a + o.area, 0) };
  });
  const maxM2 = Math.max(1, ...stages.map((x) => x.m2));
  const quick = [
    { sec: 'orders' as Sec, label: 'Заказ', icon: 'plus', on: () => (s.role === 'boss' || s.role === 'sales' ? router.push('/new-order') : go('orders')) },
    { sec: 'stock' as Sec, label: 'Остатки', icon: 'box', on: () => go('stock') },
    { sec: 'money' as Sec, label: 'Платежи', icon: 'money', on: () => go('money') },
    { sec: 'chat' as Sec, label: 'Чат', icon: 'chat', on: () => go('chat') },
  ].filter((q) => can(q.sec));
  let i = 0;

  return (
    <Screen kicker={SHEETS ? `данные на ${updatedLabel(SHEETS.generatedAt)}` : `${shortDate()}${kind === 'local' ? ' · демо' : ''}`} title={greeting() + (s.name ? `,\n${s.name.split(' ')[0]}` : '')}>
      {error ? <Banner tone="bad" text={`Нет связи с базой: ${error}`} /> : loading ? <Banner text="Загружаю данные…" /> : null}

      {can('money') ? (
        <Appear i={i++}>
          <HeroCard onPress={() => go('money')}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <T v="label" style={{ color: 'rgba(17,17,19,0.7)' }}>
                Деньги на счёте
              </T>
              <View style={{ backgroundColor: 'rgba(17,17,19,0.14)', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 }}>
                <T v="b" style={{ fontSize: 11, color: '#111113' }}>
                  {moneyLabel}
                </T>
              </View>
            </View>
            <View style={[styles.row, { alignItems: 'flex-end', gap: 8 }]}>
              <CountUp v="huge" value={d.balance / 1e6} format={(n) => fmt(n, SHEETS ? 2 : 1)} style={{ color: '#111113' }} />
              <T v="h" style={{ color: '#111113', marginBottom: 8 }}>
                млн ₽
              </T>
            </View>
            <View onLayout={(e) => setHeroW(e.nativeEvent.layout.width)} style={{ marginTop: 4 }}>
              <Spark data={spark} width={heroW} height={58} color="#111113" />
            </View>
            <View style={[styles.row, { justifyContent: 'space-between', marginTop: 2 }]}>
              <T v="small" style={{ color: 'rgba(17,17,19,0.75)', flex: 1 }} numberOfLines={2}>
                {sh ? `выручка по неделям · платежи на 2 нед. ≈ ${money(d.due)}` : `к оплате ≈ ${money(d.due)} ₽`}
              </T>
              <View style={{ backgroundColor: '#111113', borderRadius: 14, paddingHorizontal: 11, paddingVertical: 5 }}>
                <T v="b" style={{ fontSize: 12, color: ok ? t.accent2 : '#FF6B5E' }}>
                  {ok ? (SHEETS ? 'платежи покрыты' : 'хватает на 2 недели') : `не хватает ${money(d.due - d.balance)}`}
                </T>
              </View>
            </View>
          </HeroCard>
        </Appear>
      ) : null}

      <Appear i={i++}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Card onPress={can('margin') ? () => go('margin') : undefined} style={{ minHeight: 210 }}>
              <T v="label">Маржа</T>
              <View style={{ alignSelf: 'center', marginTop: 6 }}>
                <Ring value={marginPct / 50} size={108} stroke={10} color={marginPct < s.thr ? t.bad : undefined}>
                  <CountUp v="num" value={marginPct} format={(n) => `${fmt(n)}%`} style={{ fontSize: 24 }} />
                </Ring>
              </View>
              <T v="small" style={{ alignSelf: 'center', textAlign: 'center' }} numberOfLines={2}>
                {sh ? `${sh.margin.label.replace(/^МАРЖА\s*·\s*/i, '').toLowerCase()} · ${SHEETS?.kv.prosh_marzh ? 'прошлый ' + SHEETS.kv.prosh_marzh.value : ''}` : `средняя · порог ${s.thr}%`}
              </T>
            </Card>
          </View>
          <View style={{ flex: 1, gap: 12 }}>
            <Card onPress={() => go('orders')} style={{ flex: 1 }}>
              <T v="label">{sh ? sh.shipping.label.replace(/^ОТГРУЗКА\s*·\s*/i, 'Отгрузка ') : 'Отгрузки завтра'}</T>
              <CountUp value={sh ? parseInt(sh.shipping.value, 10) || 0 : d.shipTomorrow.length} format={(n) => fmt(n)} />
              <T v="small">
                {sh ? `заказов · ${shipM ? shipM[1].trim() : '—'} м²` : `${fmt(d.shipTomorrow.reduce((a, o) => a + o.area, 0), 1)} м² · ${dm(tomorrow())}`}
              </T>
            </Card>
            <Card onPress={() => go('orders')} tone={overdueN ? 'bad' : undefined} style={{ flex: 1 }}>
              <T v="label">{SHEETS ? 'Просрочено' : 'В работе'}</T>
              <View style={[styles.row, { alignItems: 'flex-end', gap: 6 }]}>
                <CountUp value={SHEETS ? overdueN : d.active.length} format={(n) => fmt(n)} style={SHEETS && overdueN ? { color: t.bad } : undefined} />
                <T v="small" style={{ marginBottom: 6 }}>
                  заказов
                </T>
              </View>
              <T v="small" style={overdueN ? { color: t.bad } : undefined}>
                {SHEETS ? (SHEETS.main.warnings.find((w) => w.startsWith('просрочено'))?.match(/на ([\d,]+ млн ₽)/)?.[1] ?? 'срок прошёл') : d.overdue.length ? `${d.overdue.length} просрочен` : `${fmt(area, 0)} м² в цеху`}
              </T>
            </Card>
          </View>
        </View>
      </Appear>

      {quick.length ? (
        <Appear i={i++}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8 }}>
            {quick.map((q) => (
              <Press key={q.label} onPress={q.on} label={q.label}>
                <View style={{ alignItems: 'center', gap: 8, width: 72 }}>
                  <View style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, borderColor: t.accent + 'AA', backgroundColor: t.accent + '12', alignItems: 'center', justifyContent: 'center' }}>
                    <IconBadge icon={q.icon} size={46} />
                  </View>
                  <T v="small" style={{ color: t.fg, fontSize: 12 }}>
                    {q.label}
                  </T>
                </View>
              </Press>
            ))}
          </View>
        </Appear>
      ) : null}

      {sh?.forecast ? (
        <Appear i={i++}>
          <Card tone="accent" style={{ gap: 6 }}>
            <T v="label">Прогноз месяца</T>
            <T v="b" style={{ fontSize: 16, lineHeight: 22 }}>
              {sh.forecast.split('·')[0].trim()}
            </T>
            {sh.forecast.includes('·') ? <T v="small">{sh.forecast.split('·').slice(1).join('·').trim()}</T> : null}
            {sh.progress ? <T v="small">{sh.progress.split('|')[0].replace(/■/g, '•').trim()}</T> : null}
          </Card>
        </Appear>
      ) : null}

      {sh?.blocks.map((b) => (
        <View key={b.title} style={{ gap: 10 }}>
          <Section>{b.title}</Section>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {b.tiles.map((x) => (
              <View key={x.label} style={{ width: '48.4%' }}>
                <Card style={{ gap: 4, minHeight: 128, padding: 15 }}>
                  <T v="label" style={{ fontSize: 10 }} numberOfLines={2}>
                    {x.label}
                  </T>
                  <T v="big" style={{ fontSize: (x.value || '').length > 9 ? 19 : 24, lineHeight: (x.value || '').length > 9 ? 24 : 28 }} numberOfLines={2}>
                    {x.value || '—'}
                  </T>
                  <T v="small" style={{ fontSize: 12 }} numberOfLines={3}>
                    {x.detail}
                  </T>
                </Card>
              </View>
            ))}
          </View>
        </View>
      ))}

      <Section right={<T v="small">{fmt(area, 1)} м²</T>}>{SHEETS ? 'Отгрузки по плану' : 'Производство'}</Section>
      <Appear i={i++}>
        <Card onPress={() => go('orders')} style={{ gap: 14 }}>
          {stages.map((st, k) => (
            <View key={st.id} style={{ gap: 7 }}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <View style={[styles.row, { gap: 9 }]}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: k === 3 ? t.okBg : t.accent + '22', alignItems: 'center', justifyContent: 'center' }}>
                    <T v="b" style={{ fontSize: 11, color: k === 3 ? t.ok : t.accent }}>
                      {k + 1}
                    </T>
                  </View>
                  <T v="b">{st.name}</T>
                </View>
                <T v="small">
                  <T v="b" style={{ fontSize: 13 }}>
                    {st.n}
                  </T>
                  {` · ${fmt(st.m2, 1)} м²`}
                </T>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: t.card2, overflow: 'hidden' }}>
                <View style={{ width: `${(st.m2 / maxM2) * 100}%`, height: '100%', borderRadius: 4, backgroundColor: k === 3 ? t.ok : t.accent, opacity: 0.5 + k * 0.17 }} />
              </View>
            </View>
          ))}
        </Card>
      </Appear>

      <Section
        right={
          d.signals.length ? (
            <View style={{ backgroundColor: t.bad, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
              <T v="b" style={{ color: '#fff', fontSize: 12 }}>
                {d.signals.length}
              </T>
            </View>
          ) : undefined
        }
      >
        Сигналы
      </Section>
      {d.signals.length ? (
        d.signals.map((x) => (
          <Appear key={x.id} i={i++}>
            <Card tone={x.level === 'bad' ? 'bad' : 'warn'} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 15 }}>
              <IconBadge icon={x.channel === 'stock' ? 'stock' : x.channel === 'money' ? 'money' : x.id.startsWith('o') ? 'truck' : 'margin'} tone={x.level} size={42} />
              <View style={{ flex: 1, gap: 3 }}>
                <T v="b" style={{ fontSize: 14 }}>
                  {x.title}
                </T>
                <T v="small">{x.detail}</T>
              </View>
              {can('chat') ? (
                <Pressable
                  onPress={() => router.navigate({ pathname: '/chat', params: { ch: x.channel, q: x.title } })}
                  style={{ borderWidth: 1.5, borderColor: t.line, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Обсудить: ${x.title}`}
                >
                  <T v="b" style={{ fontSize: 12 }}>
                    Обсудить
                  </T>
                </Pressable>
              ) : null}
            </Card>
          </Appear>
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
