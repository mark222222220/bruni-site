import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Field, Glass, Item, List, Screen, Section, Stepper, T, Toggle } from '@/components/ui';
import { biometricsAvailable, checkBiometrics } from '@/components/Lock';
import { useData } from '@/lib/data';
import { useSettings, type Accent, type Skin } from '@/lib/settings';
import { ROLES } from '@/lib/types';

const SKINS: { id: Skin; name: string; bg: string; card: string; split?: boolean }[] = [
  { id: 'avp', name: 'AVP', bg: '#1a0c05', card: '#26262b' },
  { id: 'auto', name: 'Как в системе', bg: '#111', card: 'rgba(127,127,127,0.35)', split: true },
  { id: 'glass-dark', name: 'Стекло тёмное', bg: '#1a0f14', card: 'rgba(255,255,255,0.22)' },
  { id: 'glass-light', name: 'Стекло светлое', bg: '#f3e6ee', card: 'rgba(255,255,255,0.75)' },
  { id: 'solid-dark', name: 'Графит', bg: '#0c0c0e', card: '#26262b' },
  { id: 'solid-light', name: 'Светлая', bg: '#f2f2f6', card: '#ffffff' },
];
const ACCENTS: { id: Accent; c: string; name: string }[] = [
  { id: 'orange', c: '#FF6A1A', name: 'Оранжевый' },
  { id: 'blue', c: '#0A84FF', name: 'Синий' },
  { id: 'green', c: '#30B94F', name: 'Зелёный' },
  { id: 'violet', c: '#A95CF0', name: 'Фиолетовый' },
];

export default function Settings() {
  const { s, t, set, reset, tap } = useSettings();
  const { kind, resetDemo } = useData();
  const [name, setName] = useState(s.name);
  const [sure, setSure] = useState<'reset' | 'demo' | null>(null);
  const [bioMsg, setBioMsg] = useState('');
  const toggleLock = async (v: boolean) => {
    setBioMsg('');
    if (v && !(await biometricsAvailable())) return setBioMsg('На телефоне не настроен Face ID или Touch ID');
    // включение и выключение — только после проверки лица
    if (await checkBiometrics(v ? 'Включить вход по Face ID' : 'Выключить вход по Face ID')) set({ lock: v });
  };

  return (
    <Screen kicker="Приложение" title="Настройки" subtitle="Оформление и удобство" back>
      <Section>Тема</Section>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SKINS.map((k) => {
          const on = s.skin === k.id;
          return (
            <Pressable
              key={k.id}
              onPress={() => {
                tap();
                set({ skin: k.id });
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{ width: '31.5%' }}
            >
              <Glass radius={18} style={{ padding: 6, gap: 6, borderWidth: 2, borderColor: on ? t.accent : 'transparent' }}>
                <View style={{ height: 64, borderRadius: 12, overflow: 'hidden', backgroundColor: k.bg, justifyContent: 'flex-end', padding: 8 }}>
                  {k.split ? <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%', backgroundColor: '#eef0f6' }} /> : null}
                  <View style={{ height: 18, borderRadius: 7, backgroundColor: k.card }} />
                </View>
                <T v="small" style={{ color: t.fg, fontSize: 12, textAlign: 'center' }} numberOfLines={1}>
                  {k.name}
                </T>
              </Glass>
            </Pressable>
          );
        })}
      </View>

      <Section>Цвет акцента</Section>
      <Glass style={{ padding: 16, flexDirection: 'row', gap: 14 }}>
        {ACCENTS.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => {
              tap();
              set({ accent: a.id });
            }}
            accessibilityLabel={a.name}
            accessibilityState={{ selected: s.accent === a.id }}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: a.c, borderWidth: 3, borderColor: s.accent === a.id ? t.fg : 'transparent' }}
          />
        ))}
      </Glass>

      <Section>Удобство</Section>
      <List>
        <Item first title="Крупный текст" sub="для чтения в цеху" right={<Toggle label="Крупный текст" value={s.big} onChange={(v) => set({ big: v })} />} />
        <Item title="Вибрация при нажатиях" sub="лёгкий отклик кнопок" right={<Toggle label="Вибрация" value={s.haptics} onChange={(v) => set({ haptics: v })} />} />
        <Item title="Счётчик непрочитанных" sub="цифра на вкладке «Чаты»" right={<Toggle label="Счётчик" value={s.badges} onChange={(v) => set({ badges: v })} />} />
        <Item title="Уведомления" sub="сообщения, задачи, заказы и утренняя сводка в 8:00" right={<Toggle label="Уведомления" value={s.notify} onChange={(v) => set({ notify: v })} />} />
        <Item title="Вход по Face ID" sub={bioMsg || 'спрашивать лицо при открытии приложения'} right={<Toggle label="Вход по Face ID" value={s.lock} onChange={toggleLock} />} />
      </List>

      <Section>Маржа</Section>
      <List>
        <Item first title="Порог маржи, %" sub="ниже — сигнал на главной" right={<Stepper label="Порог маржи" value={s.thr} onChange={(v) => set({ thr: Math.min(60, Math.round(v)) })} />} />
      </List>

      <Section>Профиль</Section>
      <Glass style={{ padding: 16, gap: 12 }}>
        <Field label="Как вас зовут" value={name} onChangeText={setName} onBlur={() => name.trim() && set({ name: name.trim() })} returnKeyType="done" maxLength={40} />
      </Glass>
      <List>
        <Item first title={`Роль: ${ROLES[s.role].name}`} sub={ROLES[s.role].about} onPress={() => router.push('/role')} />
      </List>

      <Section>Устройство</Section>
      <List>
        <Item
          first
          title={sure === 'reset' ? 'Нажмите ещё раз для сброса' : 'Сбросить оформление'}
          sub="тема, цвет и переключатели на этом телефоне"
          onPress={() => {
            if (sure === 'reset') {
              reset();
              setSure(null);
              tap('success');
            } else setSure('reset');
          }}
        />
        {kind === 'local' ? (
          <Item
            title={sure === 'demo' ? 'Нажмите ещё раз — данные сотрутся' : 'Вернуть демо-данные'}
            sub="заказы, склад и чаты на этом телефоне"
            onPress={async () => {
              if (sure === 'demo') {
                await resetDemo();
                setSure(null);
                tap('success');
              } else setSure('demo');
            }}
          />
        ) : null}
      </List>
      <View style={{ flexDirection: 'row' }}>
        <Button title="Готово" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    </Screen>
  );
}
