-- AVP system: схема облачной базы (Supabase → SQL Editor → вставить и выполнить).
-- После выполнения: Authentication → Sign In / Providers → включить «Anonymous sign-ins».

create table if not exists public.clients (
  id text primary key,
  name text not null,
  kind text not null default 'Другое',
  city text not null default '',
  rev numeric not null default 0,      -- выручка, млн ₽ в месяц
  mat numeric not null default 0,      -- маржа после материалов, %
  work numeric not null default 0,     -- маржа после материалов и труда, %
  example boolean not null default false
);

create table if not exists public.orders (
  id text primary key,
  no integer not null,
  client text not null,
  formula text not null,
  qty numeric not null,
  area numeric not null,
  sum numeric not null,
  ship text not null,                  -- YYYY-MM-DD
  status text not null default 'new' check (status in ('new','cut','build','ready','shipped')),
  note text default '',
  example boolean not null default false
);

create table if not exists public.stock (
  id text primary key,
  name text not null,
  unit text not null,
  qty numeric not null default 0,
  min numeric not null default 0,
  pack numeric not null default 1,
  sort integer not null default 0
);

create table if not exists public.payments (
  id text primary key,
  title text not null,
  amount numeric not null,
  date text not null,                  -- YYYY-MM-DD
  paid boolean not null default false
);

create table if not exists public.messages (
  id text primary key,
  channel text not null,
  author text not null,
  role text not null,
  text text not null check (char_length(text) <= 1000),
  quote text,
  at bigint not null                   -- мс с 1970 года
);
create index if not exists messages_channel_at on public.messages (channel, at desc);

-- Доступ: только вошедшие пользователи приложения (анонимный вход тоже считается).
-- Это тестовый режим: любой, у кого есть приложение, может читать и менять данные.
-- Перед рабочим запуском замените на вход по приглашению и роли (см. README).
do $$
declare t text;
begin
  foreach t in array array['clients','orders','stock','payments','messages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "team read" on public.%I', t);
    execute format('drop policy if exists "team write" on public.%I', t);
    execute format('create policy "team read" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "team write" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Живые обновления между телефонами
alter publication supabase_realtime add table public.clients, public.orders, public.stock, public.payments, public.messages;

-- Стартовые материалы склада (можно удалить или поправить)
insert into public.stock (id, name, unit, qty, min, pack, sort) values
  ('glass4', 'Стекло М1 4 мм', 'листов', 180, 120, 40, 1),
  ('butyl', 'Бутил', 'кг', 14, 30, 7, 2),
  ('frame16', 'Рамка алюм. 16 мм', 'м', 950, 600, 250, 3),
  ('sieve', 'Молекулярное сито', 'кг', 22, 25, 25, 4),
  ('sealant', 'Герметик тиокол', 'кг', 160, 100, 30, 5),
  ('argon', 'Аргон', 'баллонов', 5, 3, 1, 6)
on conflict (id) do nothing;
