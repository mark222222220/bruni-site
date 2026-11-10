import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './auth';
import { useSettings } from './settings';
import { supabase } from './supabase';
import { CHANNELS } from './types';

// уведомления показываем и когда приложение открыто
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const projectId: string | undefined = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;

/** Разрешение и адрес для уведомлений этого телефона. null — уведомления недоступны или запрещены. */
export async function getPushToken(ask: boolean): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  try {
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
}

/** Сохраняем адрес уведомлений в своём профиле (или стираем, если уведомления выключены). */
export async function savePushToken(userId: string, token: string): Promise<string | null> {
  if (!supabase) return 'База не подключена';
  const { error } = await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
  return error ? 'В базе ещё не включены уведомления — попросите руководителя.' : null;
}

/** Отправка уведомлений через сервис Expo. */
export async function sendPush(tokens: string[], title: string, body: string, data: Record<string, unknown>) {
  const list = [...new Set(tokens.filter((t) => t.startsWith('ExponentPushToken')))];
  if (!list.length) return;
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(list.map((to) => ({ to, title, body: body.slice(0, 180), data, sound: 'default' }))),
  }).catch(() => {});
}

/** Уведомить коллег о новом сообщении в чате. */
export async function notifyTeamAboutMessage(myId: string, myName: string, channel: string, text: string) {
  if (!supabase) return;
  const { data } = await supabase.from('profiles').select('*').neq('id', myId);
  const tokens = ((data ?? []) as { push_token?: string }[]).map((p) => p.push_token ?? '').filter(Boolean);
  const chName = CHANNELS.find((c) => c.id === channel)?.name ?? 'Чат';
  await sendPush(tokens, `${myName} · ${chName}`, text, { kind: 'chat', channel });
}

/** Регистрирует телефон для уведомлений после входа и открывает нужный чат по нажатию на уведомление. */
export function NotificationsBridge() {
  const { profile } = useAuth();
  const { s } = useSettings();

  useEffect(() => {
    if (!profile) return;
    let off = false;
    (async () => {
      if (!s.notify) {
        await savePushToken(profile.id, '');
        return;
      }
      const token = await getPushToken(true);
      if (!off && token) await savePushToken(profile.id, token);
    })();
    return () => {
      off = true;
    };
  }, [profile, s.notify]);

  useEffect(() => {
    const open = (r: Notifications.NotificationResponse | null) => {
      const d = r?.notification.request.content.data as { kind?: string; channel?: string } | undefined;
      if (d?.kind === 'chat') router.navigate({ pathname: '/chat', params: { ch: d.channel ?? 'general' } });
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);

  return null;
}
