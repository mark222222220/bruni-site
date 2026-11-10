import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Field, Glass, Icon, Pill, Sheet, SheetHeader, T, styles } from '@/components/ui';
import { useData } from '@/lib/data';
import { dm, fmt, money, parseNum, uid } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { useTeam } from '@/lib/team';
import { CLIENT_KINDS, type Client } from '@/lib/types';

export default function ClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snap } = useData();
  const c = snap.clients.find((x) => x.id === id);
  return c?.fromSheet ? <ClientView c={c} /> : <ClientEdit id={id} />;
}

function ClientView({ c }: { c: Client }) {
  const { snap } = useData();
  const { notes, addNote, removeNote, me } = useTeam();
  const { s, t, tap } = useSettings();
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const key = c.name.trim().toLowerCase();
  const orders = snap.orders.filter((o) => o.client.trim().toLowerCase() === key).sort((a, b) => (b.ship || '').localeCompare(a.ship || ''));
  const mine = notes.filter((n) => n.client.trim().toLowerCase() === key);
  const months = Object.entries(c.byMonth ?? {});
  const maxM = Math.max(1, ...months.map(([, v]) => Math.abs(v)));
  const canNote = s.role === 'boss' || s.role === 'sales' || s.role === 'acc';
  const low = c.work < s.thr;
  const row = (k: string, v: string, bad?: boolean) => (
    <View style={[styles.row, { justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: t.line }]}>
      <T v="small">{k}</T>
      <T v="b" style={bad ? { color: t.bad } : undefined}>
        {v}
      </T>
    </View>
  );
  const save = async () => {
    if (!text.trim()) return;
    setErr('');
    if (await addNote(c.name, text)) {
      setText('');
      tap('success');
    } else setErr('Не сохранилось — возможно, в базе ещё не выполнен SQL 0.7');
  };

  return (
    <Sheet>
      <SheetHeader kicker="Клиент" title={c.name} right={c.signal ? <Pill text={c.signal} tone="warn" /> : low ? <Pill text="маржа ниже порога" tone="bad" /> : undefined} />
      <Glass style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
        {row('Выручка за 6 месяцев', `${fmt(c.rev, 2)} млн ₽`)}
        {row('Маржа за 6 месяцев', `${fmt(c.work, 1)}%`, low)}
        {c.rubM2 ? row('Цена за м²', `${fmt(c.rubM2)} ₽`) : null}
        {row('Заказов в реестре', String(orders.length))}
      </Glass>
      {months.length ? (
        <Glass style={{ padding: 16, gap: 10 }}>
          <T v="label">Маржа по месяцам</T>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 110 }}>
            {months.map(([m, v]) => (
              <View key={m} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <T v="small" style={{ fontSize: 11, color: v < s.thr ? t.bad : t.fg }}>
                  {fmt(v, 0)}%
                </T>
                <View style={{ width: '70%', maxWidth: 40, height: Math.max(4, (Math.abs(v) / maxM) * 70), borderRadius: 6, backgroundColor: v < s.thr ? t.bad : t.accent }} />
                <T v="small" style={{ fontSize: 10 }} numberOfLines={1}>
                  {m}
                </T>
              </View>
            ))}
          </View>
        </Glass>
      ) : null}
      {orders.length ? (
        <Glass style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          {orders.slice(0, 12).map((o, i) => (
            <Pressable key={o.id} onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.id } })} style={[styles.row, { justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.line }]}>
              <View style={{ flex: 1 }}>
                <T v="b" style={{ fontSize: 14 }}>
                  №{o.no} · {fmt(o.area, 1)} м²
                </T>
                <T v="small">
                  {dm(o.ship)} · {o.production ?? ''}
                </T>
              </View>
              <T v="num" style={{ fontSize: 15 }}>
                {money(o.sum)} ₽
              </T>
            </Pressable>
          ))}
        </Glass>
      ) : null}
      {canNote ? (
        <Glass style={{ padding: 16, gap: 10 }}>
          <T v="label">Заметки менеджера</T>
          {mine.map((n) => (
            <View key={n.id} style={{ gap: 2, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: t.line }}>
              <T v="body">{n.text}</T>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <T v="small" style={{ fontSize: 12 }}>
                  {n.author} · {new Date(n.at).toLocaleDateString('ru-RU')}
                </T>
                {n.user_id === me || s.role === 'boss' ? (
                  <Pressable onPress={() => removeNote(n.id)} accessibilityLabel="Удалить заметку" hitSlop={8}>
                    <Icon name="trash" size={16} color={t.mute} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
          <Field label="Новая заметка" value={text} onChangeText={setText} placeholder="Договорились о цене 2 300 ₽/м² с декабря" multiline maxLength={1000} />
          {err ? <T v="small" style={{ color: t.bad }}>{err}</T> : null}
          <View style={{ flexDirection: 'row' }}>
            <Button title="Сохранить заметку" kind="ghost" onPress={save} disabled={!text.trim()} />
          </View>
        </Glass>
      ) : null}
      <View style={{ flexDirection: 'row' }}>
        <Button
          title="Обсудить в чате"
          kind="ghost"
          icon="chat"
          onPress={() => {
            router.back();
            router.navigate({ pathname: '/chat', params: { ch: 'orders', q: `Клиент ${c.name} · маржа ${fmt(c.work, 1)}%` } });
          }}
        />
      </View>
    </Sheet>
  );
}

function ClientEdit({ id }: { id: string }) {
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
