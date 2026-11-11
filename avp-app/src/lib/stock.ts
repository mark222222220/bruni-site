import type { MoveKind } from './team';
import { fmt } from './format';

export const MOVE: Record<MoveKind, { name: string; verb: string; done: string; icon: string; emoji: string; sign: 1 | -1 }> = {
  in: { name: 'Приход', verb: 'Принять на склад', done: 'Принято', icon: 'plus', emoji: '📦', sign: 1 },
  out: { name: 'Выдача в цех', verb: 'Выдать в цех', done: 'Выдано', icon: 'truck', emoji: '🏭', sign: -1 },
  writeoff: { name: 'Списание', verb: 'Списать', done: 'Списано', icon: 'trash', emoji: '🗑', sign: -1 },
  count: { name: 'Инвентаризация', verb: 'Сохранить пересчёт', done: 'Пересчитано', icon: 'check', emoji: '📋', sign: 1 },
};
export const WRITEOFF_REASONS = ['Брак стекла', 'Бой при резке', 'Бой при перевозке', 'Порча, истёк срок', 'Другое'];

export const qtyText = (n: number, unit: string) => `${fmt(n, n % 1 ? 1 : 0)} ${unit}`;
export const signed = (n: number, unit: string) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${qtyText(Math.abs(n), unit)}`;

/** QR на наклейке: по названию материала — оно не меняется, когда в таблице двигают строки. */
export const qrFor = (name: string) => 'avp:s:' + encodeURIComponent(name);
export const nameFromQr = (data: string) => (data.startsWith('avp:s:') ? decodeURIComponent(data.slice(6)) : null);

export const dayKey = (at: number) => new Date(at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' });
export const hm = (at: number) => new Date(at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
