import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Avatar, Banner, Button, Card, Field, Glass, Pill, Screen, Section, T, styles } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/lib/settings';
import { supabase } from '@/lib/supabase';
import { ROLES, type Role } from '@/lib/types';

type Person = { id: string; name: string; role: Role; login: string };

type Reply = { error?: string; staff?: Person[]; ok?: boolean };
async function call(body: Record<string, unknown>): Promise<Reply> {
  if (!supabase) return { error: 'База не подключена' };
  const { data, error } = await supabase.functions.invoke('staff', { body });
  if (error) {
    const msg = await (error as { context?: Response }).context?.json?.().catch(() => null);
    return { error: msg?.error ?? 'Не получилось, попробуйте ещё раз' };
  }
  return data as Reply;
}

/** Пароль из 10 символов без похожих букв. */
const genPassword = () => Array.from({ length: 10 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');

function RolePick({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  const { t, tap } = useSettings();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {(Object.keys(ROLES) as Role[]).map((r) => (
        <Pressable
          key={r}
          onPress={() => {
            tap();
            onChange(r);
          }}
          style={{ borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: r === value ? t.accent : t.line, backgroundColor: r === value ? t.accent + '1F' : 'transparent' }}
        >
          <T v="b" style={{ fontSize: 13 }}>
            {ROLES[r].name}
          </T>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export default function Staff() {
  const { t, tap } = useSettings();
  const { profile } = useAuth();
  const [list, setList] = useState<Person[]>([]);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [role, setRole] = useState<Role>('store');
  const [password, setPassword] = useState(genPassword());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await call({ action: 'list' });
    if (r.error) setErr(r.error);
    else setList(r.staff ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (profile?.role !== 'boss')
    return (
      <Screen kicker="Команда" title="Сотрудники" back>
        <Banner text="Список сотрудников видит только руководитель." />
      </Screen>
    );

  const create = async () => {
    setBusy(true);
    setErr('');
    setDone('');
    const r = await call({ action: 'create', name, login, role, password });
    setBusy(false);
    if (r.error) {
      setErr(r.error);
      tap('warning');
      return;
    }
    tap('success');
    setDone(`Готово. Передайте ${name}: логин «${login.trim().toLowerCase()}», пароль «${password}».`);
    setName('');
    setLogin('');
    setPassword(genPassword());
    load();
  };

  return (
    <Screen kicker="Команда" title="Сотрудники" subtitle={`${list.length} в команде`} back>
      {err ? <Banner tone="bad" text={err} /> : null}
      {list.map((p) => (
        <Card key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={p.name} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="b">{p.name}</T>
            <T v="small">логин: {p.login || '—'}</T>
          </View>
          <Pill text={ROLES[p.role]?.name ?? p.role} tone={p.role === 'boss' ? 'accent' : 'neutral'} />
        </Card>
      ))}

      <Section>Добавить сотрудника</Section>
      <Glass style={{ padding: 16, gap: 14 }}>
        <Field label="Имя" value={name} onChangeText={setName} placeholder="Ольга" maxLength={40} />
        <Field label="Логин (латиницей)" value={login} onChangeText={setLogin} placeholder="olga" autoCapitalize="none" autoCorrect={false} maxLength={30} />
        <T v="label">Роль</T>
        <RolePick value={role} onChange={setRole} />
        <View style={[styles.row, { alignItems: 'flex-end' }]}>
          <Field label="Пароль" value={password} onChangeText={setPassword} autoCapitalize="none" autoCorrect={false} />
          <Pressable onPress={() => setPassword(genPassword())} style={{ paddingHorizontal: 12, height: 50, justifyContent: 'center' }} accessibilityLabel="Новый пароль">
            <T v="b" style={{ color: t.accent }}>
              ↻
            </T>
          </Pressable>
        </View>
        <T v="small">{ROLES[role].about}</T>
      </Glass>
      {done ? <Banner text={done} /> : null}
      <View style={{ flexDirection: 'row' }}>
        <Button title={busy ? 'Добавляю…' : 'Добавить'} icon="plus" disabled={busy || !name.trim() || login.trim().length < 3 || password.length < 8} onPress={create} />
      </View>
    </Screen>
  );
}
