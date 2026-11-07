export type Role = 'boss' | 'store' | 'sales' | 'acc';
export type Status = 'new' | 'cut' | 'build' | 'ready' | 'shipped';

export type Client = {
  id: string;
  name: string;
  kind: string;
  city: string;
  /** выручка, млн ₽ в месяц */
  rev: number;
  /** маржа после материалов, % */
  mat: number;
  /** маржа после материалов и труда, % */
  work: number;
  example?: boolean;
};

export type Order = {
  id: string;
  no: number;
  client: string;
  formula: string;
  qty: number;
  area: number;
  sum: number;
  /** дата отгрузки, YYYY-MM-DD */
  ship: string;
  status: Status;
  note?: string;
  example?: boolean;
};

export type StockItem = {
  id: string;
  name: string;
  unit: string;
  qty: number;
  min: number;
  pack: number;
  sort: number;
};

export type Payment = {
  id: string;
  title: string;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  paid: boolean;
};

export type Message = {
  id: string;
  channel: string;
  author: string;
  role: Role;
  text: string;
  quote?: string | null;
  /** ms since epoch */
  at: number;
};

export type Tables = {
  clients: Client;
  orders: Order;
  stock: StockItem;
  payments: Payment;
  messages: Message;
};
export type TableName = keyof Tables;
export type Snapshot = { [K in TableName]: Tables[K][] };

export const ROLES: Record<Role, { name: string; about: string }> = {
  boss: { name: 'Руководитель', about: 'Все разделы, сигналы и настройки' },
  store: { name: 'Кладовщица', about: 'Остатки, приход, заявка, заказы в цеху' },
  sales: { name: 'Менеджер', about: 'Заказы клиентов и маржа' },
  acc: { name: 'Бухгалтер', about: 'Платежи и деньги' },
};

export const STATUSES: { id: Status; name: string }[] = [
  { id: 'new', name: 'Принят' },
  { id: 'cut', name: 'Раскрой' },
  { id: 'build', name: 'Сборка' },
  { id: 'ready', name: 'Готов' },
  { id: 'shipped', name: 'Отгружен' },
];

export const FORMULAS = [
  '4М1-16-4М1',
  '4М1-16Ar-4И',
  '4М1-12-4М1-12-4И',
  '4М1-10Ar-4М1-10Ar-4И',
  '6М1-14Ar-4М1-14Ar-6И',
  '4Мульти-16Ar-4М1',
];

export const CLIENT_KINDS = ['Оконная компания', 'Дилер', 'Застройщик', 'Фасадная компания', 'Частные заказчики', 'Другое'];

export const CHANNELS = [
  { id: 'general', name: 'Общий' },
  { id: 'orders', name: 'Заказы' },
  { id: 'stock', name: 'Склад' },
  { id: 'money', name: 'Деньги' },
];

/** Какие разделы видит роль. Первые четыре попадают в нижние вкладки. */
export const ROLE_SECTIONS: Record<Role, Section[]> = {
  boss: ['index', 'orders', 'stock', 'chat', 'margin', 'money'],
  store: ['stock', 'orders', 'chat'],
  sales: ['index', 'orders', 'margin', 'chat'],
  acc: ['money', 'index', 'chat'],
};
export type Section = 'index' | 'orders' | 'stock' | 'chat' | 'margin' | 'money';
