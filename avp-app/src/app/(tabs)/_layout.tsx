import { NativeTabs } from 'expo-router/native-tabs';
import { useData } from '@/lib/data';
import { useSettings } from '@/lib/settings';
import { CHANNELS, ROLE_SECTIONS, type Section } from '@/lib/types';

/** Нижние вкладки — системные: на iOS 26 это настоящая стеклянная панель Liquid Glass. */
export default function TabsLayout() {
  const { s, t } = useSettings();
  const { snap } = useData();
  const tabs = new Set<Section>(ROLE_SECTIONS[s.role].slice(0, 4));
  const unread = s.badges ? snap.messages.filter((m) => CHANNELS.some((c) => c.id === m.channel) && m.at > (s.seen[m.channel] ?? 0) && m.author !== s.name).length : 0;
  return (
    <NativeTabs tintColor={t.accent} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index" hidden={!tabs.has('index')}>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>Главная</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="orders" hidden={!tabs.has('orders')}>
        <NativeTabs.Trigger.Icon sf={{ default: 'list.clipboard', selected: 'list.clipboard.fill' }} md="assignment" />
        <NativeTabs.Trigger.Label>Заказы</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stock" hidden={!tabs.has('stock')}>
        <NativeTabs.Trigger.Icon sf={{ default: 'shippingbox', selected: 'shippingbox.fill' }} md="inventory_2" />
        <NativeTabs.Trigger.Label>Склад</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="margin" hidden={!tabs.has('margin')}>
        <NativeTabs.Trigger.Icon sf="chart.bar" md="bar_chart" />
        <NativeTabs.Trigger.Label>Маржа</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="money" hidden={!tabs.has('money')}>
        <NativeTabs.Trigger.Icon sf="banknote" md="payments" />
        <NativeTabs.Trigger.Label>Деньги</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat" hidden={!tabs.has('chat')}>
        <NativeTabs.Trigger.Icon sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }} md="chat" />
        <NativeTabs.Trigger.Label>Чаты</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge hidden={!unread}>{unread > 9 ? '9+' : String(unread)}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Icon sf="square.grid.2x2" md="apps" />
        <NativeTabs.Trigger.Label>Ещё</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
