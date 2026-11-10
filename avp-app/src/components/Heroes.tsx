import { View } from 'react-native';
import { Avatar, Card, T, styles } from '@/components/ui';
import { useSettings } from '@/lib/settings';
import { firstName, useTeam } from '@/lib/team';

const MEDALS = ['🥇', '🥈', '🥉'];

/** «Герои недели»: очки за выполненные задачи, приход на склад, отметки заказов и реакции коллег за 7 дней. */
export function useHeroes() {
  const { tasks, moves, marks, reactions, people } = useTeam();
  const since = Date.now() - 7 * 864e5;
  const pts = new Map<string, { score: number; tasks: number; moves: number; marks: number }>();
  const add = (id: string | null | undefined, k: 'tasks' | 'moves' | 'marks' | null, p: number) => {
    if (!id) return;
    const cur = pts.get(id) ?? { score: 0, tasks: 0, moves: 0, marks: 0 };
    cur.score += p;
    if (k) cur[k] += 1;
    pts.set(id, cur);
  };
  for (const t of tasks) if (t.done && (t.done_at ?? 0) > since) add(t.assignee ?? t.user_id, 'tasks', 3);
  for (const m of moves) if (m.at > since) add(m.user_id, 'moves', 2);
  for (const m of marks) if (m.at > since) add(m.user_id, 'marks', 2);
  for (const r of reactions) if (r.at > since) add(r.user_id, null, 0.5);
  return [...pts.entries()]
    .map(([id, v]) => ({ id, name: people.find((p) => p.id === id)?.name ?? '', ...v }))
    .filter((x) => x.name && x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export function HeroesCard() {
  const { t } = useSettings();
  const top = useHeroes();
  if (!top.length) return null;
  return (
    <Card style={{ gap: 10 }}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <T v="label">Герои недели</T>
        <T v="small">за 7 дней</T>
      </View>
      {top.map((h, i) => (
        <View key={h.id} style={[styles.row, { gap: 12 }]}>
          <T v="body" style={{ fontSize: 24, width: 30 }}>
            {MEDALS[i]}
          </T>
          <Avatar name={h.name} />
          <View style={{ flex: 1 }}>
            <T v="b">{firstName(h.name)}</T>
            <T v="small" numberOfLines={1}>
              {[h.tasks && `задач ${h.tasks}`, h.moves && `приходов ${h.moves}`, h.marks && `заказов ${h.marks}`].filter(Boolean).join(' · ') || 'активность в чате'}
            </T>
          </View>
          <T v="num" style={{ color: i === 0 ? t.accent : t.fg }}>
            {Math.round(h.score)}
          </T>
        </View>
      ))}
    </Card>
  );
}
