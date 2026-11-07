import { addDays } from './format';
import type { Snapshot } from './types';

/** Демо-данные для первого запуска без облачной базы. Все записи помечены как пример. */
export function demoSnapshot(): Snapshot {
  const now = Date.now();
  return {
    clients: [
      { id: 'ex1', name: 'Оконная компания №1', kind: 'Оконная компания', city: 'Симферополь', rev: 3.4, mat: 38, work: 24, example: true },
      { id: 'ex2', name: 'Оконная компания №2', kind: 'Оконная компания', city: 'Севастополь', rev: 2.6, mat: 35, work: 21, example: true },
      { id: 'ex3', name: 'Застройщик жилого комплекса', kind: 'Застройщик', city: 'Евпатория', rev: 4.1, mat: 27, work: 11, example: true },
      { id: 'ex4', name: 'Дилер окон', kind: 'Дилер', city: 'Феодосия', rev: 1.2, mat: 30, work: 13, example: true },
      { id: 'ex5', name: 'Фасадная компания', kind: 'Фасадная компания', city: 'Ялта', rev: 1.8, mat: 44, work: 31, example: true },
      { id: 'ex6', name: 'Частные заказчики', kind: 'Частные заказчики', city: 'весь Крым', rev: 0.9, mat: 55, work: 42, example: true },
      { id: 'ex7', name: 'Монтажная бригада', kind: 'Другое', city: 'Саки', rev: 0.6, mat: 33, work: 18, example: true },
    ],
    orders: [
      { id: 'o1037', no: 1037, client: 'Оконная компания №2', formula: '4М1-16-4М1', qty: 40, area: 52, sum: 268000, ship: addDays(-1), status: 'shipped', example: true },
      { id: 'o1039', no: 1039, client: 'Застройщик жилого комплекса', formula: '4М1-12-4М1-12-4И', qty: 120, area: 160, sum: 1150000, ship: addDays(-1), status: 'build', note: 'доставка на объект', example: true },
      { id: 'o1040', no: 1040, client: 'Оконная компания №1', formula: '4М1-16Ar-4И', qty: 24, area: 31.5, sum: 189000, ship: addDays(1), status: 'ready', example: true },
      { id: 'o1041', no: 1041, client: 'Фасадная компания', formula: '6М1-14Ar-4М1-14Ar-6И', qty: 18, area: 42, sum: 410000, ship: addDays(1), status: 'build', note: 'проверить наличие 6 мм', example: true },
      { id: 'o1042', no: 1042, client: 'Дилер окон', formula: '4М1-16-4М1', qty: 15, area: 17, sum: 79000, ship: addDays(1), status: 'cut', example: true },
      { id: 'o1043', no: 1043, client: 'Монтажная бригада', formula: '4М1-10Ar-4М1-10Ar-4И', qty: 9, area: 11, sum: 71000, ship: addDays(3), status: 'new', example: true },
      { id: 'o1044', no: 1044, client: 'Оконная компания №2', formula: '4Мульти-16Ar-4М1', qty: 30, area: 38, sum: 286000, ship: addDays(5), status: 'new', example: true },
    ],
    stock: [
      { id: 'glass4', sort: 1, name: 'Стекло М1 4 мм', unit: 'листов', qty: 180, min: 120, pack: 40 },
      { id: 'butyl', sort: 2, name: 'Бутил', unit: 'кг', qty: 14, min: 30, pack: 7 },
      { id: 'frame16', sort: 3, name: 'Рамка алюм. 16 мм', unit: 'м', qty: 950, min: 600, pack: 250 },
      { id: 'sieve', sort: 4, name: 'Молекулярное сито', unit: 'кг', qty: 22, min: 25, pack: 25 },
      { id: 'sealant', sort: 5, name: 'Герметик тиокол', unit: 'кг', qty: 160, min: 100, pack: 30 },
      { id: 'argon', sort: 6, name: 'Аргон', unit: 'баллонов', qty: 5, min: 3, pack: 1 },
    ],
    payments: [
      { id: 'p1', date: addDays(2), title: 'Зарплата и налоги', amount: 1900000, paid: false },
      { id: 'p2', date: addDays(2), title: 'Аренда цеха', amount: 180000, paid: true },
      { id: 'p3', date: addDays(4), title: 'Счёт поставщика стекла', amount: 540000, paid: false },
      { id: 'p4', date: addDays(6), title: 'Лизинг оборудования', amount: 310000, paid: false },
      { id: 'p5', date: addDays(6), title: 'Электроэнергия', amount: 95000, paid: false },
    ],
    messages: [
      { id: 'm1', channel: 'stock', author: 'Кладовщица', role: 'store', text: 'Бутил заканчивается, осталось 14 кг.', at: now - 3600e3 },
      { id: 'm2', channel: 'general', author: 'AVP system', role: 'boss', text: 'Это демо-режим: данные хранятся только на этом телефоне. Подключите облачную базу, чтобы работать командой.', at: now - 1800e3 },
    ],
  };
}

/** Остаток на счёте — пока пример; в рабочей версии приходит из выписки банка. */
export const BALANCE = 4_200_000;
