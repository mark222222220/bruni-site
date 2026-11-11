import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch as RNSwitch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { celebrate } from '@/lib/fun';
import { tiltX, tiltY, useTilt } from '@/lib/motion';
import { useSettings, type Theme } from '@/lib/settings';
import { ROLES } from '@/lib/types';

/** Метка сборки: видно, какая версия открыта на телефоне. */
export const APP_BUILD = '1.3.0';
const SECRETS = ['Гласс-Хаус Крым — сила! 🏆', 'Сделано с любовью к стеклу 🪟', 'Ты нашёл пасхалку! 🥚', 'Стекло прозрачное, цифры тоже 😎'];
const LIQUID = Platform.OS === 'ios' && isLiquidGlassAvailable();
const useSvgId = () => 'g' + useId().replace(/[^a-zA-Z0-9]/g, '');

/* =========================================================
   Фон и заливки
   ========================================================= */

/** Градиентная заливка на весь родитель. Размер меряем сами: на iOS SVG не растягивается по «100%». */
export function Fill({ colors, radius = 0, vertical = true, opacity = 1 }: { colors: [string, string] | [string, string, string]; radius?: number; vertical?: boolean; opacity?: number }) {
  const id = useSvgId();
  const [box, setBox] = useState({ w: 0, h: 0 });
  if (Platform.OS !== 'web') {
    // на телефоне градиент рисует сама система — без SVG и без замеров
    const deg = vertical ? 165 : 115;
    const stops = colors.map((c, i) => `${c} ${Math.round((i / (colors.length - 1)) * 100)}%`).join(', ');
    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { zIndex: -1, borderRadius: radius, opacity, backgroundColor: colors[colors.length - 1], experimental_backgroundImage: `linear-gradient(${deg}deg, ${stops})` }]}
      />
    );
  }
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { zIndex: -1, borderRadius: radius, overflow: 'hidden', backgroundColor: box.w ? 'transparent' : colors[1] }]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (Math.round(width) !== box.w || Math.round(height) !== box.h) setBox({ w: Math.round(width), h: Math.round(height) });
      }}
    >
      {box.w > 0 && box.h > 0 ? (
        <Svg width={box.w} height={box.h}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2={vertical ? '0.25' : '1'} y2={vertical ? '1' : '0.4'}>
              {colors.map((c, i) => (
                <Stop key={i} offset={i / (colors.length - 1)} stopColor={c} stopOpacity={opacity} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={box.w} height={box.h} fill={`url(#${id})`} />
        </Svg>
      ) : null}
    </View>
  );
}

/** Мягкое круглое свечение. */
export function Glow({ color, size, style, opacity = 0.35 }: { color: string; size: number; style?: StyleProp<ViewStyle>; opacity?: number }) {
  const id = useSvgId();
  if (Platform.OS !== 'web') {
    // на телефоне свечение рисует система: без SVG и без огромной картинки в памяти
    const bg = `radial-gradient(circle closest-side at 50% 50%, ${hexA(color, opacity)} 0%, ${hexA(color, opacity * 0.3)} 45%, ${hexA(color, 0)} 100%)`;
    return <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, experimental_backgroundImage: bg }, style]} />;
  }
  return (
    <Svg width={size} height={size} style={[{ position: 'absolute' }, style]} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="0.45" stopColor={color} stopOpacity={opacity * 0.3} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={size} height={size} fill={`url(#${id})`} />
    </Svg>
  );
}

/** Точечная сетка: маленькая картинка-плитка, которую система сама размножает по экрану. */
function Dots() {
  // размеры задаём явно: иначе картинка берёт свой родной размер 26×26
  return <Image source={require('../../assets/dots.png')} resizeMode="repeat" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} />;
}

const DRIFT_A = { inputRange: [-1, 1], outputRange: [-22, 22] };
const DRIFT_B = { inputRange: [-1, 1], outputRange: [16, -16] };

/** Фон экрана: фирменный тёмный с оранжевым свечением и точечной сеткой, либо фон выбранной темы. */
export function Wallpaper() {
  const { t } = useSettings();
  if (t.premium)
    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.bg, overflow: 'hidden' }]}>
        {/* свечение чуть плывёт за наклоном телефона — фон кажется глубже */}
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: tiltX.interpolate(DRIFT_A) }, { translateY: tiltY.interpolate(DRIFT_A) }] }]}>
          <Glow color={t.accent} size={760} opacity={0.32} style={{ top: -380, right: -300 }} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: tiltX.interpolate(DRIFT_B) }, { translateY: tiltY.interpolate(DRIFT_B) }] }]}>
          <Glow color="#3A3A44" size={700} opacity={0.5} style={{ bottom: -360, left: -320 }} />
        </Animated.View>
        <Dots />
      </View>
    );
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.bg }, t.wallpaper ? { experimental_backgroundImage: t.wallpaper } : null]} />;
}

/* =========================================================
   Поверхности
   ========================================================= */

/** Базовая поверхность: градиентная карточка (AVP), Liquid Glass (iOS 26) или размытие. */
export function Glass({ children, style, radius = 22, interactive }: { children?: ReactNode; style?: StyleProp<ViewStyle>; radius?: number; interactive?: boolean }) {
  const { t } = useSettings();
  const shape: ViewStyle = { borderRadius: radius, overflow: 'hidden' };
  if (t.premium)
    return (
      <View style={[shape, { zIndex: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: t.edge }, style]}>
        <Fill colors={[t.cardFrom, t.cardTo]} radius={radius} />
        {children}
      </View>
    );
  if (!t.glass) return <View style={[shape, { backgroundColor: t.card }, !t.dark && styles.lightShadow, style]}>{children}</View>;
  if (LIQUID)
    return (
      <GlassView glassEffectStyle="regular" isInteractive={interactive} colorScheme={t.dark ? 'dark' : 'light'} style={[shape, style]}>
        {children}
      </GlassView>
    );
  return (
    <View style={[shape, { zIndex: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: t.dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.9)' }, style]}>
      <BlurView intensity={t.dark ? 40 : 60} tint={t.dark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, { zIndex: -1 }]} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, { zIndex: -1, backgroundColor: t.card }]} pointerEvents="none" />
      {children}
    </View>
  );
}

/** Нажимаемая обёртка с лёгким «утапливанием». */
export function Press({ children, onPress, style, label, haptic = true }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; label?: string; haptic?: boolean }) {
  const { tap } = useSettings();
  const k = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(k, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable
      onPress={() => {
        if (haptic) tap();
        onPress();
      }}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale: k }] }}>{children}</Animated.View>
    </Pressable>
  );
}

/** Карточка с отступами; tone добавляет цветную полоску сверху. */
export function Card({ children, style, onPress, tone, radius = 24 }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tone?: 'accent' | 'bad' | 'ok' | 'warn'; radius?: number }) {
  const { t } = useSettings();
  const bar = tone ? { accent: t.accent, bad: t.bad, ok: t.ok, warn: t.warn }[tone] : null;
  return (
    <Press onPress={onPress}>
      <Glass radius={radius} style={[{ padding: 18, gap: 8 }, style]}>
        {bar ? <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, backgroundColor: bar }} /> : null}
        {children}
      </Glass>
    </Press>
  );
}

/** Главная оранжевая карточка с водяным знаком AVP. По ней ходит блик, как по настоящему стеклу, — следом за наклоном телефона. */
export function HeroCard({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const { t, s } = useSettings();
  const focused = useIsFocused();
  useTilt(s.motion && focused);
  return (
    <Press onPress={onPress}>
      <View style={{ borderRadius: 30, overflow: 'hidden', padding: 22, gap: 6, zIndex: 0, ...shadow(t.accent, 0.45, 30) }}>
        <Fill colors={[t.accent2, t.accent, t.accent3]} radius={30} vertical={false} />
        <Animated.View style={{ position: 'absolute', right: -30, bottom: -26, opacity: 0.16, transform: [{ translateX: tiltX.interpolate(DEPTH) }, { translateY: tiltY.interpolate(DEPTH) }] }} pointerEvents="none">
          <Mark width={260} ink="#000" />
        </Animated.View>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, transform: [{ translateX: tiltX.interpolate(SHINE) }, { translateY: tiltY.interpolate(SHINE) }] }}>
          <Glow color="#FFFFFF" size={260} opacity={0.35} style={{ top: -140, left: -90 }} />
        </Animated.View>
        {s.motion ? (
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -60, bottom: -60, left: '50%', width: 150, marginLeft: -75, opacity: tiltY.interpolate(GLARE_O), transform: [{ translateX: tiltX.interpolate(GLARE_X) }, { rotate: '16deg' }] }}>
            <Fill colors={['#FFFFFF00', '#FFFFFF59', '#FFFFFF00']} vertical={false} />
          </Animated.View>
        ) : null}
        {children}
      </View>
    </Press>
  );
}
const DEPTH = { inputRange: [-1, 1], outputRange: [10, -10] };
const SHINE = { inputRange: [-1, 1], outputRange: [-26, 26] };
const GLARE_X = { inputRange: [-1, 1], outputRange: [-210, 210] };
const GLARE_O = { inputRange: [-1, 0, 1], outputRange: [0.55, 0.85, 1] };

export function List({ children }: { children: ReactNode }) {
  return <Glass radius={24} style={{ paddingVertical: 2 }}>{children}</Glass>;
}

export function Item({ title, sub, right, onPress, first, children, leading }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; onPress?: () => void; first?: boolean; children?: ReactNode; leading?: ReactNode }) {
  const { t, tap } = useSettings();
  const content = (
    <View style={[styles.item, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line }]}>
      {leading}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        {typeof title === 'string' ? <T v="b">{title}</T> : title}
        {typeof sub === 'string' ? <T v="small">{sub}</T> : sub}
        {children}
      </View>
      {right}
      {onPress && !right ? <Icon name="chev" size={18} color={t.mute} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ backgroundColor: pressed ? t.line : 'transparent' })}
    >
      {content}
    </Pressable>
  ) : (
    content
  );
}

/* =========================================================
   Текст
   ========================================================= */
type TP = { children?: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number; selectable?: boolean };
type TV = 'title' | 'h' | 'body' | 'b' | 'small' | 'label' | 'kicker' | 'num' | 'big' | 'huge';
// стили текста считаем один раз на тему, а не на каждую надпись
const textStyles = new WeakMap<Theme, Record<TV, TextStyle>>();
function stylesFor(t: Theme) {
  let base = textStyles.get(t);
  if (base) return base;
  const k = t.fs / 16;
  base = {
    huge: { fontFamily: 'Rubik_800ExtraBold', fontSize: 54 * k, letterSpacing: -1.6, color: t.fg, fontVariant: ['tabular-nums'], lineHeight: 58 * k },
    title: { fontFamily: 'Rubik_800ExtraBold', fontSize: 34 * k, letterSpacing: -0.9, color: t.fg, lineHeight: 38 * k },
    h: { fontFamily: 'Rubik_700Bold', fontSize: 20 * k, color: t.fg, letterSpacing: -0.3 },
    body: { fontFamily: 'Rubik_400Regular', fontSize: 15 * k, color: t.fg, lineHeight: 21 * k },
    b: { fontFamily: 'Rubik_600SemiBold', fontSize: 15 * k, color: t.fg },
    small: { fontFamily: 'Rubik_400Regular', fontSize: 13 * k, color: t.dim, lineHeight: 18 * k },
    label: { fontFamily: 'Rubik_600SemiBold', fontSize: 11 * k, letterSpacing: 1.6, textTransform: 'uppercase', color: t.dim },
    kicker: { fontFamily: 'Rubik_600SemiBold', fontSize: 11 * k, letterSpacing: 2.6, textTransform: 'uppercase', color: t.accent },
    num: { fontFamily: 'Rubik_700Bold', fontSize: 18 * k, color: t.fg, fontVariant: ['tabular-nums'] },
    big: { fontFamily: 'Rubik_800ExtraBold', fontSize: 36 * k, letterSpacing: -1, color: t.fg, fontVariant: ['tabular-nums'], lineHeight: 40 * k },
  };
  textStyles.set(t, base);
  return base;
}
export function T({ children, style, numberOfLines, selectable, v = 'body' }: TP & { v?: TV }) {
  const { t } = useSettings();
  return (
    <Text style={[stylesFor(t)[v], style]} numberOfLines={numberOfLines} selectable={selectable} maxFontSizeMultiplier={1.4}>
      {children}
    </Text>
  );
}

/** Число, которое «набегает» от нуля при появлении. */
export function CountUp({ value, format, style, v = 'big' }: { value: number; format: (n: number) => string; style?: StyleProp<TextStyle>; v?: 'big' | 'huge' | 'num' }) {
  const a = useRef(new Animated.Value(0)).current;
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = a.addListener(({ value: x }) => setN(x));
    Animated.timing(a, { toValue: value, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => a.removeListener(id);
  }, [value, a]);
  return (
    <T v={v} style={style}>
      {format(n)}
    </T>
  );
}

/** Плавное появление снизу; delay — порядковый номер в каскаде. */
export function Appear({ children, i = 0 }: { children: ReactNode; i?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 520, delay: 60 + Math.min(i, 8) * 70, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a, i]);
  return <Animated.View style={{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>{children}</Animated.View>;
}

/* =========================================================
   Графика
   ========================================================= */

/** Знак AVP: Λ V↗ P */
export function Mark({ width = 120, ink = '#F5F5F5', acc, letters = true }: { width?: number; ink?: string; acc?: string; letters?: boolean }) {
  const { t } = useSettings();
  const a = acc ?? t.accent;
  const vb = letters ? '-12 -12 250 126' : '-14 -14 186 128';
  const ratio = letters ? 126 / 250 : 128 / 186;
  const p = { fill: 'none', strokeWidth: 13, strokeLinejoin: 'miter' as const };
  return (
    <Svg width={width} height={width * ratio} viewBox={vb}>
      <Path d="M0 100 L32 10 L64 100" stroke={ink} {...p} />
      <Path d="M84 10 L114 100" stroke={ink} {...p} />
      <Path d="M114 100 L146 10" stroke={a} {...p} />
      <Path d="M120.13 25.19 L146 10 L156.47 38.11" stroke={a} {...p} />
      {letters ? <Path d="M176 100 V10 H206 A26 26 0 0 1 206 62 H176" stroke={ink} {...p} /> : null}
    </Svg>
  );
}

export function Logo({ size = 38 }: { size?: number }) {
  const { t } = useSettings();
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', zIndex: 0, ...shadow(t.accent, 0.5, 12) }}>
      <Fill colors={[t.accent2, t.accent, t.accent3]} radius={size * 0.3} vertical={false} />
      <Mark width={size * 0.66} ink="#111113" acc="#FFFFFF" letters={false} />
    </View>
  );
}

/** Кольцевой индикатор, 0…1. */
export function Ring({ value, size = 92, stroke = 9, color, children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const { t } = useSettings();
  const id = useSvgId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const a = useRef(new Animated.Value(0)).current;
  const [v, setV] = useState(0);
  useEffect(() => {
    const l = a.addListener(({ value: x }) => setV(x));
    Animated.timing(a, { toValue: Math.max(0, Math.min(1, value)), duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => a.removeListener(l);
  }, [value, a]);
  const col = color ?? t.accent;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color ? col : t.accent2} />
            <Stop offset="1" stopColor={color ? col : t.accent3} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.card2} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Линия-график с заливкой. */
export function Spark({ data, width, height = 54, color = '#111113', fill = true }: { data: number[]; width: number; height?: number; color?: string; fill?: boolean }) {
  const id = useSvgId();
  if (data.length < 2 || width <= 0) return <View style={{ height }} />;
  const min = Math.min(...data),
    max = Math.max(...data),
    span = max - min || 1;
  const pts = data.map((d, i) => [(i / (data.length - 1)) * width, height - 4 - ((d - min) / span) * (height - 10)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.28} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {fill ? <Path d={`${line} L${width} ${height} L0 ${height} Z`} fill={`url(#${id})`} /> : null}
      <Path d={line} stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={lx} cy={ly} r={4.5} fill={color} />
      <Circle cx={lx} cy={ly} r={9} fill={color} fillOpacity={0.2} />
    </Svg>
  );
}

/** Полоса прогресса с градиентом. */
export function Bar({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  const { t } = useSettings();
  const w = Math.max(0, Math.min(100, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: t.card2, overflow: 'hidden' }}>
      <View style={{ width: `${w}%`, height: '100%', borderRadius: height, overflow: 'hidden', zIndex: 0 }}>
        {color ? <View style={{ flex: 1, backgroundColor: color }} /> : <Fill colors={[t.accent3, t.accent, t.accent2]} vertical={false} />}
      </View>
    </View>
  );
}

/** Этапы заказа: сегменты, пройденные — светятся. */
export function Steps({ index, total = 5 }: { index: number; total?: number }) {
  const { t } = useSettings();
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginTop: 10 }}>
      {Array.from({ length: total }, (_, k) => (
        <View key={k} style={[{ flex: 1, height: 5, borderRadius: 3, backgroundColor: k <= index ? t.accent : t.card2 }, k === index ? shadow(t.accent, 0.9, 6) : null]} />
      ))}
    </View>
  );
}

/* =========================================================
   Иконки
   ========================================================= */
const PATHS: Record<string, string[]> = {
  home: ['M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'],
  orders: ['M9 4V3h6v1M9 10h6M9 14h6M9 18h3'],
  stock: ['M3 7l9-4 9 4v10l-9 4-9-4z', 'M3 7l9 4 9-4M12 11v10'],
  chat: ['M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z'],
  margin: ['M4 20V10M10 20V4M16 20v-7M22 20H2'],
  money: ['M3 10h18M8 3v4M16 3v4'],
  back: ['M15 5l-7 7 7 7'],
  chev: ['M9 5l7 7-7 7'],
  plus: ['M12 5v14M5 12h14'],
  search: ['M20 20l-4-4'],
  box: ['M12 3v12M7 10l5 5 5-5M5 21h14'],
  send: ['M22 3L2 11l7 3 3 7z', 'M9 14l13-11'],
  close: ['M6 6l12 12M18 6L6 18'],
  check: ['M5 12l5 5 9-10'],
  settings: ['M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1'],
  user: ['M4 21a8 8 0 0 1 16 0'],
  alert: ['M12 3l10 18H2z', 'M12 10v5M12 18v.5'],
  truck: ['M3 6h11v10H3z', 'M14 10h4l3 3v3h-7', 'M7 19a2 2 0 1 0 0-.1M17 19a2 2 0 1 0 0-.1'],
  cal: ['M3 10h18M8 3v4M16 3v4'],
  flame: ['M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-3 2-4 3-7 1 2 2 3 3 3 0-2-1-4 0-6z'],
  bolt: ['M13 2L4 14h7l-1 8 9-12h-7z'],
  tasks: ['M9 11l3 3 8-8', 'M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11'],
  camera: ['M3 8a1 1 0 0 1 1-1h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z', 'M12 9.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7'],
  image: ['M4 4h16v16H4z', 'M4 16l5-5 4 4 3-3 4 4', 'M15 7.5a1.5 1.5 0 1 1 0 3a1.5 1.5 0 1 1 0-3'],
  doc: ['M6 3h9l4 4v14H6z', 'M14 3v5h5', 'M9 13h7M9 17h5'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  phone: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z'],
  video: ['M3 7h11a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z', 'M15 10.5l6-3.5v10l-6-3.5'],
  speaker: ['M4 9h4l5-4v14l-5-4H4z', 'M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12'],
  mic: ['M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z', 'M5 11a7 7 0 0 0 14 0M12 18v3'],
};
export function Icon({ name, size = 22, color, stroke = 1.9 }: { name: string; size?: number; color?: string; stroke?: number }) {
  const { t } = useSettings();
  // цвет и толщину задаём каждой линии: наследование от <Svg> работает не везде
  const p = { fill: 'none', stroke: color ?? t.fg, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {(name === 'orders' || name === 'money' || name === 'cal') && <Rect x={name === 'orders' ? 5 : 3} y={name === 'orders' ? 4 : 5} width={name === 'orders' ? 14 : 18} height={name === 'orders' ? 17 : 16} rx={2} {...p} />}
      {name === 'search' && <Circle cx={11} cy={11} r={7} {...p} />}
      {name === 'settings' && <Circle cx={12} cy={12} r={4} {...p} />}
      {name === 'user' && <Circle cx={12} cy={8} r={4} {...p} />}
      {(PATHS[name] ?? []).map((d, i) => (
        <Path key={i} d={d} {...p} />
      ))}
    </Svg>
  );
}

/** Круглая плашка с иконкой. */
export function IconBadge({ icon, tone = 'accent', size = 40 }: { icon: string; tone?: 'accent' | 'bad' | 'warn' | 'ok' | 'neutral'; size?: number }) {
  const { t } = useSettings();
  const map = { accent: [t.accent + '26', t.accent], bad: [t.badBg, t.bad], warn: [t.warnBg, t.warn], ok: [t.okBg, t.ok], neutral: [t.card2, t.fg] } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.5} color={fg} stroke={2} />
    </View>
  );
}

/** Аватар с инициалами. */
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const { t } = useSettings();
  const ini = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.card2, borderWidth: 1, borderColor: t.edge, alignItems: 'center', justifyContent: 'center' }}>
      <T v="b" style={{ fontSize: size * 0.38, color: t.accent2 }}>
        {ini || '•'}
      </T>
    </View>
  );
}

/* =========================================================
   Экран
   ========================================================= */
export function Screen({
  title,
  kicker,
  subtitle,
  children,
  back,
  scroll = true,
  right,
  compact,
}: {
  compact?: boolean;
  title: string;
  kicker?: string;
  subtitle?: string;
  children: ReactNode;
  back?: boolean;
  scroll?: boolean;
  right?: ReactNode;
}) {
  const { t, s, tap } = useSettings();
  const ins = useSafeAreaInsets();
  // пасхалка: 7 быстрых нажатий на логотип
  const secret = useRef({ n: 0, at: 0 });
  const secretTap = () => {
    const now = Date.now();
    secret.current = now - secret.current.at < 600 ? { n: secret.current.n + 1, at: now } : { n: 1, at: now };
    if (secret.current.n >= 7) {
      secret.current.n = 0;
      tap('success');
      celebrate(SECRETS[Math.floor(Math.random() * SECRETS.length)]);
    }
  };
  const head = (
    <View style={{ paddingTop: ins.top + 8 + (Platform.OS === 'web' ? 56 : 0), paddingBottom: compact ? 8 : 14, gap: 18 }}>
      <View style={styles.row}>
        {back ? (
          <IconButton icon="back" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/more'))} />
        ) : (
          <View style={[styles.row, { gap: 10 }]}>
            <Pressable onPress={secretTap} accessibilityLabel="AVP" hitSlop={6}>
              <Logo />
            </Pressable>
            <View>
              <T v="b" style={{ fontSize: 15, letterSpacing: 0.4 }}>
                AVP
              </T>
              <T v="label" style={{ fontSize: 9, letterSpacing: 3 }}>
                {`system · ${APP_BUILD}`}
              </T>
            </View>
          </View>
        )}
        <View style={{ flex: 1 }} />
        {right}
        <Pressable onPress={() => router.push('/role')} accessibilityRole="button" accessibilityLabel="Сменить роль" hitSlop={4}>
          <View style={[styles.chip, { borderColor: t.premium ? t.accent + '99' : t.line, backgroundColor: t.premium ? t.accent + '14' : t.card2 }]}>
            <View style={[styles.dot, { backgroundColor: t.accent }]} />
            <T v="b" style={{ fontSize: 13 }}>
              {ROLES[s.role].name}
            </T>
          </View>
        </Pressable>
        <IconButton icon="settings" label="Настройки" onPress={() => router.push('/settings')} />
      </View>
      {compact ? null : (
        <View style={{ gap: 6 }}>
          {kicker ? <T v="kicker">{kicker}</T> : null}
          <T v="title">{title}</T>
          {subtitle ? <T v="small">{subtitle}</T> : null}
        </View>
      )}
    </View>
  );
  const pad = { paddingHorizontal: 16, paddingBottom: ins.bottom + 120, gap: 14 };
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Wallpaper />
      {scroll ? (
        <ScrollView contentContainerStyle={pad} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          {head}
          {children}
        </ScrollView>
      ) : (
        <View style={[pad, { flex: 1, paddingBottom: 0 }]}>
          {head}
          {children}
        </View>
      )}
      {/* затемнение под часами, чтобы прокрученный контент не просвечивал под статус-баром */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: ins.top + 14 }}>
        <Fill colors={[t.bg, t.bg + 'EE', t.bg + '00']} />
      </View>
    </View>
  );
}

export function IconButton({ icon, label, onPress, accent }: { icon: string; label: string; onPress: () => void; accent?: boolean }) {
  const { t, tap } = useSettings();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {accent ? (
        <View style={[styles.iconBtn, { backgroundColor: t.accent }]}>
          <Icon name={icon} size={20} color={t.onAccent} />
        </View>
      ) : (
        <Glass radius={19} style={styles.iconBtn} interactive>
          <Icon name={icon} size={19} />
        </Glass>
      )}
    </Pressable>
  );
}

/* =========================================================
   Элементы управления
   ========================================================= */
export function Button({ title, onPress, kind = 'primary', icon, disabled }: { title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; icon?: string; disabled?: boolean }) {
  const { t } = useSettings();
  const fg = kind === 'primary' ? t.onAccent : kind === 'danger' ? t.bad : t.fg;
  const inner = (
    <View style={styles.btn}>
      {icon ? <Icon name={icon} size={19} color={fg} stroke={2.2} /> : null}
      <T v="b" style={{ color: fg, fontSize: 16 }}>
        {title}
      </T>
    </View>
  );
  return (
    <Press onPress={disabled ? undefined : onPress} style={{ flex: 1, opacity: disabled ? 0.45 : 1 }}>
      {kind === 'primary' ? (
        <View style={{ borderRadius: 18, overflow: 'hidden', zIndex: 0, ...shadow(t.accent, 0.45, 18) }}>
          <Fill colors={[t.accent2, t.accent, t.accent3]} radius={18} vertical={false} />
          {inner}
        </View>
      ) : kind === 'danger' ? (
        <View style={{ borderRadius: 18, backgroundColor: t.badBg, borderWidth: 1, borderColor: t.bad + '44' }}>{inner}</View>
      ) : (
        <Glass radius={18}>{inner}</Glass>
      )}
    </Press>
  );
}

export function Pill({ text, tone = 'neutral', outline }: { text: string; tone?: 'neutral' | 'ok' | 'bad' | 'warn' | 'accent'; outline?: boolean }) {
  const { t } = useSettings();
  const map = { neutral: [t.card2, t.dim], ok: [t.okBg, t.ok], bad: [t.badBg, t.bad], warn: [t.warnBg, t.warn], accent: [t.accent, t.onAccent] } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: outline ? 'transparent' : bg, borderWidth: outline ? 1.5 : 0, borderColor: tone === 'neutral' ? t.line : fg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <T v="b" style={{ color: outline && tone === 'accent' ? t.accent : fg, fontSize: 12 }}>
        {text}
      </T>
    </View>
  );
}

export function Section({ children, right }: { children: string; right?: ReactNode }) {
  return (
    <View style={[styles.row, { marginTop: 14, marginHorizontal: 4, justifyContent: 'space-between' }]}>
      <T v="kicker">{children}</T>
      {right}
    </View>
  );
}

export function Segmented<V extends string>({ value, onChange, options }: { value: V; onChange: (v: V) => void; options: { value: V; label: string }[] }) {
  const { t, tap } = useSettings();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1.5, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent + '1F' : 'transparent' }}
          >
            <T v="b" style={{ fontSize: 13, color: on ? t.fg : t.dim }} numberOfLines={1}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Field({ label, style, ...p }: TextInputProps & { label: string }) {
  const { t } = useSettings();
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ gap: 6, flex: 1 }, style as ViewStyle]}>
      <T v="label">{label}</T>
      <TextInput
        placeholderTextColor={t.mute}
        {...p}
        onFocus={(e) => {
          setFocus(true);
          p.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          p.onBlur?.(e);
        }}
        style={[styles.input, { backgroundColor: t.field, color: t.fg, borderColor: focus ? t.accent : t.line }, p.multiline ? { height: undefined, minHeight: 84, maxHeight: 180, paddingTop: 13, paddingBottom: 13, textAlignVertical: 'top' } : null]}
      />
    </View>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { t, tap } = useSettings();
  return (
    <RNSwitch
      accessibilityLabel={label}
      value={value}
      onValueChange={(v) => {
        tap();
        onChange(v);
      }}
      trackColor={{ true: t.accent, false: t.card2 }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={t.card2}
    />
  );
}

export function Stepper({ value, onChange, step = 1, label }: { value: number; onChange: (v: number) => void; step?: number; label: string }) {
  const { t, tap } = useSettings();
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text === null) return;
    const v = parseFloat(text.replace(',', '.'));
    setText(null);
    if (Number.isFinite(v)) onChange(Math.max(0, v));
  };
  const btn = (d: number, sym: string) => (
    <Pressable
      onPress={() => {
        tap();
        onChange(Math.max(0, Math.round((value + d) * 10) / 10));
      }}
      accessibilityLabel={d > 0 ? 'Больше' : 'Меньше'}
      hitSlop={4}
      style={({ pressed }) => [styles.stepBtn, { backgroundColor: pressed ? t.accent + '33' : 'transparent' }]}
    >
      <T v="h" style={{ fontSize: 19, color: t.accent }}>
        {sym}
      </T>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: t.line, backgroundColor: t.field }}>
      {btn(-step, '−')}
      <TextInput
        accessibilityLabel={label}
        value={text ?? String(value).replace('.', ',')}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="decimal-pad"
        returnKeyType="done"
        selectTextOnFocus
        style={[styles.stepInput, { color: t.fg }]}
      />
      {btn(step, '+')}
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={{ padding: 28, alignItems: 'center' }}>
      <T v="small" style={{ textAlign: 'center' }}>
        {text}
      </T>
    </View>
  );
}

export function Banner({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'bad' }) {
  const { t } = useSettings();
  return (
    <Glass radius={18} style={{ padding: 12, borderColor: tone === 'bad' ? t.bad + '55' : t.edge }}>
      <T v="small" style={tone === 'bad' ? { color: t.bad } : undefined}>
        {text}
      </T>
    </Glass>
  );
}

/** Шапка модального листа. */
export function SheetHeader({ title, kicker, right }: { title: string; kicker?: string; right?: ReactNode }) {
  return (
    <View style={[styles.row, { paddingTop: 22, paddingBottom: 6, alignItems: 'flex-start' }]}>
      <View style={{ flex: 1, gap: 4 }}>
        {kicker ? <T v="kicker">{kicker}</T> : null}
        <T v="title" style={{ fontSize: 28 }}>
          {title}
        </T>
      </View>
      {right}
      <IconButton icon="close" label="Закрыть" onPress={() => router.back()} />
    </View>
  );
}

export function Sheet({ children }: { children: ReactNode }) {
  const { t } = useSettings();
  const ins = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.premium ? '#0E0E11' : t.dark ? '#141418' : '#F6F6FA' }}>
      {t.premium ? <Glow color={t.accent} size={520} opacity={0.22} style={{ top: -280, right: -220 }} /> : null}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: ins.bottom + 24, gap: 14 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {children}
      </ScrollView>
    </View>
  );
}

export function shadow(color: string, opacity: number, radius: number): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0 ${radius / 2}px ${radius * 1.4}px ${hexA(color, opacity)}` } as ViewStyle,
    default: { shadowColor: color, shadowOpacity: opacity, shadowRadius: radius, shadowOffset: { width: 0, height: radius / 2 }, elevation: Math.round(radius / 3) },
  })!;
}
function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: { height: 38, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 19, borderWidth: 1.5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  btn: { minHeight: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 15, minHeight: 58 },
  input: { height: 50, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 16, fontFamily: 'Rubik_400Regular' },
  stepBtn: { width: 38, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepInput: { width: 56, height: 40, textAlign: 'center', fontSize: 16, fontFamily: 'Rubik_700Bold' },
  lightShadow: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 1 } },
});

export type { Theme };
