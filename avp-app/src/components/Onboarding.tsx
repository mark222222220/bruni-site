import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field, Glass, Mark, T, Wallpaper } from './ui';
import { useSettings } from '@/lib/settings';
import { ROLES, type Role } from '@/lib/types';

/** Первый запуск: имя и роль. Хранятся на телефоне. */
export function Onboarding() {
  const { s, t, set, tap } = useSettings();
  const ins = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>(s.role);
  const ok = name.trim().length >= 2;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Wallpaper />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: ins.top + 40, paddingBottom: ins.bottom + 24, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 8, marginBottom: 8 }}>
            <T v="kicker">Пульт руководителя завода</T>
            <Mark width={220} />
            <T v="label" style={{ letterSpacing: 9, fontSize: 14, marginLeft: 4 }}>system</T>
          </View>
          <View style={{ gap: 6 }}>
            <T v="h" style={{ color: t.dim, fontFamily: 'Rubik_400Regular', lineHeight: 28 }}>
              Маржа, склад, заказы, деньги и люди — на одном экране.
            </T>
          </View>
          <Glass style={{ padding: 16, gap: 14 }}>
            <Field label="Как вас зовут" value={name} onChangeText={setName} placeholder="Анатолий" autoFocus returnKeyType="done" maxLength={40} autoCapitalize="words" />
            <T v="small">Ваша роль</T>
            <View style={{ gap: 8 }}>
              {(Object.keys(ROLES) as Role[]).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => {
                    tap();
                    setRole(r);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: role === r }}
                  style={{ borderRadius: 16, borderWidth: 1.5, borderColor: role === r ? t.accent : t.line, padding: 14, backgroundColor: role === r ? t.accent + '14' : t.field }}
                >
                  <T v="b">{ROLES[r].name}</T>
                  <T v="small">{ROLES[r].about}</T>
                </Pressable>
              ))}
            </View>
          </Glass>
          <View style={{ flexDirection: 'row' }}>
            <Button title="Начать работу" disabled={!ok} onPress={() => set({ name: name.trim(), role })} />
          </View>
          <T v="small" style={{ textAlign: 'center' }}>
            Имя видно коллегам в чатах. Изменить можно в настройках.
          </T>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
