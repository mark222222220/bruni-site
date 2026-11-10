import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { forecast } from '@/components/Forecast';
import { dm, fmt, money, today } from './format';
import type { Sheets } from './sheets';
import type { Role, Snapshot } from './types';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const rub = (n: number) => `${fmt(Math.round(n))} ₽`;

type Input = { snap: Snapshot; sheets: Sheets | null; role: Role; name: string; balance: number; due: number };

/** Отчёт одной страницей: что видит эта роль в приложении, то и попадает в PDF. */
export function reportHtml({ snap, sheets, role, name, balance, due }: Input) {
  const fin = role === 'boss' || role === 'acc';
  const sales = role === 'boss' || role === 'sales';
  const stock = role === 'boss' || role === 'store';
  const T0 = today();
  const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const parts: string[] = [];

  if (fin) {
    const f = forecast(balance, snap.payments, snap.orders);
    const low = f.reduce((a, d) => (d.base < a.base ? d : a), f[0]);
    const unpaid = snap.payments.filter((p) => !p.paid).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 25);
    parts.push(`<h2>Деньги</h2>
      <div class="kpis"><div><b>${money(balance)} ₽</b><span>на счёте${sheets?.bank ? ' на ' + dm(sheets.bank.date) : ''}</span></div>
      <div><b>${money(due)} ₽</b><span>платежи на 2 недели</span></div>
      <div class="${low.base < 0 ? 'bad' : ''}"><b>${money(low.base)} ₽</b><span>минимум за 30 дней (${dm(low.day)})</span></div></div>
      <table><tr><th>Дата</th><th>Платёж</th><th class="r">Сумма</th><th>Статус</th></tr>
      ${unpaid.map((p) => `<tr class="${p.date < T0 ? 'bad' : ''}"><td>${dm(p.date)}</td><td>${esc(p.title)}</td><td class="r">${p.amount ? rub(p.amount) : esc(p.amountText)}</td><td>${esc(p.status ?? 'ожидается')}</td></tr>`).join('')}</table>`);
  }
  if (sales && snap.clients.length) {
    const list = snap.clients.slice().sort((a, b) => b.rev - a.rev).slice(0, 25);
    parts.push(`<h2>Клиенты и маржа</h2><table><tr><th>Клиент</th><th class="r">Выручка, млн</th><th class="r">Маржа</th><th>Сигнал</th></tr>
      ${list.map((c) => `<tr><td>${esc(c.name)}</td><td class="r">${fmt(c.rev, 2)}</td><td class="r">${fmt(c.work, 1)}%</td><td>${esc(c.signal ?? '')}</td></tr>`).join('')}</table>`);
  }
  const active = snap.orders.filter((o) => o.status !== 'shipped');
  const late = active.filter((o) => o.ship && o.ship < T0);
  parts.push(`<h2>Заказы</h2>
    <div class="kpis"><div><b>${active.length}</b><span>в работе на ${money(active.reduce((a, o) => a + o.sum, 0))} ₽</span></div>
    <div class="${late.length ? 'bad' : ''}"><b>${late.length}</b><span>просрочено</span></div>
    <div><b>${fmt(active.reduce((a, o) => a + o.area, 0), 0)} м²</b><span>площадь</span></div></div>
    ${late.length ? `<table><tr><th>№</th><th>Клиент</th><th>Срок</th><th class="r">Сумма</th><th>Цех</th></tr>${late.slice(0, 30).map((o) => `<tr><td>${o.no}</td><td>${esc(o.client)}</td><td>${dm(o.ship)}</td><td class="r">${rub(o.sum)}</td><td>${esc(o.production ?? '')}</td></tr>`).join('')}</table>` : ''}`);
  if (stock) {
    const low = snap.stock.filter((x) => x.status === 'Мало' || (x.status === undefined && x.qty <= x.min));
    parts.push(`<h2>Склад</h2>${low.length ? `<table><tr><th>Материал</th><th class="r">Остаток</th><th class="r">Хватит, дн.</th><th>Поставщик</th></tr>${low.map((x) => `<tr class="${(x.days ?? 9) < 2 ? 'bad' : ''}"><td>${esc(x.name)}</td><td class="r">${fmt(x.qty, 1)} ${esc(x.unit)}</td><td class="r">${x.days != null ? fmt(x.days, 1) : '—'}</td><td>${esc((x.supplier ?? '').split('(')[0])}</td></tr>`).join('')}</table>` : '<p>Всего хватает.</p>'}`);
  }
  if (sheets?.main.warnings.length && fin) parts.push(`<h2>Сигналы из таблицы</h2><ul>${sheets.main.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`);

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 18mm 14mm; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; font-size: 11px; }
    header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #FF6A1A; padding-bottom: 8px; margin-bottom: 6px; }
    header h1 { margin: 0; font-size: 22px; } header span { color: #666; }
    h2 { font-size: 14px; margin: 18px 0 8px; color: #FF6A1A; text-transform: uppercase; letter-spacing: .06em; }
    .kpis { display: flex; gap: 10px; margin-bottom: 8px; } .kpis div { flex: 1; background: #f5f5f7; border-radius: 8px; padding: 8px 10px; }
    .kpis b { display: block; font-size: 16px; } .kpis span { color: #666; } .kpis .bad b { color: #d0302a; }
    table { width: 100%; border-collapse: collapse; } th { text-align: left; color: #666; font-weight: 600; border-bottom: 1px solid #ddd; padding: 4px; }
    td { padding: 4px; border-bottom: 1px solid #eee; } .r { text-align: right; } tr.bad td { color: #d0302a; }
    footer { margin-top: 18px; color: #999; font-size: 9px; }
  </style></head><body>
  <header><div><h1>AVP system · отчёт</h1><span>Гласс-Хаус Крым</span></div><span>${date}<br>${esc(name)}</span></header>
  ${parts.join('\n')}
  <footer>Данные из таблицы «Пульт руководителя»${sheets ? ' на ' + new Date(sheets.generatedAt).toLocaleString('ru-RU') : ''} и отметок в приложении. Конфиденциально.</footer>
  </body></html>`;
}

/** Создаёт PDF и открывает меню «Поделиться» (почта, Telegram, Файлы). */
export async function shareReport(input: Input) {
  const html = reportHtml(input);
  if (Platform.OS === 'web') return Print.printAsync({ html });
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Отчёт AVP' });
}
