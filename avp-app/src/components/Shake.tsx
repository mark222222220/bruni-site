import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { toast } from '@/components/Confetti';
import { useData } from '@/lib/data';
import { useSettings } from '@/lib/settings';

/** Встряхнули телефон — обновляем данные. */
export function Shake() {
  const { reload } = useData();
  const { tap } = useSettings();
  const last = useRef(0);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let sub: { remove: () => void } | null = null;
    Accelerometer.isAvailableAsync()
      .then((ok) => {
        if (!ok) return;
        Accelerometer.setUpdateInterval(120);
        sub = Accelerometer.addListener(({ x, y, z }) => {
          const g = Math.sqrt(x * x + y * y + z * z);
          const now = Date.now();
          if (g > 2.3 && now - last.current > 3000) {
            last.current = now;
            tap('success');
            toast('Обновляю… 🔄');
            reload().then(() => toast('Свежие данные ✓'));
          }
        });
      })
      .catch(() => {});
    return () => sub?.remove();
  }, [reload, tap]);
  return null;
}
