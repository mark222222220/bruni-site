import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Card, Empty, Glass, Screen, Segmented, T, styles } from '@/components/ui';
import { useSettings } from '@/lib/settings';
import { dayKey, hm, MOVE, signed } from '@/lib/stock';
import { useTeam, type MoveKind } from '@/lib/team';

type K = 'all' | MoveKind;
type P = 'today' | 'week' | 'month';
const SINCE: Record<P, () => number> = {
  today: () => new Date(new Date().toDateString()).getTime(),
  week: () => Date.now() - 7 * 864e5,
  month: () => Date.now() - 30 * 864e5,
};

/** Журнал склада: все движения, по дням. Ошибочную запись можно удалить (своё или руководитель). */
export default function StockLog() {
  const { moves, removeMove, me } = useTeam();
  const { s, t, tap } = useSettings();
  const [k, setK] = useState<K>('all');
  const [p, setP] = useState<P>('week');
  const [sure, setSure] = useState<string | null>(null);
  const list = useMemo(() => moves.filter((m) => m.at >= SINCE[p]() && (k === 'all' || m.kind === k)).sort((a, b) => b.at - a.at), [moves, k, p]);
  const days = [...new Set(list.map((m) => dayKey(m.at)))];
  const count = (kind: MoveKind) => list.filter((m) => m.kind === kind).length;

  return (
    <Screen kicker="Склад" title="Журнал" subtitle={`${list.length} записей · приход ${count('in')} · выдача ${count('out')} · списание ${count('writeoff')}`} back>
      <Segmented
        value={p}
        onChange={setP}
        options={[
          { value: 'today', label: 'Сегодня' },
          { value: 'week', label: 'Неделя' },
          { value: 'month', label: 'Месяц' },
        ]}
      />
      <Segmented
        value={k}
        onChange={setK}
        options={[
          { value: 'all', label: 'Все' },
          { value: 'in', label: 'Приход' },
          { value: 'out', label: 'Выдача' },
          { value: 'writeoff', label: 'Списание' },
          { value: 'count', label: 'Пересчёт' },
        ]}
      />
      {days.length ? (
        days.map((d) => (
          <View key={d} style={{ gap: 6 }}>
            <T v="label">{d}</T>
            <Glass style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
              {list
                .filter((m) => dayKey(m.at) === d)
                .map((m, i) => (
                  <Pressable
                    key={m.id}
                    onPress={() => router.push({ pathname: '/stock-item', params: { id: m.item_id, name: m.item_name } })}
                    onLongPress={() => (m.user_id === me || s.role === 'boss' ? setSure(m.id) : undefined)}
                    style={[styles.row, { gap: 10, paddingVertical: 10, borderTopWidth: i ? 0.5 : 0, borderTopColor: t.line }]}
                  >
                    <T v="body" style={{ fontSize: 20 }}>
                      {MOVE[m.kind].emoji}
                    </T>
                    <View style={{ flex: 1 }}>
                      <T v="b" style={{ fontSize: 14 }} numberOfLines={1}>
                        {m.item_name}
                      </T>
                      <T v="small" numberOfLines={2}>
                        {hm(m.at)} · {MOVE[m.kind].name.toLowerCase()} · {m.author}
                        {m.order_no ? ` · №${m.order_no}` : ''}
                        {m.note ? ` · ${m.note}` : ''}
                      </T>
                      {sure === m.id ? (
                        <Pressable
                          onPress={async () => {
                            tap('warning');
                            setSure(null);
                            await removeMove(m.id);
                          }}
                          style={{ marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: t.bad }}
                        >
                          <T v="b" style={{ color: '#fff', fontSize: 13 }}>
                            Удалить ошибочную запись
                          </T>
                        </Pressable>
                      ) : null}
                    </View>
                    <T v="num" style={{ fontSize: 15, color: m.qty > 0 ? t.ok : t.fg }}>
                      {signed(m.qty, m.unit)}
                    </T>
                  </Pressable>
                ))}
            </Glass>
          </View>
        ))
      ) : (
        <Card>
          <Empty text="За этот период движений нет." />
        </Card>
      )}
      <T v="small" style={{ textAlign: 'center' }}>
        Зажмите запись, чтобы удалить ошибку (свою или любую — руководителю)
      </T>
    </Screen>
  );
}
