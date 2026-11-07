import { Rubik_400Regular, Rubik_600SemiBold, Rubik_700Bold, Rubik_800ExtraBold, useFonts } from '@expo-google-fonts/rubik';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Onboarding } from '@/components/Onboarding';
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
  if (!ready) return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  if (!s.name) return <Onboarding />;
  return (
    <DataProvider>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="report-margin" />
        <Stack.Screen name="report-money" />
        <Stack.Screen name="settings" />
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
  const [fonts] = useFonts({ Rubik_400Regular, Rubik_600SemiBold, Rubik_700Bold, Rubik_800ExtraBold });
  return (
    <SafeAreaProvider>
      <SettingsProvider>{fonts ? <Root /> : <View style={{ flex: 1, backgroundColor: '#08080C' }} />}</SettingsProvider>
    </SafeAreaProvider>
  );
}
