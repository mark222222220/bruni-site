import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, TextInput, View } from 'react-native';
import { celebrate } from '@/components/Confetti';
import { Button, Field, Glass, Icon, Pill, Segmented, Sheet, SheetHeader, T, styles } from '@/components/ui';
import { useData } from '@/lib/data';
import { fmt, parseNum } from '@/lib/format';
import { pickPhoto, uploadPhoto } from '@/lib/photos';
import { useSettings } from '@/lib/settings';
import { hm, MOVE, qtyText, signed, WRITEOFF_REASONS } from '@/lib/stock';
import { useTeam, type MoveKind } from '@/lib/team';

function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const { t, tap } = useSettings();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={{ borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: on ? t.accent : t.field, borderWidth: 1, borderColor: on ? t.accent : t.line }}
    >
      <T v="b" style={{ fontSize: 14, color: on ? t.onAccent : t.fg }}>
        {label}
      </T>
    </Pressable>
  );
}

/** Одна складская операция: приход, выдача в цех или списание. */
export default function StockMove() {
  const p = useLocalSearchParams<{ kind?: MoveKind; id?: string }>();
  const { snap, send } = useData();
  const { moves, addMove, people, notify } = useTeam();
  const { s, t, tap } = useSettings();
  const [kind, setKind] = useState<MoveKind>(p.kind === 'out' || p.kind === 'writeoff' ? p.kind : 'in');
  const [id, setId] = useState(p.id ?? '');
  const [q, setQ] = useState('');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [reason, setReason] = useState(WRITEOFF_REASONS[0]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const M = MOVE[kind];
  const x = snap.stock.find((i) => i.id === id);
  const found = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return snap.stock
      .filter((i) => !qq || `${i.name} ${i.group ?? ''}`.toLowerCase().includes(qq))
      .sort((a, b) => a.sort - b.sort)
      .slice(0, 30);
  }, [snap.stock, q]);
  // заказы в работе — для выдачи в цех
  const orders = useMemo(() => snap.orders.filter((o) => o.status !== 'shipped').sort((a, b) => (a.ship || '9').localeCompare(b.ship || '9')).slice(0, 12), [snap.orders]);
  const history = x ? moves.filter((m) => m.item_id === x.id).slice(0, 5) : [];

  const save = async () => {
    if (!x) return;
    const n = parseNum(qty);
    if (!Number.isFinite(n) || n <= 0) {
      setErr('Введите количество');
      tap('warning');
      return;
    }
    if (M.sign < 0 && n > x.qty + 1e-9) {
      setErr(`На складе только ${qtyText(x.qty, x.unit)}. Если по факту больше — сначала сделайте пересчёт.`);
      tap('warning');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const path = photo ? await uploadPhoto(photo, 'stock') : null;
      const text = kind === 'writeoff' ? [reason, note.trim()].filter(Boolean).join(' · ') : note.trim();
      const e = await addMove({ kind, item_id: x.id, item_name: x.name, qty: M.sign * n, unit: x.unit, note: text || null, photo: path, order_no: kind === 'out' && orderNo.trim() ? orderNo.trim() : null });
      if (e) throw new Error(e);
      const left = x.qty + M.sign * n;
      // в чат «Склад»: приход и списание; выдача в цех — только в журнал
      if (kind !== 'out') await send('stock', `${M.emoji} ${M.name}: ${x.name} ${signed(M.sign * n, x.unit)}${text ? `\n${text}` : ''}`, null, path);
      const days = x.weekly ? Math.max(0, left) / (x.weekly / 7) : null;
      if (M.sign < 0 && days != null && days < 3) {
        notify(
          people.filter((u) => u.role === 'boss'),
          `⚠️ Заканчивается: ${x.name}`,
          `осталось ${qtyText(Math.max(0, left), x.unit)} — хватит на ${fmt(days, 1)} дн.`,
          { kind: 'stock' },
        );
      }
      if (kind === 'writeoff') notify(people.filter((u) => u.role === 'boss'), `🗑 Списание: ${x.name}`, `${qtyText(n, x.unit)} · ${text} · ${s.name}`, { kind: 'stock' });
      tap('success');
      celebrate(`${M.done}: ${signed(M.sign * n, x.unit)} ${M.emoji}`);
      router.back();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не сохранилось');
      tap('warning');
    }
    setBusy(false);
  };

  return (
    <Sheet>
      <SheetHeader kicker="Склад" title={x ? x.name : 'Операция'} />
      <Segmented
        value={kind}
        onChange={(v) => {
          setKind(v);
          setErr('');
        }}
        options={[
          { value: 'in', label: 'Приход' },
          { value: 'out', label: 'Выдача' },
          { value: 'writeoff', label: 'Списание' },
        ]}
      />
      {!x ? (
        <Glass style={{ padding: 12, gap: 8 }}>
          <View style={[styles.row, { gap: 8, paddingHorizontal: 6 }]}>
            <Icon name="search" size={18} color={t.mute} />
            <TextInput value={q} onChangeText={setQ} placeholder="Найти материал" placeholderTextColor={t.mute} autoFocus style={{ flex: 1, color: t.fg, fontSize: 16, fontFamily: 'Rubik_400Regular', height: 42 }} accessibilityLabel="Поиск материала" />
          </View>
          {found.map((i) => (
            <Pressable key={i.id} onPress={() => setId(i.id)} style={({ pressed }) => [styles.row, { justifyContent: 'space-between', padding: 10, borderRadius: 12, backgroundColor: pressed ? t.line : 'transparent' }]}>
              <View style={{ flex: 1 }}>
                <T v="b">{i.name}</T>
                <T v="small">{i.group}</T>
              </View>
              <T v="num" style={{ fontSize: 15, color: i.status === 'Мало' ? t.bad : t.fg }}>
                {qtyText(i.qty, i.unit)}
              </T>
            </Pressable>
          ))}
        </Glass>
      ) : (
        <>
          <Glass style={{ padding: 16, gap: 14 }}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <T v="small">
                На складе {qtyText(x.qty, x.unit)}
                {x.days != null ? ` · хватит на ${fmt(x.days, 1)} дн.` : ''}
              </T>
              {p.id ? null : (
                <Pressable onPress={() => setId('')} hitSlop={8}>
                  <T v="b" style={{ color: t.accent, fontSize: 13 }}>
                    другой
                  </T>
                </Pressable>
              )}
            </View>
            <Field label={`${kind === 'in' ? 'Пришло' : kind === 'out' ? 'Выдать' : 'Списать'}, ${x.unit}`} value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder="0" autoFocus />
            {qty && Number.isFinite(parseNum(qty)) ? (
              <T v="small" style={{ marginTop: -6 }}>
                станет {qtyText(Math.max(0, x.qty + M.sign * parseNum(qty)), x.unit)}
              </T>
            ) : null}
            {kind === 'out' ? (
              <>
                <T v="small">Для какого заказа (необязательно)</T>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, alignItems: "flex-start" }} keyboardShouldPersistTaps="handled">
                  {orders.map((o) => (
                    <Chip key={o.id} on={orderNo === String(o.no)} label={`№${o.no} · ${o.client.slice(0, 14)}`} onPress={() => setOrderNo(orderNo === String(o.no) ? '' : String(o.no))} />
                  ))}
                </ScrollView>
              </>
            ) : null}
            {kind === 'writeoff' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {WRITEOFF_REASONS.map((r) => (
                  <Chip key={r} on={reason === r} label={r} onPress={() => setReason(r)} />
                ))}
              </View>
            ) : null}
            <Field
              label={kind === 'in' ? 'Поставщик, накладная' : kind === 'out' ? 'Кому / на какой участок' : 'Подробнее'}
              value={note}
              onChangeText={setNote}
              placeholder={kind === 'in' ? (x.supplier ?? '').split('(')[0].trim() || 'Накладная №…' : kind === 'out' ? 'Участок резки' : 'Что случилось'}
              maxLength={200}
            />
            {kind !== 'out' ? (
              photo ? (
                <View>
                  <Image source={{ uri: photo }} style={{ width: '100%', height: 200, borderRadius: 16 }} resizeMode="cover" accessibilityLabel="Фото" />
                  <Pressable onPress={() => setPhoto(null)} accessibilityLabel="Убрать фото" style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="close" size={18} color="#fff" />
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button title={kind === 'in' ? 'Снять накладную' : 'Снять брак'} icon="camera" kind="ghost" onPress={async () => setPhoto((await pickPhoto('camera')) ?? photo)} />
                  <Button title="Галерея" icon="image" kind="ghost" onPress={async () => setPhoto((await pickPhoto('library')) ?? photo)} />
                </View>
              )
            ) : null}
            {err ? <T v="small" style={{ color: t.bad }}>{err}</T> : null}
          </Glass>
          <View style={{ flexDirection: 'row' }}>
            <Button title={busy ? 'Сохраняю…' : M.verb} icon={kind === 'in' ? 'check' : undefined} kind={kind === 'writeoff' ? 'danger' : 'primary'} onPress={save} disabled={busy} />
          </View>
          {history.length ? (
            <Glass style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
              {history.map((m, i) => (
                <View key={m.id} style={[styles.row, { justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.line }]}>
                  <View style={{ flex: 1 }}>
                    <T v="b" style={{ fontSize: 14 }}>
                      {MOVE[m.kind].name}
                    </T>
                    <T v="small" numberOfLines={1}>
                      {new Date(m.at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} {hm(m.at)} · {m.author}
                    </T>
                  </View>
                  <Pill text={signed(m.qty, m.unit)} tone={m.qty > 0 ? 'ok' : 'neutral'} />
                </View>
              ))}
            </Glass>
          ) : null}
        </>
      )}
    </Sheet>
  );
}
