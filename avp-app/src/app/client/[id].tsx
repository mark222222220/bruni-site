import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Field, Glass, Sheet, SheetHeader, T } from '@/components/ui';
import { useData } from '@/lib/data';
import { parseNum, uid } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { CLIENT_KINDS } from '@/lib/types';

export default function ClientEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snap, upsert, remove } = useData();
  const { t, tap } = useSettings();
  const existing = snap.clients.find((c) => c.id === id);
  const isNew = !existing;
  const c = existing ?? { id: uid(), name: '', kind: CLIENT_KINDS[0], city: '', rev: 1, mat: 35, work: 20 };
  const [name, setName] = useState(c.name);
  const [kind, setKind] = useState(c.kind);
  const [city, setCity] = useState(c.city);
  const [rev, setRev] = useState(String(c.rev).replace('.', ','));
  const [mat, setMat] = useState(String(c.mat));
  const [work, setWork] = useState(String(c.work));
  const [err, setErr] = useState('');
  const [sure, setSure] = useState(false);

  const save = async () => {
    const r = parseNum(rev),
      m = parseNum(mat),
      w = parseNum(work);
    const bad = !name.trim() ? 'Введите название' : [r, m, w].some((v) => !Number.isFinite(v)) ? 'Цифры введены неверно' : w > m ? 'Маржа после работы не может быть больше, чем после материалов' : '';
    if (bad) {
      setErr(bad);
      tap('warning');
      return;
    }
    if (await upsert('clients', { id: c.id, name: name.trim(), kind, city: city.trim(), rev: r, mat: m, work: w, example: false })) {
      tap('success');
      router.back();
    }
  };

  return (
    <Sheet>
      <SheetHeader title={isNew ? 'Новый клиент' : 'Клиент'} />
      <Glass style={{ padding: 16, gap: 14 }}>
        <Field label="Название" value={name} onChangeText={setName} placeholder="ООО «Окна Юг»" maxLength={80} />
        <T v="small">Тип</T>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CLIENT_KINDS.map((k) => (
            <Pressable
              key={k}
              onPress={() => {
                tap();
                setKind(k);
              }}
              style={{ borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: k === kind ? t.accent : t.field, borderWidth: 1, borderColor: k === kind ? t.accent : t.line }}
            >
              <T v="b" style={{ fontSize: 13, color: k === kind ? t.onAccent : t.fg }}>
                {k}
              </T>
            </Pressable>
          ))}
        </ScrollView>
        <Field label="Город" value={city} onChangeText={setCity} placeholder="Симферополь" maxLength={40} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field label="Выручка, млн/мес" value={rev} onChangeText={setRev} keyboardType="decimal-pad" />
          <Field label="После материалов, %" value={mat} onChangeText={setMat} keyboardType="decimal-pad" />
        </View>
        <Field label="После работы, %" value={work} onChangeText={setWork} keyboardType="decimal-pad" />
        {err ? <T v="small" style={{ color: t.bad }}>{err}</T> : null}
      </Glass>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button title="Сохранить" onPress={save} />
        {!isNew ? (
          <Button
            title={sure ? 'Точно удалить?' : 'Удалить'}
            kind="danger"
            onPress={async () => {
              if (!sure) return setSure(true);
              if (await remove('clients', c.id)) router.back();
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}
