import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { celebrate } from '@/components/Confetti';
import { Banner, Button, Card, Glass, Icon, Screen, T, styles } from '@/components/ui';
import { useData } from '@/lib/data';
import { parseNum } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { qtyText, signed } from '@/lib/stock';
import { useTeam } from '@/lib/team';

/** Инвентаризация: вводим факт, приложение записывает разницу и сообщает руководителю о расхождениях. */
export default function Inventory() {
  const { only } = useLocalSearchParams<{ only?: string }>();
  const { snap, send } = useData();
  const { addMove, notify, people, missing } = useTeam();
  const { s, t, tap } = useSettings();
  const [group, setGroup] = useState<string>('Все');
  const [q, setQ] = useState('');
  const [fact, setFact] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const all = useMemo(() => snap.stock.filter((x) => (only ? x.id === only : x.status !== 'Нет расхода' || x.qty > 0)).sort((a, b) => a.sort - b.sort), [snap.stock, only]);
  const groups = ['Все', ...new Set(all.map((x) => x.group || 'Прочее'))];
  const list = all.filter((x) => (group === 'Все' || (x.group || 'Прочее') === group) && (!q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase())));
  const entered = all.filter((x) => fact[x.id] !== undefined && fact[x.id].trim() !== '' && Number.isFinite(parseNum(fact[x.id])));
  const diffs = entered.map((x) => ({ x, d: parseNum(fact[x.id]) - x.qty })).filter((r) => Math.abs(r.d) > 1e-9);

  const save = async () => {
    if (!entered.length) return;
    setBusy(true);
    setErr('');
    for (const { x, d } of diffs) {
      const e = await addMove({ kind: 'count', item_id: x.id, item_name: x.name, qty: d, unit: x.unit, note: `пересчёт: было ${qtyText(x.qty, x.unit)}, факт ${qtyText(x.qty + d, x.unit)}`, photo: null, order_no: null });
      if (e) {
        setErr(e);
        setBusy(false);
        return;
      }
    }
    const lines = diffs.map(({ x, d }) => `• ${x.name}: ${signed(d, x.unit)}`);
    const text = `📋 Инвентаризация: проверено ${entered.length} поз., расхождений ${diffs.length}${lines.length ? '\n' + lines.join('\n') : ' — всё сходится ✓'}`;
    await send('stock', text);
    if (diffs.length) notify(people.filter((u) => u.role === 'boss'), `📋 Инвентаризация: расхождений ${diffs.length}`, lines.slice(0, 4).join('\n') + ` · ${s.name}`, { kind: 'stock' });
    setBusy(false);
    tap('success');
    celebrate(diffs.length ? `Пересчёт сохранён: ${diffs.length} расх.` : 'Всё сходится! ✓');
    router.back();
  };

  return (
    <Screen kicker="Склад" title={only ? 'Пересчёт' : 'Инвентаризация'} subtitle="Введите фактический остаток — приложение запишет разницу" back>
      {missing ? <Banner tone="bad" text="Складской журнал ещё не включён в базе — нужно выполнить SQL." /> : null}
      {only ? null : (
        <>
          <Glass radius={18} style={[styles.row, { paddingHorizontal: 16, height: 50 }]}>
            <Icon name="search" size={18} color={t.mute} />
            <TextInput value={q} onChangeText={setQ} placeholder="Найти материал" placeholderTextColor={t.mute} style={{ flex: 1, color: t.fg, fontSize: 16, fontFamily: 'Rubik_400Regular', height: '100%' }} accessibilityLabel="Поиск" />
          </Glass>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, alignItems: "flex-start" }}>
            {groups.map((g) => (
              <Pressable key={g} onPress={() => setGroup(g)} accessibilityRole="button" accessibilityState={{ selected: g === group }} style={{ borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: g === group ? t.accent : t.field }}>
                <T v="b" style={{ fontSize: 13, color: g === group ? t.onAccent : t.fg }}>
                  {g}
                </T>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}
      {list.map((x) => {
        const v = fact[x.id] ?? '';
        const n = parseNum(v);
        const d = v.trim() && Number.isFinite(n) ? n - x.qty : null;
        return (
          <Card key={x.id} tone={d ? 'warn' : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="b" style={{ fontSize: 15 }}>
                {x.name}
              </T>
              <T v="small">в учёте {qtyText(x.qty, x.unit)}</T>
              {d != null ? (
                <T v="b" style={{ fontSize: 13, color: d === 0 ? t.ok : t.warn }}>
                  {d === 0 ? 'сходится ✓' : `расхождение ${signed(d, x.unit)}`}
                </T>
              ) : null}
            </View>
            <TextInput
              value={v}
              onChangeText={(val) => setFact((f) => ({ ...f, [x.id]: val }))}
              placeholder="факт"
              placeholderTextColor={t.mute}
              keyboardType="decimal-pad"
              style={{ width: 96, height: 46, borderRadius: 14, backgroundColor: t.field, color: t.fg, fontSize: 18, textAlign: 'center', fontFamily: 'Rubik_600SemiBold' }}
              accessibilityLabel={`Факт: ${x.name}`}
            />
            <Pressable onPress={() => setFact((f) => ({ ...f, [x.id]: String(x.qty).replace('.', ',') }))} accessibilityLabel="Сходится" hitSlop={6} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.card2, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check" size={18} color={t.ok} stroke={2.6} />
            </Pressable>
          </Card>
        );
      })}
      {err ? <T v="small" style={{ color: t.bad }}>{err}</T> : null}
      <View style={{ flexDirection: 'row' }}>
        <Button title={busy ? 'Сохраняю…' : entered.length ? `Сохранить · ${entered.length} поз., расхождений ${diffs.length}` : 'Введите факт хотя бы по одной позиции'} onPress={save} disabled={busy || !entered.length} />
      </View>
      <T v="small" style={{ textAlign: 'center' }}>
        ✓ справа — «сходится», не нужно вводить число
      </T>
    </Screen>
  );
}
