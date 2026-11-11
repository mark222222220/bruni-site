/**
 * AVP system — обновление приложения из этой таблицы.
 *
 * Как поставить (один раз, владелец таблицы):
 *   1. Расширения → Apps Script → удалить всё в Код.gs → вставить этот файл → сохранить (значок дискеты).
 *   2. Сверху выбрать функцию «setup» → «Выполнить» → разрешить доступ (Google спросит один раз).
 *   Готово: каждую ночь около 00:00 по Москве цифры уходят в приложение,
 *   а в меню таблицы появится «AVP → Обновить приложение сейчас».
 *
 * Скрипт читает 7 листов и отправляет сводку в закрытую базу приложения,
 * а обратно забирает журнал склада из приложения на лист «Склад — движения (AVP)».
 * Ключ ниже умеет только одно — обновлять цифры завода; прочитать базу им нельзя.
 */

var AVP = {
  url: 'https://ecwfbneokqqzwmtmauwc.supabase.co',
  publicKey: 'sb_publishable_4N014xstCBNbs06X5bQBHQ_6MRgzrOQ',
  syncToken: '__SYNC_TOKEN__',
  sheetId: '1Q300QHMwsfH-KmvsmfWPob-4Vgm3vwK-ZbesRhJnfko',
  ranges: {
    main: "'Главный'!A1:AD40",
    app: "'Для приложения'!A1:G30",
    stock: "'Склад для приложения'!A1:O150",
    clients: "'Клиенты по месяцам'!A1:M60",
    payments: "'Платёжный календарь'!A1:F80",
    shipments: "'Отгрузки'!A1:J300",
    bank: "'Банк — остатки'!A1:J40",
  },
};

/* ---------- меню и расписание ---------- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('AVP').addItem('Обновить приложение сейчас', 'syncNow').addToUi();
}

/** Один раз: ставит ночное обновление и сразу отправляет цифры. */
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncAvp') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncAvp').timeBased().everyDays(1).atHour(0).inTimezone('Europe/Moscow').create();
  var r = syncAvp();
  Logger.log('Готово. Ночное обновление включено. ' + r);
}

function syncNow() {
  var ss = book_();
  try {
    ss.toast(syncAvp(), 'AVP: приложение обновлено', 8);
  } catch (e) {
    ss.toast(String(e.message || e), 'AVP: не получилось', 15);
  }
}

/* ---------- главное ---------- */
function syncAvp() {
  var ss = book_();
  var raw = {};
  Object.keys(AVP.ranges).forEach(function (k) {
    try {
      raw[k] = ss.getRange(AVP.ranges[k]).getDisplayValues();
    } catch (e) {
      raw[k] = []; // листа нет — раздел будет пустым
    }
  });
  var s = buildSnapshot(raw, new Date());
  var rows = [{ section: 'meta', data: { generatedAt: s.generatedAt, source: s.source } }];
  ['main', 'kv', 'bank', 'payments', 'clients', 'stock', 'shipments'].forEach(function (k) {
    rows.push({ section: k, data: s[k] === undefined ? null : s[k] });
  });
  var res = UrlFetchApp.fetch(AVP.url + '/rest/v1/rpc/avp_sync_snapshot', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: AVP.publicKey },
    payload: JSON.stringify({ p_token: AVP.syncToken, p_rows: rows }),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('База ответила ' + code + ': ' + res.getContentText().slice(0, 300));
  var journal = '';
  try {
    journal = writeMoves_(ss);
  } catch (e) {
    journal = ' · журнал склада: ' + (e.message || e);
  }
  var msg = 'склад ' + s.stock.length + ', клиенты ' + s.clients.list.length + ', платежи ' + s.payments.list.length + ', отгрузки ' + s.shipments.planned.length + ' + просрочено ' + s.shipments.overdue.length + ', на счёте ' + (s.bank ? s.bank.balance : '—');
  msg += journal;
  Logger.log(msg);
  return msg;
}

/** Лист «Склад — движения (AVP)»: приход, выдача, списание, пересчёт из приложения за 60 дней. */
function writeMoves_(ss) {
  var res = UrlFetchApp.fetch(AVP.url + '/rest/v1/rpc/avp_sync_moves', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: AVP.publicKey },
    payload: JSON.stringify({ p_token: AVP.syncToken, p_days: 60 }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) throw new Error('база ответила ' + res.getResponseCode());
  var list = JSON.parse(res.getContentText()) || [];
  var KIND = { in: 'Приход', out: 'Выдача в цех', writeoff: 'Списание', count: 'Инвентаризация' };
  var name = 'Склад — движения (AVP)';
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  var head = ['Дата', 'Время', 'Операция', 'Материал', 'Количество', 'Ед.', 'Заказ', 'Комментарий', 'Кто'];
  var rows = list.map(function (m) {
    var d = new Date(Number(m.at));
    return [
      Utilities.formatDate(d, 'Europe/Moscow', 'dd.MM.yyyy'),
      Utilities.formatDate(d, 'Europe/Moscow', 'HH:mm'),
      KIND[m.kind] || m.kind,
      m.item,
      Number(m.qty),
      m.unit || '',
      m.order_no || '',
      m.note || '',
      m.author || '',
    ];
  });
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
  if (rows.length) sh.getRange(2, 1, rows.length, head.length).setValues(rows);
  sh.setFrozenRows(1);
  return ' · журнал склада: ' + rows.length + ' записей';
}

function book_() {
  return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(AVP.sheetId);
}

/* ---------- разбор листов (то же, что scripts/build-snapshot.mjs) ---------- */
function buildSnapshot(R, now) {
  function rows(name) {
    return R[name] || [];
  }
  function at(row, c) {
    return row && row[c] !== undefined && row[c] !== null ? row[c] : '';
  }
  function cell(rs, r, c) {
    return String(at(rs[r], c)).trim();
  }
  function clean(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[\u00a0\u202f\s]/g, '');
  }
  function num(s) {
    var v = parseFloat(clean(s).replace(/[₽%]|м²|м2/g, '').replace(',', '.'));
    return isFinite(v) ? v : null;
  }
  function rub(s) {
    var t = String(s === undefined || s === null ? '' : s);
    var n = num(t.replace(/млн|тыс\.?|₽/g, ''));
    if (n === null) return null;
    return /млн/.test(t) ? n * 1e6 : /тыс/.test(t) ? n * 1e3 : n;
  }
  function pad(x) {
    return x.length < 2 ? '0' + x : x;
  }
  function day(s) {
    var m = String(s === undefined || s === null ? '' : s).match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/);
    if (!m) return null;
    var y = m[3] ? Number(m[3]) : now.getFullYear();
    var d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1])));
    if (!m[3] && d.getTime() - now.getTime() > 200 * 864e5) y -= 1;
    return y + '-' + pad(m[2]) + '-' + pad(m[1]);
  }
  function slug(s, i) {
    // номер материала — только из названия: строки в таблице меняются местами, а номер должен оставаться тем же
    return 'x-' + String(s).toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').slice(0, 60);
  }
  function or0(v) {
    return v === null ? 0 : v;
  }

  /* «Главный» */
  var M = rows('main');
  var weekly = [];
  for (var r = 1; r < M.length; r++) {
    var w = cell(M, r, 26);
    if (/^\d{1,2}\.\d{2}$/.test(w)) weekly.push({ week: w, m2: num(cell(M, r, 27)), rev: num(cell(M, r, 28)), margin: num(cell(M, r, 29)) });
  }
  var warnings = [];
  M.forEach(function (row) {
    (row || []).forEach(function (c) {
      if (String(c).indexOf('⚠') >= 0)
        String(c)
          .split('\n')
          .forEach(function (l) {
            if (l.trim().indexOf('⚠') === 0) warnings.push(l.replace(/^⚠\s*/, '').trim());
          });
    });
  });
  var blocks = [];
  for (var r2 = 0; r2 < M.length; r2++) {
    var title = cell(M, r2, 0);
    if ((M[r2] || []).filter(Boolean).length === 1 && ['Продажи', 'Производство и склад', 'Деньги и итоги'].indexOf(title) >= 0) {
      var tiles = [];
      [0, 3, 6, 9].forEach(function (c) {
        if (cell(M, r2 + 1, c)) tiles.push({ label: cell(M, r2 + 1, c), value: cell(M, r2 + 2, c), detail: cell(M, r2 + 3, c) });
      });
      blocks.push({ title: title, tiles: tiles });
    }
  }
  var main = {
    updatedText: cell(M, 0, 8),
    money: { label: cell(M, 2, 0), value: cell(M, 3, 0), amount: rub(cell(M, 3, 0)), detail: cell(M, 4, 0) },
    margin: { label: cell(M, 2, 4), value: cell(M, 3, 4), pct: num(cell(M, 3, 4)), detail: cell(M, 4, 4) },
    shipping: { label: cell(M, 2, 8), value: cell(M, 3, 8), detail: cell(M, 4, 8) },
    forecast: cell(M, 6, 0),
    progress: cell(M, 8, 0).replace(/\s+/g, ' '),
    weekly: weekly,
    warnings: warnings,
    blocks: blocks,
  };

  /* «Для приложения» */
  var kv = {};
  rows('app')
    .slice(1)
    .forEach(function (r) {
      if (r[0]) kv[r[0]] = { section: at(r, 2), label: at(r, 3), value: at(r, 4), detail: at(r, 5), updated: at(r, 6) };
    });

  /* «Склад для приложения» */
  var stock = rows('stock')
    .slice(1)
    .filter(function (r) {
      return r[0];
    })
    .map(function (r, i) {
      var sort = num(r[13]);
      return {
        id: slug(r[0], i),
        name: r[0],
        status: at(r, 1),
        group: at(r, 2),
        unit: at(r, 3),
        qty: or0(num(r[4])),
        days: num(r[5]),
        toOrder: or0(num(r[6])),
        packs: num(r[7]),
        orderSum: or0(num(r[8])),
        weekly: or0(num(r[9])),
        price: num(r[10]),
        value: or0(num(r[11])),
        supplier: at(r, 12),
        sort: sort === null ? i : sort,
        updated: at(r, 14),
      };
    });

  /* «Клиенты по месяцам» */
  var C = rows('clients');
  var hdr = -1;
  for (var h = 0; h < C.length; h++)
    if (C[h][0] === 'Клиент' && String(at(C[h], 1)).indexOf('Выручка') >= 0) {
      hdr = h;
      break;
    }
  var clients = [];
  var clientsTotal = null;
  if (hdr >= 0) {
    var months = C[hdr].slice(4, 10);
    for (var rc = hdr + 1; rc < C.length && C[rc] && C[rc][0]; rc++) {
      var row = C[rc];
      var byMonth = {};
      months.forEach(function (m, k) {
        var v = num(row[4 + k]);
        if (v !== null) byMonth[m] = v;
      });
      var item = { name: row[0], rev6: or0(num(row[1])), share: num(row[2]), margin6: num(row[3]), byMonth: byMonth, change: num(row[10]), rubM2: num(row[11]), signal: at(row, 12) };
      if (row[0] === 'ИТОГО') {
        clientsTotal = item;
        break;
      }
      clients.push(item);
    }
  }
  var clientSignals = [];
  C.forEach(function (r) {
    r.forEach(function (c) {
      if (String(c).indexOf('⚠') === 0) clientSignals.push(String(c).replace(/^⚠\s*/, ''));
    });
  });

  /* «Платёжный календарь» */
  var P = rows('payments');
  var payments = [];
  P.forEach(function (r) {
    if (!r || !r[2] || r[0] === 'Дата' || !day(r[0])) return;
    payments.push({ date: day(r[0]), dateText: r[0], title: r[2], amount: rub(r[3]), amountText: at(r, 3), status: at(r, 4), comment: at(r, 5) });
  });
  var payHead = { thisWeek: cell(P, 4, 0), nextWeek: cell(P, 4, 3), nextWeekNote: cell(P, 5, 3), enough: cell(P, 5, 5), updatedText: cell(P, 1, 0) };

  /* «Отгрузки» */
  var O = rows('shipments');
  var planned = [];
  var overdue = [];
  var mode = null;
  var overdueSummary = '';
  O.forEach(function (r) {
    var a = String(at(r, 0));
    if (a.indexOf('Просрочено') === 0) {
      mode = 'overdue-title';
      overdueSummary = a;
      return;
    }
    if (a === 'Дата' && r[1] === 'Заказчик') {
      mode = 'plan';
      return;
    }
    if (a === 'Срок' && r[1] === 'Дней') {
      mode = 'overdue';
      return;
    }
    // другая таблица на том же листе («срок сегодня-завтра») — к просрочке не относится
    if (a === 'Срок') {
      mode = null;
      return;
    }
    if (!a) return;
    if (mode === 'plan' && day(a))
      planned.push({ date: day(a), client: at(r, 1), note: String(at(r, 2)).replace(/\s+/g, ' ').trim(), order: at(r, 3), sp: or0(num(r[4])), m2: or0(num(r[5])), sum: or0(num(r[6])), status: at(r, 7), production: at(r, 8), deadline: day(r[9]) });
    if (mode === 'overdue' && day(a))
      overdue.push({ deadline: day(a), days: or0(num(r[1])), client: at(r, 2), note: String(at(r, 3)).trim(), order: at(r, 4), m2: or0(num(r[5])), sum: or0(num(r[6])), production: at(r, 7), comment: at(r, 8) });
  });
  var shipHead = cell(O, 3, 0);

  /* «Банк — остатки» */
  var B = rows('bank')
    .slice(1)
    .filter(function (r) {
      return r[0] && num(r[4]) !== null;
    });
  // выписки в листе идут не по порядку — берём самую свежую по дате «По»
  var lb = B.slice().sort(function (a, b) {
    return String(a[2]).localeCompare(String(b[2]));
  }).pop();
  var bank = lb ? { account: lb[0], date: lb[2], balance: num(lb[4]), inflow: num(lb[5]), outflow: num(lb[6]), read: at(lb, 9) } : null;

  return {
    generatedAt: now.toISOString(),
    source: 'Пульт руководителя — Гласс-Хаус Крым',
    main: main,
    kv: kv,
    stock: stock,
    clients: { list: clients, total: clientsTotal, signals: clientSignals },
    payments: { head: payHead, list: payments },
    shipments: { head: shipHead, planned: planned, overdue: overdue, overdueSummary: overdueSummary },
    bank: bank,
  };
}
