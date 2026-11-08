// Загружает src/data/sheets.json в закрытую базу (таблица factory_snapshot), по разделам.
// Ключ подставляет прокси сессии (заголовок apikey), в коде его нет.
// Запуск: node scripts/push-snapshot.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASE = process.env.SUPABASE_URL || 'https://ecwfbneokqqzwmtmauwc.supabase.co';
const s = JSON.parse(readFileSync(new URL('../src/data/sheets.json', import.meta.url), 'utf8'));
if (!s.generatedAt) throw new Error('sheets.json пустой — сначала node scripts/build-snapshot.mjs');
const now = new Date().toISOString();
const rows = [
  { section: 'meta', data: { generatedAt: s.generatedAt, source: s.source }, updated_at: now },
  ...['main', 'kv', 'bank', 'payments', 'clients', 'stock', 'shipments'].map((k) => ({ section: k, data: s[k] ?? null, updated_at: now })),
];
const out = execFileSync('curl', ['-sS', '-m', '60', '-X', 'POST', `${BASE}/rest/v1/factory_snapshot?on_conflict=section`, '-H', 'Content-Type: application/json', '-H', 'Prefer: resolution=merge-duplicates,return=minimal', '--data-binary', '@-', '-w', '%{http_code}'], { input: JSON.stringify(rows) }).toString();
if (!/^20\d$/.test(out.trim().slice(-3))) throw new Error('Загрузка не удалась: ' + out);
console.log(`factory_snapshot: ${rows.length} разделов загружено (${s.generatedAt})`);
