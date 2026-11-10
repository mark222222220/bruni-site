import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Button, Empty, Field, Glass, Icon, Sheet, SheetHeader, T, styles } from '@/components/ui';
import { useData } from '@/lib/data';
import { fmt, parseNum } from '@/lib/format';
import { pickPhoto, uploadPhoto } from '@/lib/photos';
import { useSettings } from '@/lib/settings';
import { useTeam } from '@/lib/team';

export default function Receipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snap, send } = useData();
  const { moves, addMove } = useTeam();
  const { t, tap } = useSettings();
  const x = snap.stock.find((s) => s.id === id);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!x)
    return (
      <Sheet>
        <SheetHeader title="Приход" />
        <Empty text="Материал не найден." />
      </Sheet>
    );
  const history = moves.filter((m) => m.item_id === x.id).slice(0, 5);

  const save = async () => {
    const q = parseNum(qty);
    if (!Number.isFinite(q) || q <= 0) {
      setErr('Введите количество');
      tap('warning');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const path = photo ? await uploadPhoto(photo, 'stock') : null;
      const e = await addMove({ item_id: x.id, item_name: x.name, qty: q, unit: x.unit, note: note.trim() || null, photo: path });
      if (e) throw new Error(e);
      // в чат «Склад» — чтобы все видели приход и накладную
      await send('stock', `📦 Приход: ${x.name} +${fmt(q, q % 1 ? 1 : 0)} ${x.unit}${note.trim() ? `\n${note.trim()}` : ''}`, null, path);
      tap('success');
      router.back();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не сохранилось');
      tap('warning');
    }
    setBusy(false);
  };

  return (
    <Sheet>
      <SheetHeader kicker="Приход на склад" title={x.name} />
      <Glass style={{ padding: 16, gap: 14 }}>
        <T v="small">
          Сейчас {fmt(x.qty, x.qty % 1 ? 1 : 0)} {x.unit}
          {x.days != null ? ` · хватит на ${fmt(x.days, 1)} дн.` : ''}
        </T>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field label={`Пришло, ${x.unit}`} value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder="0" autoFocus />
        </View>
        <Field label="Поставщик, накладная" value={note} onChangeText={setNote} placeholder={(x.supplier ?? '').split('(')[0].trim() || 'Накладная №…'} maxLength={200} />
        {photo ? (
          <View>
            <Image source={{ uri: photo }} style={{ width: '100%', height: 220, borderRadius: 16 }} resizeMode="cover" accessibilityLabel="Фото накладной" />
            <Pressable onPress={() => setPhoto(null)} accessibilityLabel="Убрать фото" style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Снять накладную" icon="camera" kind="ghost" onPress={async () => setPhoto((await pickPhoto('camera')) ?? photo)} />
            <Button title="Из галереи" icon="image" kind="ghost" onPress={async () => setPhoto((await pickPhoto('library')) ?? photo)} />
          </View>
        )}
        {err ? <T v="small" style={{ color: t.bad }}>{err}</T> : null}
      </Glass>
      <View style={{ flexDirection: 'row' }}>
        <Button title={busy ? 'Сохраняю…' : 'Принять на склад'} icon="check" onPress={save} disabled={busy} />
      </View>
      <T v="small" style={{ textAlign: 'center' }}>
        Остаток в приложении обновится сразу. Ночью цифры снова придут из таблицы — внесите приход и туда.
      </T>
      {history.length ? (
        <Glass style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
          {history.map((m, i) => (
            <View key={m.id} style={[styles.row, { justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.line }]}>
              <T v="small">
                {new Date(m.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {m.author}
              </T>
              <T v="b">
                +{fmt(m.qty, m.qty % 1 ? 1 : 0)} {m.unit}
              </T>
            </View>
          ))}
        </Glass>
      ) : null}
    </Sheet>
  );
}
