import { Accelerometer } from 'expo-sensors';
import { useEffect } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform } from 'react-native';

/* Движение телефона — одна подписка на датчик на всё приложение:
   наклон для «живого стекла» (блик, параллакс фона) и встряхивание для обновления данных. */

/** Наклон −1…1: X — влево/вправо, Y — от себя/к себе. Меняются плавно, на родном потоке анимации. */
export const tiltX = new Animated.Value(0);
export const tiltY = new Animated.Value(0);

const NATIVE = Platform.OS !== 'web';
const shakers = new Set<() => void>();
let tilters = 0;
let sub: { remove: () => void } | null = null;
let fx = 0;
let fy = 0;
let lastShake = 0;
let sensor: boolean | null = null; // есть ли датчик
let calm = false; // «уменьшение движения» в настройках iPhone
let idle: Animated.CompositeAnimation | null = null;

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
const glide = (v: Animated.Value, to: number, ms: number) => Animated.timing(v, { toValue: to, duration: ms, easing: Easing.linear, useNativeDriver: NATIVE });

function onSample({ x, y, z }: { x: number; y: number; z: number }) {
  if (shakers.size && Math.sqrt(x * x + y * y + z * z) > 2.3 && Date.now() - lastShake > 3000) {
    lastShake = Date.now();
    shakers.forEach((f) => f());
  }
  if (!tilters) return;
  // обычно телефон держат под углом ~35° — это «ноль» по вертикали
  fx += (clamp(x * 1.7) - fx) * 0.3;
  fy += (clamp((y + 0.58) * 1.7) - fy) * 0.3;
  glide(tiltX, fx, 90).start();
  glide(tiltY, fy, 90).start();
}

/** Нет датчика (веб, симулятор): блик сам медленно ходит туда-сюда. */
function idleLoop(on: boolean) {
  idle?.stop();
  idle = null;
  if (!on) return;
  const leg = (v: Animated.Value, to: number, ms: number) => Animated.timing(v, { toValue: to, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE });
  idle = Animated.loop(Animated.sequence([Animated.parallel([leg(tiltX, 0.7, 4200), leg(tiltY, 0.25, 4200)]), Animated.parallel([leg(tiltX, -0.7, 4200), leg(tiltY, -0.25, 4200)])]));
  idle.start();
}

async function refresh() {
  const want = AppState.currentState === 'active' && (shakers.size > 0 || tilters > 0);
  if (sensor === null) {
    sensor = NATIVE ? await Accelerometer.isAvailableAsync().catch(() => false) : false;
    calm = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
  }
  const tiltOn = tilters > 0 && !calm;
  if (!sensor) return idleLoop(want && tiltOn);
  if (want && !sub) sub = Accelerometer.addListener(onSample);
  if (!want && sub) {
    sub.remove();
    sub = null;
  }
  // наклон читаем чаще, одно встряхивание — реже (бережём батарею)
  if (sub) Accelerometer.setUpdateInterval(tiltOn ? 66 : 140);
  if (!tiltOn) {
    fx = fy = 0;
    glide(tiltX, 0, 300).start();
    glide(tiltY, 0, 300).start();
  }
}
AppState.addEventListener('change', () => void refresh());

/** Пока компонент на экране и включён — датчик наклона работает. */
export function useTilt(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    tilters++;
    void refresh();
    return () => {
      tilters--;
      void refresh();
    };
  }, [enabled]);
}

/** Встряхнули телефон. Возвращает отписку. */
export function onShake(fn: () => void) {
  shakers.add(fn);
  void refresh();
  return () => {
    shakers.delete(fn);
    void refresh();
  };
}
