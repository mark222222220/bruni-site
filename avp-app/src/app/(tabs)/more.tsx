import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { APP_BUILD, Icon, Item, List, Pill, Screen, Section, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useData, useDerived } from '@/lib/data';
import { shareReport } from '@/lib/report';
import { getSheets } from '@/lib/sheets';
import { useMyTasks } from '@/lib/team';
import { pathFor } from '@/lib/nav';
import { useSettings } from '@/lib/settings';
import { ROLE_SECTIONS, ROLES, type Section as Sec } from '@/lib/types';

const META: Record<Sec, { name: string; about: string; icon: string }> = {
  index: { name: 'Главная', about: 'Цифры дня и сигналы', icon: 'home' },
  orders: { name: 'Заказы', about: 'Производство и отгрузки', icon: 'orders' },
  stock: { name: 'Склад', about: 'Остатки и заявка', icon: 'stock' },
  chat: { name: 'Чаты', about: 'Каналы команды', icon: 'chat' },
  margin: { name: 'Маржа', about: 'Клиенты, порог, цены', icon: 'margin' },
  money: { name: 'Деньги', about: 'Платежи недели', icon: 'money' },
};

function Badge({ icon }: { icon: string }) {
  const { t } = useSettings();
  return (
    <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} color={t.onAccent} />
    </View>
  );
}

export default function More() {
  const { s } = useSettings();
  const { kind, snap } = useData();
  const d = useDerived();
  const auth = useAuth();
  const my = useMyTasks();
  const [pdf, setPdf] = useState('');
  const extra = ROLE_SECTIONS[s.role].slice(4);
  const makePdf = async () => {
    setPdf('Готовлю отчёт…');
    try {
      await shareReport({ snap, sheets: getSheets(), role: s.role, name: s.name, balance: d.balance, due: d.due });
      setPdf('');
    } catch (e) {
      setPdf(e instanceof Error ? e.message : 'Не получилось');
    }
  };
  return (
    <Screen title="Ещё" subtitle="Все разделы">
      <List>
        <Item first onPress={() => router.push('/tasks')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Badge icon="tasks" />
            <View style={{ flex: 1 }}>
              <T v="b">Задачи</T>
              <T v="small">{my.length ? `${my.length} на вас` : 'Поручения команде'}</T>
            </View>
          </View>
        </Item>
        <Item onPress={makePdf}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Badge icon="doc" />
            <View style={{ flex: 1 }}>
              <T v="b">Отчёт PDF</T>
              <T v="small">{pdf || 'Деньги, заказы, склад — переслать одним файлом'}</T>
            </View>
          </View>
        </Item>
      </List>
      {extra.length ? (
        <List>
          {extra.map((x, i) => (
            <Item key={x} first={i === 0} onPress={() => router.push(pathFor(x, s.role) as '/')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Badge icon={META[x].icon} />
                <View style={{ flex: 1 }}>
                  <T v="b">{META[x].name}</T>
                  <T v="small">{META[x].about}</T>
                </View>
              </View>
            </Item>
          ))}
        </List>
      ) : null}
      <List>
        <Item first onPress={() => router.push('/settings')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Badge icon="settings" />
            <View style={{ flex: 1 }}>
              <T v="b">Настройки</T>
              <T v="small">Тема, цвет, крупный текст, порог</T>
            </View>
          </View>
        </Item>
      </List>
      <Section>Профиль</Section>
      <List>
        <Item first title={s.name} sub={ROLES[s.role].about} right={<Pill text={ROLES[s.role].name} tone="accent" />} onPress={auth.required ? undefined : () => router.push('/role')} />
        {auth.required && s.role === 'boss' ? <Item title="Сотрудники" sub="Добавить человека, выдать логин и пароль" onPress={() => router.push('/staff')} /> : null}
        <Item title="База данных" sub={kind === 'cloud' ? 'Закрытая: данные завода видит только команда' : 'Демо: данные только на этом телефоне'} right={<Pill text={kind === 'cloud' ? 'закрытая' : 'демо'} tone={kind === 'cloud' ? 'ok' : 'warn'} />} />
        {auth.required ? <Item title="Выйти" sub="на этом телефоне" onPress={auth.signOut} /> : null}
      </List>
      <T v="small" style={{ textAlign: 'center' }}>
        AVP system · версия {APP_BUILD} · Гласс-Хаус Крым
      </T>
    </Screen>
  );
}
