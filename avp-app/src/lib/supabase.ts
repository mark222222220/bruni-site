import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Адрес и публичный ключ закрытой базы. Публичный ключ не секретный: доступ закрывают права в самой базе. */
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://ecwfbneokqqzwmtmauwc.supabase.co';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_4N014xstCBNbs06X5bQBHQ_6MRgzrOQ';
/** Демо без базы: EXPO_PUBLIC_AVP_DEMO=1 */
const DEMO = process.env.EXPO_PUBLIC_AVP_DEMO === '1';

export const supabase: SupabaseClient | null =
  !DEMO && URL && KEY
    ? createClient(URL, KEY, { auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
    : null;

/** Короткий логин сотрудника («olga») превращаем в адрес для входа. Письма на него не отправляются. */
export const LOGIN_DOMAIN = 'staff.avp-glasshouse.ru';
export const loginToEmail = (login: string) => {
  const l = login.trim().toLowerCase();
  return l.includes('@') ? l : `${l}@${LOGIN_DOMAIN}`;
};
