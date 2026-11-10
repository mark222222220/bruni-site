/* Праздничные эффекты: celebrate('Задача выполнена!') — конфетти и надпись, toast('…') — только надпись. */
export type Burst = { id: number; text?: string; quiet?: boolean };
let listener: ((b: Burst) => void) | null = null;
let n = 0;
export const onBurst = (l: ((b: Burst) => void) | null) => {
  listener = l;
};
export function celebrate(text?: string) {
  listener?.({ id: ++n, text });
}
export function toast(text: string) {
  listener?.({ id: ++n, text, quiet: true });
}
