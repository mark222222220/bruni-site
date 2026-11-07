import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, Glass, Sheet, SheetHeader, T } from '@/components/ui';
import { useData } from '@/lib/data';
import { dm, parseDm, parseNum, tomorrow, uid } from '@/lib/format';
import { useSettings } from '@/lib/settings';

export default function NewPayment() {
  const { upsert } = useData();
  const { t, tap } = useSettings();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(dm(tomorrow()));
  const [err, setErr] = useState('');

  const save = async () => {
    const a = parseNum(amount),
      d = parseDm(date);
    const bad = !title.trim() ? 'Укажите назначение' : !Number.isFinite(a) || a <= 0 ? 'Проверьте сумму' : !d ? 'Дата — в виде 12.11' : '';
    if (bad) {
      setErr(bad);
      tap('warning');
      return;
    }
    if (await upsert('payments', { id: uid(), title: title.trim(), amount: a, date: d!, paid: false })) {
      tap('success');
      router.back();
    }
  };

  return (
    <Sheet>
      <SheetHeader title="Новый платёж" />
      <Glass style={{ padding: 16, gap: 14 }}>
        <Field label="Назначение" value={title} onChangeText={setTitle} placeholder="Счёт поставщика бутила" maxLength={80} autoFocus />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field label="Сумма, ₽" value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="120 000" />
          <Field label="Дата" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" placeholder="12.11" />
        </View>
        {err ? <T v="small" style={{ color: t.bad }}>{err}</T> : null}
      </Glass>
      <View style={{ flexDirection: 'row' }}>
        <Button title="Добавить" onPress={save} />
      </View>
    </Sheet>
  );
}
