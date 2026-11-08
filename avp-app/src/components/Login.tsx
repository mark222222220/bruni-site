import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Field, Glass, Mark, T, Wallpaper } from './ui';
import { useAuth } from '@/lib/auth';
import { useSettings } from '@/lib/settings';

/** Вход сотрудника. Логин и пароль выдаёт руководитель. */
export function Login() {
  const { t, tap } = useSettings();
  const { signIn, noAccess, signOut, session } = useAuth();
  const ins = useSafeAreaInsets();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const go = async () => {
    setBusy(true);
    setErr('');
    const e = await signIn(login, password);
    setBusy(false);
    if (e) {
      setErr(e);
      tap('warning');
    } else tap('success');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Wallpaper />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: ins.top + 48, paddingBottom: ins.bottom + 24, gap: 18 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 8 }}>
            <T v="kicker">Гласс-Хаус Крым</T>
            <Mark width={220} />
            <T v="label" style={{ letterSpacing: 9, fontSize: 14, marginLeft: 4 }}>
              system
            </T>
          </View>
          {session && noAccess ? (
            <Glass style={{ padding: 18, gap: 12 }}>
              <T v="h">Нет доступа</T>
              <T v="body" style={{ color: t.dim }}>
                Вы вошли, но руководитель ещё не добавил вас в команду. Попросите его открыть «Ещё → Сотрудники».
              </T>
              <View style={{ flexDirection: 'row' }}>
                <Button title="Выйти" kind="ghost" onPress={signOut} />
              </View>
            </Glass>
          ) : (
            <>
              <T v="h" style={{ color: t.dim, fontFamily: 'Rubik_400Regular', lineHeight: 28 }}>
                Войдите, чтобы видеть цифры завода и чат команды.
              </T>
              <Glass style={{ padding: 16, gap: 14 }}>
                <Field label="Логин" value={login} onChangeText={setLogin} placeholder="например, olga" autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" returnKeyType="next" />
                <Field label="Пароль" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" returnKeyType="go" onSubmitEditing={go} />
                {err ? (
                  <T v="small" style={{ color: t.bad }}>
                    {err}
                  </T>
                ) : null}
              </Glass>
              <View style={{ flexDirection: 'row' }}>
                <Button title={busy ? 'Входим…' : 'Войти'} disabled={busy || !login.trim() || !password} onPress={go} />
              </View>
              <T v="small" style={{ textAlign: 'center' }}>
                Логин и пароль выдаёт руководитель. Если забыли — попросите его задать новый.
              </T>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
