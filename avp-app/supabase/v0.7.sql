-- AVP system 0.7 — задачи, приход на склад, статусы из цеха, фото, «прочитано», заметки по клиентам,
-- утренняя сводка на телефон. Supabase → SQL Editor → вставить всё → Run. Можно запускать повторно.

-- ---------- чат: правка, фото ----------
alter table public.messages add column if not exists edited_at bigint;
alter table public.messages add column if not exists photo text;
alter table public.messages drop constraint if exists messages_text_check;
alter table public.messages add constraint messages_text_check check (char_length(text) <= 1000);
revoke update on public.messages from authenticated;
grant update (text, edited_at) on public.messages to authenticated;
drop policy if exists "messages: edit own" on public.messages;
create policy "messages: edit own" on public.messages for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- кто что прочитал ----------
create table if not exists public.chat_reads (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  channel text not null,
  at bigint not null,
  primary key (user_id, channel)
);
alter table public.chat_reads enable row level security;
drop policy if exists "reads: team" on public.chat_reads;
create policy "reads: team" on public.chat_reads for select to authenticated using (public.my_role() is not null);
drop policy if exists "reads: own insert" on public.chat_reads;
create policy "reads: own insert" on public.chat_reads for insert to authenticated with check (user_id = auth.uid() and public.my_role() is not null);
drop policy if exists "reads: own update" on public.chat_reads;
create policy "reads: own update" on public.chat_reads for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- задачи ----------
create table if not exists public.tasks (
  id text primary key,
  title text not null check (char_length(title) between 1 and 500),
  assignee uuid references auth.users (id) on delete set null,
  assignee_name text not null default '',
  due text,
  done boolean not null default false,
  done_at bigint,
  channel text,
  author text not null default '',
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  at bigint not null
);
alter table public.tasks enable row level security;
drop policy if exists "tasks: team" on public.tasks;
create policy "tasks: team" on public.tasks for select to authenticated using (public.my_role() is not null);
drop policy if exists "tasks: create" on public.tasks;
create policy "tasks: create" on public.tasks for insert to authenticated with check (user_id = auth.uid() and public.my_role() is not null);
drop policy if exists "tasks: update" on public.tasks;
create policy "tasks: update" on public.tasks for update to authenticated
  using (user_id = auth.uid() or assignee = auth.uid() or public.my_role() = 'boss') with check (public.my_role() is not null);
drop policy if exists "tasks: delete" on public.tasks;
create policy "tasks: delete" on public.tasks for delete to authenticated using (user_id = auth.uid() or public.my_role() = 'boss');

-- ---------- приход на склад с телефона ----------
create table if not exists public.stock_moves (
  id text primary key,
  item_id text not null,
  item_name text not null,
  qty numeric not null,
  unit text not null default '',
  note text,
  photo text,
  author text not null default '',
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  at bigint not null
);
alter table public.stock_moves enable row level security;
drop policy if exists "moves: team" on public.stock_moves;
create policy "moves: team" on public.stock_moves for select to authenticated using (public.my_role() is not null);
drop policy if exists "moves: store" on public.stock_moves;
create policy "moves: store" on public.stock_moves for insert to authenticated with check (user_id = auth.uid() and public.my_role() in ('boss', 'store'));
drop policy if exists "moves: delete" on public.stock_moves;
create policy "moves: delete" on public.stock_moves for delete to authenticated using (user_id = auth.uid() or public.my_role() = 'boss');

-- ---------- статусы заказов из цеха ----------
create table if not exists public.order_marks (
  order_no text primary key,
  status text not null check (status in ('new', 'cut', 'build', 'ready', 'shipped')),
  author text not null default '',
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  at bigint not null
);
alter table public.order_marks enable row level security;
drop policy if exists "marks: team" on public.order_marks;
create policy "marks: team" on public.order_marks for select to authenticated using (public.my_role() is not null);
drop policy if exists "marks: insert" on public.order_marks;
create policy "marks: insert" on public.order_marks for insert to authenticated with check (user_id = auth.uid() and public.my_role() in ('boss', 'store', 'sales'));
drop policy if exists "marks: update" on public.order_marks;
create policy "marks: update" on public.order_marks for update to authenticated using (public.my_role() in ('boss', 'store', 'sales')) with check (user_id = auth.uid());

-- ---------- заметки по клиентам ----------
create table if not exists public.client_notes (
  id text primary key,
  client text not null,
  text text not null check (char_length(text) between 1 and 1000),
  author text not null default '',
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  at bigint not null
);
alter table public.client_notes enable row level security;
drop policy if exists "notes: read" on public.client_notes;
create policy "notes: read" on public.client_notes for select to authenticated using (public.my_role() in ('boss', 'sales', 'acc'));
drop policy if exists "notes: write" on public.client_notes;
create policy "notes: write" on public.client_notes for insert to authenticated with check (user_id = auth.uid() and public.my_role() in ('boss', 'sales', 'acc'));
drop policy if exists "notes: delete" on public.client_notes;
create policy "notes: delete" on public.client_notes for delete to authenticated using (user_id = auth.uid() or public.my_role() = 'boss');

-- ---------- фото (закрытое хранилище) ----------
insert into storage.buckets (id, name, public, file_size_limit) values ('photos', 'photos', false, 8388608) on conflict (id) do nothing;
drop policy if exists "photos: team read" on storage.objects;
create policy "photos: team read" on storage.objects for select to authenticated using (bucket_id = 'photos' and public.my_role() is not null);
drop policy if exists "photos: team upload" on storage.objects;
create policy "photos: team upload" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.my_role() is not null);

-- ---------- живые обновления ----------
do $$
declare t text;
begin
  foreach t in array array['tasks', 'stock_moves', 'order_marks', 'chat_reads', 'client_notes'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t); exception when duplicate_object then null; end;
  end loop;
end $$;

-- ---------- утренняя сводка и новые красные сигналы ----------
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.push_state (key text primary key, data jsonb not null, at timestamptz not null default now());
alter table public.push_state enable row level security; -- клиентам закрыта

create or replace function public.morning_digest() returns void
language plpgsql security definer set search_path = public as $$
declare
  snap jsonb;
  d date := (now() at time zone 'Europe/Moscow')::date;
  bal numeric; due numeric := 0; late_pay int := 0;
  ship_n int := 0; ship_sum numeric := 0; overdue_n int := 0;
  low_n int := 0; low_names text; crit text[] := '{}';
  red_now text[] := '{}'; red_old text[] := '{}'; red_new text[];
  l_money text; l_ship text; l_stock text; l_new text; l_new_store text;
  msgs jsonb := '[]'; body text; title text; is_red boolean; p record;
  mln constant text := ' млн';
begin
  select jsonb_object_agg(section, data) into snap from factory_snapshot;
  if snap is null then return; end if;

  bal := coalesce(nullif(snap->'bank'->>'balance', '')::numeric, nullif(snap->'main'->'money'->>'amount', '')::numeric, 0);

  select coalesce(sum(amt), 0), count(*) filter (where day < d) into due, late_pay from (
    select case when x->>'date' ~ '^\d{4}-\d{2}-\d{2}$' then (x->>'date')::date end as day,
           case when jsonb_typeof(x->'amount') = 'number' then (x->>'amount')::numeric else 0 end as amt
    from jsonb_array_elements(coalesce(snap->'payments'->'list', '[]')) x
    where coalesce(x->>'status', '') !~* 'оплач'
  ) q where day is not null and day <= d + 14;

  select count(*), coalesce(sum(case when jsonb_typeof(x->'sum') = 'number' then (x->>'sum')::numeric else 0 end), 0) into ship_n, ship_sum
  from jsonb_array_elements(coalesce(snap->'shipments'->'planned', '[]')) x where x->>'date' = d::text;
  overdue_n := jsonb_array_length(coalesce(snap->'shipments'->'overdue', '[]'));

  select count(*), string_agg(nm, ', ' order by dd) filter (where rn <= 3), coalesce(array_agg(nm) filter (where dd < 2), '{}')
  into low_n, low_names, crit from (
    select x->>'name' as nm, coalesce(nullif(x->>'days', '')::numeric, 0) as dd,
           row_number() over (order by coalesce(nullif(x->>'days', '')::numeric, 0)) as rn
    from jsonb_array_elements(coalesce(snap->'stock', '[]')) x where x->>'status' = 'Мало'
  ) s;

  -- красные сигналы сегодня и вчера: новые выделяем отдельно
  red_now := crit || case when bal < due then array['Не хватает денег на платежи'] else '{}' end
                   || case when late_pay > 0 then array['Просроченные платежи: ' || late_pay] else '{}' end;
  select coalesce(array(select jsonb_array_elements_text(data)), '{}') into red_old from push_state where key = 'red';
  red_new := array(select unnest(red_now) except select unnest(red_old));
  insert into push_state (key, data) values ('red', to_jsonb(red_now)) on conflict (key) do update set data = excluded.data, at = now();

  l_money := '💰 На счёте ' || replace(round(bal / 1e6, 2)::text, '.', ',') || mln || ', к оплате за 2 недели ' || replace(round(due / 1e6, 2)::text, '.', ',') || mln
             || case when bal < due then ' — не хватает!' else '' end
             || case when late_pay > 0 then '. Просрочено платежей: ' || late_pay else '' end;
  l_ship := '🚚 Сегодня отгрузок: ' || ship_n || case when ship_n > 0 then ' на ' || replace(round(ship_sum / 1e6, 2)::text, '.', ',') || mln else '' end
             || case when overdue_n > 0 then '. Просрочено заказов: ' || overdue_n else '' end;
  l_stock := case when low_n > 0 then '📦 Мало на складе: ' || low_n || ' (' || coalesce(low_names, '') || case when low_n > 3 then '…' else '' end || ')' else '📦 Склад: всего хватает' end;
  l_new := case when coalesce(array_length(red_new, 1), 0) > 0 then '🔴 Новое: ' || array_to_string(red_new, '; ') end;
  l_new_store := case when red_new && crit then '🔴 Заканчивается: ' || array_to_string(array(select unnest(red_new) intersect select unnest(crit)), ', ') end;

  for p in select name, role, push_token from profiles where push_token like 'ExponentPushToken%' loop
    body := concat_ws(E'\n',
      case when p.role in ('boss', 'acc') then l_new when p.role = 'store' then l_new_store end,
      case when p.role in ('boss', 'acc') then l_money end,
      case when p.role in ('boss', 'sales', 'store') then l_ship end,
      case when p.role in ('boss', 'store') then l_stock end);
    is_red := case p.role
      when 'boss' then coalesce(array_length(red_now, 1), 0) > 0
      when 'acc' then bal < due or late_pay > 0
      when 'store' then coalesce(array_length(crit, 1), 0) > 0
      else overdue_n > 0 end;
    title := case when is_red then '🔴 ' else '☀️ ' end || 'Доброе утро, ' || split_part(p.name, ' ', 1);
    msgs := msgs || jsonb_build_object('to', p.push_token, 'title', title, 'body', body, 'sound', 'default', 'data', jsonb_build_object('kind', 'digest'));
  end loop;

  if jsonb_array_length(msgs) > 0 then
    perform net.http_post(url := 'https://exp.host/--/api/v2/push/send', body := msgs, headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb);
  end if;
end $$;
revoke all on function public.morning_digest() from public, anon, authenticated;

-- 05:00 UTC = 08:00 по Москве
select cron.schedule('avp-morning-digest', '0 5 * * *', 'select public.morning_digest()');
