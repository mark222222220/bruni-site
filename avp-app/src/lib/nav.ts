import { ROLE_SECTIONS, type Role, type Section } from './types';

export const SECTION_PATH: Record<Section, string> = { index: '/', orders: '/orders', stock: '/stock', chat: '/chat', margin: '/margin', money: '/money' };

/** Путь к разделу: вкладка, если раздел в нижней панели этой роли, иначе отдельный экран. */
export function pathFor(sec: Section, role: Role) {
  const inTabs = ROLE_SECTIONS[role].slice(0, 4).includes(sec);
  if (inTabs) return SECTION_PATH[sec];
  if (sec === 'margin') return '/report-margin';
  if (sec === 'money') return '/report-money';
  return SECTION_PATH[sec];
}
