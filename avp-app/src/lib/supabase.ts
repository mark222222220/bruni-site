import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Адрес и публичный ключ закрытой базы. Публичный ключ не секретный: доступ закрывают права в самой базе. */
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  URL && KEY
    ? createClient(URL, KEY, { auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
    : null;

/** Короткий логин сотрудника («olga») превращаем в адрес для входа. Письма на него не отправляются. */
export const LOGIN_DOMAIN = 'staff.avp-glasshouse.ru';
export const loginToEmail = (login: string) => {
  const l = login.trim().toLowerCase();
  return l.includes('@') ? l : `${l}@${LOGIN_DOMAIN}`;
};
