import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { uid } from './format';
import { supabase } from './supabase';

/** Снять фото камерой или выбрать из галереи. null — отменили или нет доступа. */
export async function pickPhoto(from: 'camera' | 'library'): Promise<string | null> {
  try {
    if (from === 'camera') {
      const p = await ImagePicker.requestCameraPermissionsAsync();
      if (!p.granted) return null;
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 });
      return r.canceled ? null : r.assets[0]?.uri ?? null;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 });
    return r.canceled ? null : r.assets[0]?.uri ?? null;
  } catch {
    return null;
  }
}

/** Загружает фото в закрытое хранилище и возвращает путь. В демо-режиме — сам файл на телефоне. */
export async function uploadPhoto(uri: string, folder: 'chat' | 'stock'): Promise<string> {
  return uploadFile(uri, `${folder}/${new Date().toISOString().slice(0, 7)}/${uid()}.jpg`, 'image/jpeg');
}

/** Загрузка файла в закрытое хранилище; в демо-режиме возвращает сам файл на телефоне. */
export async function uploadFile(uri: string, path: string, contentType: string): Promise<string> {
  if (!supabase) return uri;
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from('photos').upload(path, body, { contentType });
  if (error) throw new Error(/bucket|not found/i.test(error.message) ? 'Файлы ещё не включены в базе — попросите руководителя выполнить SQL' : error.message);
  return path;
}

/* Временные ссылки на фото: хранилище закрытое, ссылка живёт час. */
const cache = new Map<string, { url: string; until: number }>();
export function usePhotoUrl(path?: string | null) {
  const direct = !path || /^(file|https?|content|ph|blob|data):/.test(path);
  const hit = path && !direct ? cache.get(path) : undefined;
  const [url, setUrl] = useState<string | null>(direct ? path ?? null : hit && hit.until > Date.now() ? hit.url : null);
  useEffect(() => {
    if (!path || direct || !supabase) return;
    const h = cache.get(path);
    if (h && h.until > Date.now()) return setUrl(h.url);
    let off = false;
    supabase.storage
      .from('photos')
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!data?.signedUrl) return;
        cache.set(path, { url: data.signedUrl, until: Date.now() + 3500e3 });
        if (!off) setUrl(data.signedUrl);
      });
    return () => {
      off = true;
    };
  }, [path, direct]);
  return url;
}
