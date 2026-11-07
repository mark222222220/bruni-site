import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field, Glass, Logo, T, Wallpaper } from './ui';
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
          <Logo size={64} />
          <View style={{ gap: 6 }}>
            <T v="title">AVP system</T>
            <T v="body" style={{ color: t.dim }}>
              Маржа, склад, заказы, деньги и чаты завода — на одном экране.
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
                  style={{ borderRadius: 14, borderWidth: 2, borderColor: role === r ? t.accent : t.line, padding: 12, backgroundColor: t.field }}
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
