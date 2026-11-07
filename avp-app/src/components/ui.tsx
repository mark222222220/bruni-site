import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
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
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { useSettings, type Theme } from '@/lib/settings';
import { ROLES } from '@/lib/types';

const LIQUID = Platform.OS === 'ios' && isLiquidGlassAvailable();

/* ---------- Glass: настоящий Liquid Glass на iOS 26, размытие на остальных ---------- */
export function Glass({ children, style, radius = 22, interactive }: { children?: ReactNode; style?: StyleProp<ViewStyle>; radius?: number; interactive?: boolean }) {
  const { t } = useSettings();
  const shape: ViewStyle = { borderRadius: radius, overflow: 'hidden' };
  if (!t.glass) return <View style={[shape, { backgroundColor: t.card }, !t.dark && styles.lightShadow, style]}>{children}</View>;
  if (LIQUID)
    return (
      <GlassView glassEffectStyle="regular" isInteractive={interactive} colorScheme={t.dark ? 'dark' : 'light'} style={[shape, style]}>
        {children}
      </GlassView>
    );
  return (
    <View style={[shape, { zIndex: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: t.dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.9)' }, style]}>
      {/* фон стекла — под содержимым, иначе он перекрывает иконки */}
      <BlurView intensity={t.dark ? 40 : 60} tint={t.dark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, { zIndex: -1 }]} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, { zIndex: -1, backgroundColor: t.card }]} pointerEvents="none" />
      {children}
    </View>
  );
}

export function Wallpaper() {
  const { t } = useSettings();
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.bg }, t.wallpaper ? { experimental_backgroundImage: t.wallpaper } : null]} />;
}

/* ---------- текст ---------- */
type TP = { children?: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number; selectable?: boolean };
export function T({ children, style, numberOfLines, selectable, v = 'body' }: TP & { v?: 'title' | 'h' | 'body' | 'b' | 'small' | 'label' | 'num' | 'big' }) {
  const { t } = useSettings();
  const k = t.fs / 16;
  const base: Record<string, TextStyle> = {
    title: { fontFamily: 'Rubik_800ExtraBold', fontSize: 32 * k, letterSpacing: -0.6, color: t.fg },
    h: { fontFamily: 'Rubik_700Bold', fontSize: 20 * k, color: t.fg },
    body: { fontFamily: 'Rubik_400Regular', fontSize: 15 * k, color: t.fg, lineHeight: 21 * k },
    b: { fontFamily: 'Rubik_600SemiBold', fontSize: 15 * k, color: t.fg },
    small: { fontFamily: 'Rubik_400Regular', fontSize: 13 * k, color: t.dim, lineHeight: 18 * k },
    label: { fontFamily: 'Rubik_600SemiBold', fontSize: 12 * k, letterSpacing: 1.2, textTransform: 'uppercase', color: t.dim },
    num: { fontFamily: 'Rubik_700Bold', fontSize: 18 * k, color: t.fg, fontVariant: ['tabular-nums'] },
    big: { fontFamily: 'Rubik_800ExtraBold', fontSize: 34 * k, letterSpacing: -0.6, color: t.fg, fontVariant: ['tabular-nums'] },
  };
  return (
    <Text style={[base[v], style]} numberOfLines={numberOfLines} selectable={selectable} maxFontSizeMultiplier={1.4}>
      {children}
    </Text>
  );
}

/* ---------- иконки (те же, что в веб-версии) ---------- */
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
  cloud: ['M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9a4.5 4.5 0 0 0 1 9z'],
};
export function Icon({ name, size = 22, color, stroke = 1.9 }: { name: keyof typeof PATHS | string; size?: number; color?: string; stroke?: number }) {
  const { t } = useSettings();
  // цвет и толщину задаём каждой линии: наследование от <Svg> работает не везде
  const p = { fill: 'none', stroke: color ?? t.fg, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'orders' && <Rect x={5} y={4} width={14} height={17} rx={2} {...p} />}
      {name === 'money' && <Rect x={3} y={5} width={18} height={16} rx={2} {...p} />}
      {name === 'search' && <Circle cx={11} cy={11} r={7} {...p} />}
      {name === 'settings' && <Circle cx={12} cy={12} r={4} {...p} />}
      {name === 'user' && <Circle cx={12} cy={8} r={4} {...p} />}
      {(PATHS[name] ?? []).map((d, i) => (
        <Path key={i} d={d} {...p} />
      ))}
    </Svg>
  );
}

/* ---------- экран с крупным заголовком ---------- */
export function Screen({
  title,
  subtitle,
  children,
  back,
  scroll = true,
  right,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  back?: boolean;
  scroll?: boolean;
  right?: ReactNode;
}) {
  const { t, s } = useSettings();
  const ins = useSafeAreaInsets();
  const head = (
    <View style={{ paddingTop: ins.top + 8 + (Platform.OS === 'web' ? 56 : 0), paddingBottom: 12, gap: 10 }}>
      <View style={styles.row}>
        {back ? (
          <IconButton icon="back" label="Назад" onPress={() => (router.canGoBack() ? router.back() : router.replace('/more'))} />
        ) : (
          <Logo />
        )}
        <View style={{ flex: 1 }} />
        {right}
        <Pressable onPress={() => router.push('/role')} accessibilityRole="button" accessibilityLabel="Сменить роль">
          <Glass radius={18} style={styles.chip} interactive>
            <View style={[styles.dot, { backgroundColor: t.accent }]} />
            <T v="b" style={{ fontSize: 13 }}>
              {ROLES[s.role].name}
            </T>
          </Glass>
        </Pressable>
        <IconButton icon="settings" label="Настройки" onPress={() => router.push('/settings')} />
      </View>
      <View>
        <T v="title">{title}</T>
        {subtitle ? <T v="small">{subtitle}</T> : null}
      </View>
    </View>
  );
  const pad = { paddingHorizontal: 16, paddingBottom: ins.bottom + 110, gap: 14 };
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
    </View>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: '#FF6A1A', alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size * 0.66} height={size * 0.5} viewBox="-14 -14 186 128">
        <Path d="M0 100 L32 10 L64 100" stroke="#111113" strokeWidth={15} fill="none" />
        <Path d="M84 10 L114 100" stroke="#111113" strokeWidth={15} fill="none" />
        <Path d="M114 100 L146 10" stroke="#fff" strokeWidth={15} fill="none" />
        <Path d="M120.13 25.19 L146 10 L156.47 38.11" stroke="#fff" strokeWidth={15} fill="none" />
      </Svg>
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
    >
      {accent ? (
        <View style={[styles.iconBtn, { backgroundColor: t.accent }]}>
          <Icon name={icon} size={20} color={t.onAccent} />
        </View>
      ) : (
        <Glass radius={14} style={styles.iconBtn} interactive>
          <Icon name={icon} size={20} />
        </Glass>
      )}
    </Pressable>
  );
}

/* ---------- кнопки, плашки, строки ---------- */
export function Button({ title, onPress, kind = 'primary', icon, disabled }: { title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; icon?: string; disabled?: boolean }) {
  const { t, tap } = useSettings();
  const fg = kind === 'primary' ? t.onAccent : kind === 'danger' ? t.bad : t.fg;
  const inner = (
    <View style={[styles.btn, kind === 'primary' && { backgroundColor: t.accent }, kind === 'danger' && { backgroundColor: t.badBg }]}>
      {icon ? <Icon name={icon} size={19} color={fg} /> : null}
      <T v="b" style={{ color: fg }}>
        {title}
      </T>
    </View>
  );
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="button"
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.75 : 1, flex: 1 }]}
    >
      {kind === 'ghost' ? (
        <Glass radius={16} interactive>
          {inner}
        </Glass>
      ) : (
        <View style={{ borderRadius: 16, overflow: 'hidden' }}>{inner}</View>
      )}
    </Pressable>
  );
}

export function Pill({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'ok' | 'bad' | 'warn' | 'accent' }) {
  const { t } = useSettings();
  const map = { neutral: [t.card2, t.dim], ok: [t.okBg, t.ok], bad: [t.badBg, t.bad], warn: [t.warnBg, t.warn], accent: [t.accent, t.onAccent] } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <T v="b" style={{ color: fg, fontSize: 12 }}>
        {text}
      </T>
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { tap } = useSettings();
  const body = <Glass style={[{ padding: 16, gap: 8 }, style]}>{children}</Glass>;
  return onPress ? (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}
    >
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function List({ children }: { children: ReactNode }) {
  return <Glass style={{ paddingVertical: 2 }}>{children}</Glass>;
}

export function Item({ title, sub, right, onPress, first, children }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; onPress?: () => void; first?: boolean; children?: ReactNode }) {
  const { t, tap } = useSettings();
  const content = (
    <View style={[styles.item, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line }]}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
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
      style={({ pressed }) => ({ backgroundColor: pressed ? t.card2 : 'transparent' })}
    >
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function Section({ children }: { children: string }) {
  return (
    <T v="label" style={{ marginTop: 8, marginLeft: 4 }}>
      {children}
    </T>
  );
}

export function Bar({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  const { t } = useSettings();
  return (
    <View style={{ height, borderRadius: height, backgroundColor: t.card2, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', backgroundColor: color ?? t.accent, borderRadius: height }} />
    </View>
  );
}

export function Steps({ index, total = 5 }: { index: number; total?: number }) {
  const { t } = useSettings();
  return (
    <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
      {Array.from({ length: total }, (_, k) => (
        <View key={k} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: k <= index ? t.accent : t.card2 }} />
      ))}
    </View>
  );
}

export function Segmented<V extends string>({ value, onChange, options }: { value: V; onChange: (v: V) => void; options: { value: V; label: string }[] }) {
  const { t, tap } = useSettings();
  return (
    <Glass radius={16} style={{ flexDirection: 'row', padding: 4, gap: 4 }}>
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
            style={{ flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: 'center', backgroundColor: on ? t.card2 : 'transparent' }}
          >
            <T v="b" style={{ fontSize: 13, color: on ? t.fg : t.dim }} numberOfLines={1}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </Glass>
  );
}

export function Field({ label, style, ...p }: TextInputProps & { label: string }) {
  const { t } = useSettings();
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ gap: 5, flex: 1 }, style as ViewStyle]}>
      <T v="small">{label}</T>
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
        style={[styles.input, { backgroundColor: t.field, color: t.fg, borderColor: focus ? t.accent : t.line }]}
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
      trackColor={{ true: t.ok, false: t.card2 }}
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
      style={({ pressed }) => [styles.stepBtn, { backgroundColor: pressed ? t.line : t.card2 }]}
    >
      <T v="h" style={{ fontSize: 20 }}>
        {sym}
      </T>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
        style={[styles.stepInput, { color: t.fg, backgroundColor: t.field, borderColor: t.line }]}
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
    <Glass style={{ padding: 12, backgroundColor: tone === 'bad' ? t.badBg : undefined }}>
      <T v="small" style={tone === 'bad' ? { color: t.bad } : undefined}>
        {text}
      </T>
    </Glass>
  );
}

/** Шапка модального листа: заголовок и крестик. */
export function SheetHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={[styles.row, { paddingTop: 20, paddingBottom: 6 }]}>
      <T v="h" style={{ flex: 1, fontSize: 22 }}>
        {title}
      </T>
      {right}
      <IconButton icon="close" label="Закрыть" onPress={() => router.back()} />
    </View>
  );
}

export function Sheet({ children }: { children: ReactNode }) {
  const { t } = useSettings();
  const ins = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.dark ? '#141418' : '#F6F6FA' }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: ins.bottom + 24, gap: 14 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {children}
      </ScrollView>
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chip: { height: 36, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  btn: { minHeight: 50, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, minHeight: 54 },
  input: { height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, fontSize: 16, fontFamily: 'Rubik_400Regular' },
  stepBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepInput: { width: 66, height: 38, borderRadius: 12, borderWidth: 1, textAlign: 'center', fontSize: 16, fontFamily: 'Rubik_600SemiBold' },
  lightShadow: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 1 } },
});

export type { Theme };
