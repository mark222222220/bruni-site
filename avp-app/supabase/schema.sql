-- AVP system — схема закрытой базы (Supabase → SQL Editor → вставить всё → Run).
-- Можно запускать повторно: ничего не сломает.

-- ---------- сотрудники и роли ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  role text not null default 'store' check (role in ('boss', 'acc', 'sales', 'store')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- роль вошедшего пользователя (без рекурсии в политиках)
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;
revoke all on function public.my_role() from public;
grant execute on function public.my_role() to authenticated;

drop policy if exists "profiles: read team" on public.profiles;
create policy "profiles: read team" on public.profiles for select to authenticated using (public.my_role() is not null);

-- ---------- цифры завода из таблицы ----------
-- section: main, kv, bank, payments, clients — финансы; stock, shipments — для цеха
create table if not exists public.factory_snapshot (
  section text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.factory_snapshot enable row level security;

drop policy if exists "snapshot: by role" on public.factory_snapshot;
create policy "snapshot: by role" on public.factory_snapshot for select to authenticated using (
  case
    when public.my_role() in ('boss', 'acc') then true
    when public.my_role() = 'sales' then section in ('stock', 'shipments', 'clients', 'meta')
    when public.my_role() = 'store' then section in ('stock', 'shipments', 'meta')
    else false
  end
);
-- записывать может только ночная синхронизация (секретный ключ обходит RLS)

-- ---------- общий чат ----------
create table if not exists public.messages (
  id text primary key,
  channel text not null,
  author text not null,
  role text not null,
  text text not null check (char_length(text) between 1 and 1000),
  quote text,
  at bigint not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade
);
create index if not exists messages_channel_at on public.messages (channel, at desc);
alter table public.messages enable row level security;

drop policy if exists "messages: read team" on public.messages;
create policy "messages: read team" on public.messages for select to authenticated using (public.my_role() is not null);
drop policy if exists "messages: write own" on public.messages;
create policy "messages: write own" on public.messages for insert to authenticated with check (user_id = auth.uid() and public.my_role() is not null);
drop policy if exists "messages: delete own or boss" on public.messages;
create policy "messages: delete own or boss" on public.messages for delete to authenticated using (user_id = auth.uid() or public.my_role() = 'boss');

-- ---------- живые обновления ----------
do $$
begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.factory_snapshot; exception when duplicate_object then null; end;
end $$;

