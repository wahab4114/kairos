create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.watchlist_stocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  symbol text not null,
  name text not null,
  current_price numeric(14, 4) not null,
  currency text not null,
  brokerage_platform text,
  added_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists watchlist_stocks_user_id_idx on public.watchlist_stocks (user_id);
create index if not exists watchlist_stocks_symbol_idx on public.watchlist_stocks (symbol);

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  stock_id uuid not null references public.watchlist_stocks (id) on delete cascade,
  trigger_price numeric(14, 4) not null,
  alert_type text not null check (alert_type in ('buy', 'sell')),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  triggered_at timestamptz
);

create index if not exists price_alerts_user_id_idx on public.price_alerts (user_id);
create index if not exists price_alerts_stock_id_idx on public.price_alerts (stock_id);

alter table public.profiles enable row level security;
alter table public.watchlist_stocks enable row level security;
alter table public.price_alerts enable row level security;

create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id);

create policy "watchlist_select_own" on public.watchlist_stocks
for select using (auth.uid() = user_id);

create policy "watchlist_insert_own" on public.watchlist_stocks
for insert with check (auth.uid() = user_id);

create policy "watchlist_update_own" on public.watchlist_stocks
for update using (auth.uid() = user_id);

create policy "watchlist_delete_own" on public.watchlist_stocks
for delete using (auth.uid() = user_id);

create policy "alerts_select_own" on public.price_alerts
for select using (auth.uid() = user_id);

create policy "alerts_insert_own" on public.price_alerts
for insert with check (auth.uid() = user_id);

create policy "alerts_update_own" on public.price_alerts
for update using (auth.uid() = user_id);

create policy "alerts_delete_own" on public.price_alerts
for delete using (auth.uid() = user_id);
