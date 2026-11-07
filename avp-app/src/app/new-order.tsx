import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Field, Glass, Sheet, SheetHeader, T } from '@/components/ui';
import { useData } from '@/lib/data';
import { addDays, dm, parseDm, parseNum, uid } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { FORMULAS } from '@/lib/types';

function Chips({ values, value, onChange }: { values: string[]; value: string; onChange: (v: string) => void }) {
  const { t, tap } = useSettings();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {values.map((v) => {
        const on = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => {
              tap();
              onChange(v);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: on ? t.accent : t.field, borderWidth: 1, borderColor: on ? t.accent : t.line }}
          >
            <T v="b" style={{ fontSize: 13, color: on ? t.onAccent : t.fg }}>
              {v}
            </T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function NewOrder() {
  const { snap, upsert } = useData();
  const { tap } = useSettings();
  const no = snap.orders.reduce((a, o) => Math.max(a, o.no), 1000) + 1;
  const names = snap.clients.map((c) => c.name);
  const [client, setClient] = useState(names[0] ?? '');
  const [other, setOther] = useState('');
  const [formula, setFormula] = useState(FORMULAS[1]);
  const [qty, setQty] = useState('10');
  const [area, setArea] = useState('12');
  const [sum, setSum] = useState('');
  const [ship, setShip] = useState(dm(addDays(3)));
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  const save = async () => {
    const name = client === 'Другой' ? other.trim() : client;
    const q = parseNum(qty),
      a = parseNum(area),
      sm = parseNum(sum),
      d = parseDm(ship);
    const bad = !name ? 'Укажите клиента' : [q, a, sm].some((v) => !Number.isFinite(v) || v <= 0) ? 'Проверьте штуки, площадь и сумму' : !d ? 'Дата отгрузки — в виде 08.11' : '';
    if (bad) {
      setErr(bad);
      tap('warning');
      return;
    }
    if (await upsert('orders', { id: uid(), no, client: name, formula, qty: q, area: a, sum: sm, ship: d!, status: 'new', note: note.trim() })) {
      tap('success');
      router.back();
    }
  };

  return (
    <Sheet>
      <SheetHeader title={`Новый заказ №${no}`} />
      <Glass style={{ padding: 16, gap: 14 }}>
        <T v="small">Клиент</T>
        <Chips values={[...names, 'Другой']} value={client} onChange={setClient} />
        {client === 'Другой' || !names.length ? <Field label="Название клиента" value={other} onChangeText={setOther} maxLength={80} /> : null}
        <T v="small">Формула стеклопакета</T>
        <Chips values={FORMULAS} value={formula} onChange={setFormula} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field label="Штук" value={qty} onChangeText={setQty} keyboardType="number-pad" />
          <Field label="Площадь, м²" value={area} onChangeText={setArea} keyboardType="decimal-pad" />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field label="Сумма, ₽" value={sum} onChangeText={setSum} keyboardType="number-pad" placeholder="72 000" />
          <Field label="Отгрузка" value={ship} onChangeText={setShip} keyboardType="numbers-and-punctuation" placeholder="08.11" />
        </View>
        <Field label="Комментарий" value={note} onChangeText={setNote} maxLength={140} placeholder="Например: доставка в Саки" />
        {err ? <T v="small" style={{ color: '#FF453A' }}>{err}</T> : null}
      </Glass>
      <View style={{ flexDirection: 'row' }}>
        <Button title="Создать заказ" onPress={save} />
      </View>
    </Sheet>
  );
}
