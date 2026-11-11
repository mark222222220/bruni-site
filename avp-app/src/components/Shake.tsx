import { useEffect } from 'react';
import { toast } from '@/components/Confetti';
import { useData } from '@/lib/data';
import { onShake } from '@/lib/motion';
import { useSettings } from '@/lib/settings';

/** Встряхнули телефон — обновляем данные. */
export function Shake() {
  const { reload } = useData();
  const { tap } = useSettings();
  useEffect(
    () =>
      onShake(() => {
        tap('success');
        toast('Обновляю… 🔄');
        reload().then(() => toast('Свежие данные ✓'));
      }),
    [reload, tap],
  );
  return null;
}
