import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Glass, T, styles } from '@/components/ui';

/** Погода у завода (Симферополь). Сервис open-meteo — без ключа, координаты города, никаких данных о человеке. */
const URL = 'https://api.open-meteo.com/v1/forecast?latitude=44.95&longitude=34.1&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&wind_speed_unit=ms&timezone=Europe%2FMoscow';

const CODES: [number[], string, string][] = [
  [[0], '☀️', 'ясно'],
  [[1, 2], '🌤', 'малооблачно'],
  [[3], '☁️', 'пасмурно'],
  [[45, 48], '🌫', 'туман'],
  [[51, 53, 55, 56, 57], '🌦', 'морось'],
  [[61, 63, 65, 66, 67, 80, 81, 82], '🌧', 'дождь'],
  [[71, 73, 75, 77, 85, 86], '🌨', 'снег'],
  [[95, 96, 99], '⛈', 'гроза'],
];

type W = { temp: number; code: number; wind: number; max: number; min: number };
let cached: { w: W; at: number } | null = null;

function tip(w: W, e: string) {
  if (e === 'дождь' || e === 'гроза' || e === 'снег' || e === 'морось') return 'на отгрузке укройте стеклопакеты от воды';
  if (w.wind >= 10) return 'сильный ветер — аккуратнее с пирамидами на улице';
  if (w.temp <= 0) return 'мороз — проверьте отопление в цеху';
  if (w.temp >= 30) return 'жарко — не держите стекло на солнце';
  return 'хорошая погода для отгрузок';
}

export function Weather() {
  const [w, setW] = useState<W | null>(cached && Date.now() - cached.at < 30 * 60e3 ? cached.w : null);
  useEffect(() => {
    if (w) return;
    let off = false;
    fetch(URL)
      .then((r) => r.json())
      .then((j) => {
        const next: W = { temp: j.current.temperature_2m, code: j.current.weather_code, wind: j.current.wind_speed_10m, max: j.daily.temperature_2m_max[0], min: j.daily.temperature_2m_min[0] };
        cached = { w: next, at: Date.now() };
        if (!off) setW(next);
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [w]);
  if (!w) return null;
  const [, icon, name] = CODES.find(([c]) => c.includes(w.code)) ?? [[], '🌡', ''];
  return (
    <Glass radius={18} style={[styles.row, { paddingHorizontal: 14, paddingVertical: 10, gap: 12 }]}>
      <T v="body" style={{ fontSize: 30 }}>
        {icon}
      </T>
      <View style={{ flex: 1 }}>
        <T v="b">
          Симферополь {w.temp > 0 ? '+' : ''}
          {Math.round(w.temp)}° · {name}
        </T>
        <T v="small" numberOfLines={1}>
          {Math.round(w.min)}…{Math.round(w.max)}°, ветер {Math.round(w.wind)} м/с · {tip(w, name)}
        </T>
      </View>
    </Glass>
  );
}
