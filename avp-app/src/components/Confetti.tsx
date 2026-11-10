import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { T } from '@/components/ui';

import { onBurst, type Burst } from '@/lib/fun';
export { celebrate, toast } from '@/lib/fun';

const COLORS = ['#FF6A1A', '#FFB020', '#FFD60A', '#30D158', '#0A84FF', '#BF5AF2', '#FF375F', '#FFFFFF'];
const PIECES = 46;

function Piece({ i, run }: { i: number; run: number }) {
  const { width: W, height: H } = Dimensions.get('window');
  const v = useRef(new Animated.Value(0)).current;
  const seed = useRef({ x: Math.random() * W, drift: (Math.random() - 0.5) * 160, delay: Math.random() * 250, dur: 1500 + Math.random() * 1100, rot: (Math.random() - 0.5) * 900, w: 6 + Math.random() * 6, round: Math.random() < 0.3 }).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: seed.dur, delay: seed.delay, easing: Easing.in(Easing.quad), useNativeDriver: true }).start();
  }, [run, v, seed]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: seed.x,
        top: -20,
        width: seed.w,
        height: seed.round ? seed.w : seed.w * 1.8,
        borderRadius: seed.round ? seed.w : 2,
        backgroundColor: COLORS[i % COLORS.length],
        opacity: v.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, H + 40] }) },
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, seed.drift] }) },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${seed.rot}deg`] }) },
        ],
      }}
    />
  );
}

export function Confetti() {
  const [b, setB] = useState<Burst | null>(null);
  const toast = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    onBurst((x) => {
      setB(x);
      toast.setValue(0);
      Animated.sequence([
        Animated.spring(toast, { toValue: 1, useNativeDriver: true, friction: 6 }),
        Animated.delay(1600),
        Animated.timing(toast, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    });
    return () => onBurst(null);
  }, [toast]);
  useEffect(() => {
    if (!b) return;
    const id = setTimeout(() => setB(null), 3200);
    return () => clearTimeout(id);
  }, [b]);
  if (!b) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {b.quiet ? null : Array.from({ length: PIECES }, (_, i) => (
        <Piece key={i} i={i} run={b.id} />
      ))}
      {b.text ? (
        <Animated.View
          style={{
            position: 'absolute',
            alignSelf: 'center',
            top: '42%',
            backgroundColor: 'rgba(17,17,19,0.92)',
            borderRadius: 22,
            paddingHorizontal: 22,
            paddingVertical: 14,
            borderWidth: 1,
            borderColor: '#FF6A1A88',
            opacity: toast,
            transform: [{ scale: toast.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
          }}
        >
          <T v="b" style={{ color: '#fff', fontSize: 17, textAlign: 'center' }}>
            {b.text}
          </T>
        </Animated.View>
      ) : null}
    </View>
  );
}
