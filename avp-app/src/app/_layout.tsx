import { Rubik_400Regular, Rubik_600SemiBold, Rubik_700Bold, Rubik_800ExtraBold, useFonts } from '@expo-google-fonts/rubik';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Login } from '@/components/Login';
import { Onboarding } from '@/components/Onboarding';
import { AuthProvider, useAuth } from '@/lib/auth';
import { DataProvider } from '@/lib/data';
import { SettingsProvider, useSettings } from '@/lib/settings';

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
    <DataProvider>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="report-margin" />
        <Stack.Screen name="report-money" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="staff" />
        <Stack.Screen name="team" />
        <Stack.Screen name="role" options={{ ...sheet, sheetAllowedDetents: [0.6, 1] }} />
        <Stack.Screen name="order/[id]" options={sheet} />
        <Stack.Screen name="new-order" options={{ ...sheet, sheetAllowedDetents: [1] }} />
        <Stack.Screen name="client/[id]" options={{ ...sheet, sheetAllowedDetents: [1] }} />
        <Stack.Screen name="new-payment" options={{ ...sheet, sheetAllowedDetents: [0.6, 1] }} />
      </Stack>
    </DataProvider>
  );
}

export default function Layout() {
  const [loaded, error] = useFonts({ Rubik_400Regular, Rubik_600SemiBold, Rubik_700Bold, Rubik_800ExtraBold });
  // в веб-сборке одним файлом шрифты встроены в страницу; если загрузка не удалась — показываем системный шрифт
  const fonts = loaded || !!error || Platform.OS === 'web';
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AuthProvider>{fonts ? <Root /> : <View style={{ flex: 1, backgroundColor: '#08080C' }} />}</AuthProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
