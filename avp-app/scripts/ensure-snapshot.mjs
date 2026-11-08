// Создаёт пустой src/data/sheets.json, если его нет: реальный снимок не хранится в git.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const p = new URL('../src/data/sheets.json', import.meta.url);
if (!existsSync(p)) {
  mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true });
  writeFileSync(p, '{}\n');
  console.log('src/data/sheets.json: пустой снимок (демо-режим)');
}
