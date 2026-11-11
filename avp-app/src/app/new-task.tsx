import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Field, Glass, Sheet, SheetHeader, T } from '@/components/ui';
import { addDays, today, tomorrow } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { firstName, useTeam, type Person } from '@/lib/team';
import { ROLES } from '@/lib/types';

const DUES = [
  { id: 'today', name: 'Сегодня', v: () => today() },
  { id: 'tomorrow', name: 'Завтра', v: () => tomorrow() },
  { id: 'week', name: 'За неделю', v: () => addDays(7) },
  { id: 'none', name: 'Без срока', v: () => null },
];

function Chip({ on, label, sub, onPress }: { on: boolean; label: string; sub?: string; onPress: () => void }) {
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
      {sub ? (
        <T v="small" style={{ fontSize: 11, color: on ? t.onAccent : t.dim, opacity: on ? 0.8 : 1 }}>
          {sub}
        </T>
      ) : null}
    </Pressable>
  );
}

export default function NewTask() {
  const p = useLocalSearchParams<{ text?: string; ch?: string; to?: string }>();
  const { people, me, addTask } = useTeam();
  const { t, tap } = useSettings();
  const [title, setTitle] = useState(p.text ?? '');
  const [to, setTo] = useState<Person | null>(people.find((x) => x.id === p.to) ?? null);
  const [due, setDue] = useState('tomorrow');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const others = people.filter((x) => x.id !== me);
  const self = people.find((x) => x.id === me) ?? null;

  const save = async () => {
    if (!title.trim()) {
      setErr('Напишите, что нужно сделать');
      tap('warning');
      return;
    }
    setBusy(true);
    const ok = await addTask(title, to ?? self, DUES.find((d) => d.id === due)!.v(), p.ch ?? null);
    setBusy(false);
    if (ok) {
      tap('success');
      router.back();
    } else setErr('Не сохранилось — проверьте связь');
  };

  return (
    <Sheet>
      <SheetHeader title="Новая задача" />
      <Glass style={{ padding: 16, gap: 14 }}>
        <Field label="Что сделать" value={title} onChangeText={setTitle} placeholder="Заказать бутил у поставщика" multiline maxLength={500} autoFocus={!p.text} style={{ minHeight: 70 }} />
        <T v="small">Кому</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, alignItems: "flex-start" }}>
          <Chip on={!to || to.id === me} label="Себе" onPress={() => setTo(null)} />
          {others.map((x) => (
            <Chip key={x.id} on={to?.id === x.id} label={firstName(x.name)} sub={ROLES[x.role]?.name} onPress={() => setTo(x)} />
          ))}
        </ScrollView>
        <T v="small">Срок</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {DUES.map((d) => (
            <Chip key={d.id} on={due === d.id} label={d.name} onPress={() => setDue(d.id)} />
          ))}
        </View>
        {err ? <T v="small" style={{ color: t.bad }}>{err}</T> : null}
      </Glass>
      <View style={{ flexDirection: 'row' }}>
        <Button title={busy ? 'Сохраняю…' : to && to.id !== me ? `Поручить: ${firstName(to.name)}` : 'Добавить'} onPress={save} disabled={busy} />
      </View>
      <T v="small" style={{ textAlign: 'center' }}>
        Исполнитель получит уведомление на телефон
      </T>
    </Sheet>
  );
}
