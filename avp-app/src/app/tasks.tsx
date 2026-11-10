import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Appear, Banner, Button, Card, Empty, Icon, Pill, Screen, Segmented, T, styles } from '@/components/ui';
import { dm, today } from '@/lib/format';
import { useSettings } from '@/lib/settings';
import { firstName, useTeam, type Task } from '@/lib/team';

type F = 'mine' | 'given' | 'all' | 'done';

export function dueLabel(due: string | null) {
  if (!due) return null;
  const T0 = today();
  if (due < T0) return { text: `просрочено · ${dm(due)}`, tone: 'bad' as const };
  if (due === T0) return { text: 'сегодня', tone: 'warn' as const };
  return { text: `до ${dm(due)}`, tone: 'neutral' as const };
}

function TaskRow({ x }: { x: Task }) {
  const { t, tap, s } = useSettings();
  const { me, toggleTask, removeTask, people } = useTeam();
  const [sure, setSure] = useState(false);
  const due = x.done ? null : dueLabel(x.due);
  const from = people.find((p) => p.id === x.user_id)?.name ?? x.author;
  const canDel = x.user_id === me || s.role === 'boss';
  const canTick = x.assignee === me || x.user_id === me || s.role === 'boss' || !x.assignee;
  return (
    <Card tone={due?.tone === 'bad' ? 'bad' : undefined} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <Pressable
        onPress={async () => {
          if (!canTick) return;
          tap(x.done ? 'light' : 'success');
          await toggleTask(x);
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: x.done, disabled: !canTick }}
        accessibilityLabel={x.title}
        hitSlop={10}
        style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: x.done ? t.ok : canTick ? t.accent : t.line, backgroundColor: x.done ? t.ok : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}
      >
        {x.done ? <Icon name="check" size={16} color="#fff" stroke={3} /> : null}
      </Pressable>
      <View style={{ flex: 1, gap: 6 }}>
        <T v="b" style={x.done ? { textDecorationLine: 'line-through', opacity: 0.55 } : undefined}>
          {x.title}
        </T>
        <View style={[styles.row, { flexWrap: 'wrap', gap: 6 }]}>
          {due ? <Pill text={due.text} tone={due.tone} /> : null}
          <T v="small">{x.assignee ? (x.assignee === me ? `вам от ${firstName(from)}` : `${firstName(x.assignee_name)} · от ${firstName(from)}`) : `от ${firstName(from)}`}</T>
        </View>
      </View>
      {canDel ? (
        <Pressable
          onPress={async () => {
            if (!sure) return setSure(true);
            tap('warning');
            await removeTask(x.id);
          }}
          accessibilityLabel={sure ? 'Точно удалить задачу' : 'Удалить задачу'}
          hitSlop={10}
          style={{ padding: 2 }}
        >
          {sure ? (
            <T v="b" style={{ color: t.bad, fontSize: 12 }}>
              Удалить?
            </T>
          ) : (
            <Icon name="trash" size={18} color={t.mute} />
          )}
        </Pressable>
      ) : null}
    </Card>
  );
}

export default function Tasks() {
  const { tasks, me, missing } = useTeam();
  const { s } = useSettings();
  const [f, setF] = useState<F>('mine');
  const open = tasks.filter((x) => !x.done);
  const groups: Record<F, Task[]> = useMemo(
    () => ({
      mine: open.filter((x) => x.assignee === me || (!x.assignee && x.user_id === me)),
      given: open.filter((x) => x.user_id === me && x.assignee && x.assignee !== me),
      all: open,
      done: tasks.filter((x) => x.done).sort((a, b) => (b.done_at ?? 0) - (a.done_at ?? 0)).slice(0, 40),
    }),
    [tasks, open, me],
  );
  const list = f === 'done' ? groups.done : groups[f].slice().sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9') || b.at - a.at);
  const late = groups.mine.filter((x) => x.due && x.due < today()).length;

  return (
    <Screen kicker="Команда" title="Задачи" subtitle={groups.mine.length ? `${groups.mine.length} на вас${late ? ` · ${late} просрочено` : ''}` : 'Ваших задач нет'} back>
      {missing ? <Banner tone="bad" text="Задачи ещё не включены в базе. Руководителю нужно один раз выполнить SQL 0.7 в Supabase." /> : null}
      <Segmented
        value={f}
        onChange={setF}
        options={[
          { value: 'mine', label: `Мои · ${groups.mine.length}` },
          { value: 'given', label: `Поручил · ${groups.given.length}` },
          ...(s.role === 'boss' ? [{ value: 'all' as F, label: `Все · ${groups.all.length}` }] : []),
          { value: 'done', label: 'Готово' },
        ]}
      />
      {list.length ? (
        list.map((x, i) => (
          <Appear key={x.id} i={i}>
            <TaskRow x={x} />
          </Appear>
        ))
      ) : (
        <Card>
          <Empty text={f === 'done' ? 'Выполненных пока нет.' : f === 'given' ? 'Вы никому не поручали задач.' : 'Задач нет — можно выдохнуть.'} />
        </Card>
      )}
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        <Button title="Новая задача" icon="plus" onPress={() => router.push('/new-task')} />
      </View>
      <T v="small" style={{ textAlign: 'center' }}>
        Задачу можно сделать из сообщения: зажмите его в чате → «Сделать задачей»
      </T>
    </Screen>
  );
}
