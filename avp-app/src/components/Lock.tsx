import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { Button, Logo, T, Wallpaper } from '@/components/ui';
import { useSettings } from '@/lib/settings';

/** Через сколько в фоне снова спрашивать Face ID. */
const AFTER_MS = 60_000;

/** Проверка лица или пальца. true — подтверждено. */
export async function checkBiometrics(reason = 'Вход в AVP system'): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  try {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: 'Отмена', fallbackLabel: 'Ввести код телефона' });
    return r.success;
  } catch {
    return false;
  }
}

/** Есть ли на телефоне Face ID / Touch ID и настроен ли он. */
export async function biometricsAvailable() {
  if (Platform.OS === 'web') return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** Закрывает приложение экраном блокировки, пока не подтвердят Face ID. */
export function Lock({ children }: { children: ReactNode }) {
  const { s, t } = useSettings();
  const on = s.lock && Platform.OS !== 'web';
  const [locked, setLocked] = useState(on);
  const busy = useRef(false);
  const bg = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    if (await checkBiometrics()) setLocked(false);
    busy.current = false;
  }, []);

  useEffect(() => {
    if (!on) return setLocked(false);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background') bg.current = Date.now();
      if (st === 'active' && bg.current && Date.now() - bg.current > AFTER_MS) setLocked(true);
      if (st === 'active') bg.current = null;
    });
    return () => sub.remove();
  }, [on]);

  useEffect(() => {
    if (on && locked && AppState.currentState === 'active') unlock();
  }, [on, locked, unlock]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {on && locked ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 32 }]}>
          <Wallpaper />
          <Logo size={64} />
          <T v="h">AVP system</T>
          <T v="small" style={{ textAlign: 'center' }}>
            Приложение закрыто. Подтвердите, что это вы.
          </T>
          <View style={{ flexDirection: 'row', alignSelf: 'stretch' }}>
            <Button title="Открыть по Face ID" onPress={unlock} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
