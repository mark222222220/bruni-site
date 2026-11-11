import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Fill, Logo, T, Wallpaper } from '@/components/ui';
import { useSettings } from '@/lib/settings';

/* Заставка при запуске: три стекла съезжаются в стеклопакет, по нему пробегает блик, появляется знак AVP.
   Идёт около полутора секунд, один раз за запуск; нажатие — пропустить. Приложение в это время уже грузится под ней. */

let played = false;
const NATIVE = Platform.OS !== 'web';
const PANES = [0, 1, 2];
const W = 132;
const H = 172;

export function Intro() {
  const { s, t, ready } = useSettings();
  const [on, setOn] = useState(!played);
  const build = useRef(new Animated.Value(0)).current; // стёкла съезжаются
  const glare = useRef(new Animated.Value(0)).current; // блик
  const mark = useRef(new Animated.Value(0)).current; // знак и подпись
  const veil = useRef(new Animated.Value(1)).current; // вся заставка

  const close = (ms: number) => Animated.timing(veil, { toValue: 0, duration: ms, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE }).start(() => setOn(false));

  useEffect(() => {
    if (!on || !ready) return;
    played = true;
    let off = false;
    (async () => {
      const calm = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      if (off) return;
      if (!s.motion || calm) return setOn(false);
      const go = (v: Animated.Value, duration: number, easing: (x: number) => number, delay = 0) => Animated.timing(v, { toValue: 1, duration, delay, easing, useNativeDriver: NATIVE });
      Animated.sequence([
        go(build, 640, Easing.out(Easing.cubic)),
        Animated.parallel([go(glare, 520, Easing.inOut(Easing.quad)), go(mark, 440, Easing.out(Easing.back(1.5)), 140)]),
        Animated.delay(300),
      ]).start(({ finished }) => finished && !off && close(320));
    })();
    return () => {
      off = true;
    };
    // заставка играет один раз: настройки читаем в момент запуска
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, ready]);

  if (!on) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: veil, transform: [{ scale: veil.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] }) }] }]}>
      <Pressable style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }} onPress={() => close(160)} accessibilityLabel="Пропустить заставку">
        <Wallpaper />
        <View style={{ width: W + 60, height: H + 60, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ opacity: mark.interpolate({ inputRange: [0, 1], outputRange: [1, 0.42] }), transform: [{ rotate: '-7deg' }] }}>
            {PANES.map((k) => {
              const d = k - 1;
              return (
                <Animated.View
                  key={k}
                  style={{
                    position: k === 1 ? 'relative' : 'absolute',
                    width: W,
                    height: H,
                    borderRadius: 20,
                    overflow: 'hidden',
                    borderWidth: 1.5,
                    borderColor: k === 1 ? t.accent : 'rgba(255,255,255,0.5)',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    zIndex: 0,
                    opacity: build.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] }),
                    transform: [
                      { translateX: build.interpolate({ inputRange: [0, 1], outputRange: [d * 190, d * 15] }) },
                      { translateY: build.interpolate({ inputRange: [0, 1], outputRange: [k === 1 ? 170 : -150, d * 15] }) },
                      { rotate: build.interpolate({ inputRange: [0, 1], outputRange: [`${d * 26}deg`, '0deg'] }) },
                    ],
                  }}
                >
                  <Fill colors={['#FFFFFF2B', '#FFFFFF08', '#FFFFFF14']} radius={20} />
                  {k === 2 ? (
                    <Animated.View style={{ position: 'absolute', top: -40, bottom: -40, width: 70, left: 0, opacity: 0.9, transform: [{ translateX: glare.interpolate({ inputRange: [0, 1], outputRange: [-110, W + 40] }) }, { rotate: '18deg' }] }}>
                      <Fill colors={['#FFFFFF00', '#FFFFFF8C', '#FFFFFF00']} vertical={false} />
                    </Animated.View>
                  ) : null}
                </Animated.View>
              );
            })}
          </Animated.View>
          <Animated.View style={{ position: 'absolute', opacity: mark, transform: [{ scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }] }}>
            <Logo size={84} />
          </Animated.View>
        </View>
        <Animated.View style={{ alignItems: 'center', gap: 6, marginTop: 26, opacity: mark, transform: [{ translateY: mark.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
          <T v="title" style={{ fontSize: 30 }}>
            AVP system
          </T>
          <T v="kicker">Гласс-Хаус Крым</T>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
