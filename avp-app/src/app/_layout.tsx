import { Rubik_400Regular, Rubik_600SemiBold, Rubik_700Bold, Rubik_800ExtraBold, useFonts } from '@expo-google-fonts/rubik';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Confetti } from '@/components/Confetti';
import { Intro } from '@/components/Intro';
import { Lock } from '@/components/Lock';
import { Shake } from '@/components/Shake';
import { Login } from '@/components/Login';
import { Onboarding } from '@/components/Onboarding';
import { AuthProvider, useAuth } from '@/lib/auth';
import { CallProvider } from '@/lib/calls';
import { NotificationsBridge } from '@/lib/notifications';
import { DataProvider } from '@/lib/data';
import { SettingsProvider, useSettings } from '@/lib/settings';
import { TeamProvider } from '@/lib/team';

const sheet = {
  presentation: 'formSheet' as const,
  sheetAllowedDetents: [0.75, 1],
  sheetGrabberVisible: true,
  sheetCornerRadius: 28,
  headerShown: false,
};

function Root() {
  const { s, t, ready } = useSettings();
  const auth = useAuth();
  if (!ready || !auth.ready) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  // рабочий режим: вход по логину и паролю, имя и роль — из базы
  if (auth.required && (!auth.session || !auth.profile)) return <Login />;
  if (!auth.required && !s.name) return <Onboarding />;
  return (
    <Lock>
    <TeamProvider>
    <DataProvider>
    <CallProvider>
      {auth.required ? <NotificationsBridge /> : null}
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="report-margin" />
        <Stack.Screen name="report-money" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="staff" />
        <Stack.Screen name="role" options={{ ...sheet, sheetAllowedDetents: [0.6, 1] }} />
        <Stack.Screen name="order/[id]" options={sheet} />
        <Stack.Screen name="new-order" options={{ ...sheet, sheetAllowedDetents: [1] }} />
        <Stack.Screen name="client/[id]" options={{ ...sheet, sheetAllowedDetents: [1] }} />
        <Stack.Screen name="new-payment" options={{ ...sheet, sheetAllowedDetents: [0.6, 1] }} />
        <Stack.Screen name="tasks" />
        <Stack.Screen name="new-task" options={{ ...sheet, sheetAllowedDetents: [0.75, 1] }} />
        <Stack.Screen name="receipt" options={{ ...sheet, sheetAllowedDetents: [1] }} />
        <Stack.Screen name="stock-move" options={{ ...sheet, sheetAllowedDetents: [1] }} />
        <Stack.Screen name="stock-item" options={{ ...sheet, sheetAllowedDetents: [0.75, 1] }} />
        <Stack.Screen name="inventory" />
        <Stack.Screen name="stock-log" />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="call" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="team" />
      </Stack>
      <Shake />
      <Confetti />
    </CallProvider>
    </DataProvider>
    </TeamProvider>
    </Lock>
  );
}

export default function Layout() {
  const [loaded, error] = useFonts({ Rubik_400Regular, Rubik_600SemiBold, Rubik_700Bold, Rubik_800ExtraBold });
  // в веб-сборке одним файлом шрифты встроены в страницу; если загрузка не удалась — показываем системный шрифт
  const fonts = loaded || !!error || Platform.OS === 'web';
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AuthProvider>
          {fonts ? (
            <View style={{ flex: 1 }}>
              <Root />
              <Intro />
            </View>
          ) : (
            <View style={{ flex: 1, backgroundColor: '#08080C' }} />
          )}
        </AuthProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
