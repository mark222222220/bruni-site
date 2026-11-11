import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import qrcode from 'qrcode-generator';
import { Platform } from 'react-native';
import { qrFor } from './stock';
import type { StockItem } from './types';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function qrSvg(text: string) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}

/** Лист наклеек A4: 3 × 7, на каждой QR, название и группа. */
export function labelsHtml(items: StockItem[]) {
  const cells = items
    .map((x) => `<div class="l"><div class="q">${qrSvg(qrFor(x.name))}</div><div class="t"><b>${esc(x.name)}</b><span>${esc(x.group ?? '')}</span><i>AVP · ${esc(x.unit)}</i></div></div>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 8mm; }
    body { margin: 0; font-family: -apple-system, Helvetica, Arial, sans-serif; }
    .g { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
    .l { height: 37mm; border: 0.4mm dashed #bbb; border-radius: 3mm; display: flex; align-items: center; gap: 3mm; padding: 2.5mm; box-sizing: border-box; break-inside: avoid; }
    .q { width: 30mm; height: 30mm; flex: none; } .q svg { width: 100%; height: 100%; }
    .t { display: flex; flex-direction: column; gap: 1mm; overflow: hidden; }
    .t b { font-size: 10pt; line-height: 1.15; } .t span { font-size: 8pt; color: #666; } .t i { font-size: 7pt; color: #FF6A1A; font-style: normal; font-weight: 700; letter-spacing: .05em; }
  </style></head><body><div class="g">${cells}</div></body></html>`;
}

export async function shareLabels(items: StockItem[]) {
  const html = labelsHtml(items);
  if (Platform.OS === 'web') return Print.printAsync({ html });
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Наклейки AVP' });
}
