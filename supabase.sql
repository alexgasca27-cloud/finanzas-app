-- FINANZAS APP v3
-- Ejecutar en Supabase > SQL Editor.
-- RLS está habilitado para impedir que un usuario vea los datos de otro usuario.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  account_mode text not null default 'individual' check (account_mode in ('individual','duo','family')),
  created_at timestamptz not null default now()
);

create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  concept_name text,
  description text,
  amount numeric(14,2) not null check (amount > 0),
  transaction_date date not null default current_date,
  payment_method text check (payment_method in ('debit','cash','credit','department_store','kueski')),
  is_shared boolean not null default false,
  shared_total numeric(14,2),
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  product_type text not null check (product_type in ('Tarjeta de crédito','Tarjeta departamental','Kueski')),
  credit_limit numeric(14,2) not null default 0,
  credit_used numeric(14,2) not null default 0,
  cut_day integer check (cut_day between 1 and 31),
  due_day integer check (due_day between 1 and 31),
  created_at timestamptz not null default now()
);

create table if not exists public.concepts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  name text not null,
  created_at timestamptz not null default now(),
  unique(user_id,type,name)
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0,
  target_date date,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.movements enable row level security;
alter table public.cards enable row level security;
alter table public.concepts enable row level security;
alter table public.savings_goals enable row level security;

drop policy if exists "profiles own data" on public.profiles;
create policy "profiles own data" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "movements own data" on public.movements;
create policy "movements own data" on public.movements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cards own data" on public.cards;
create policy "cards own data" on public.cards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "concepts own data" on public.concepts;
create policy "concepts own data" on public.concepts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goals own data" on public.savings_goals;
create policy "goals own data" on public.savings_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Conceptos iniciales. Se insertan automáticamente cuando un usuario entre por primera vez.
create or replace function public.create_default_concepts()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.concepts(user_id,type,name) values
    (new.id,'income','Nómina'),
    (new.id,'income','Freelancer'),
    (new.id,'income','Bonos'),
    (new.id,'income','Otros ingresos'),
    (new.id,'expense','Amazon'),
    (new.id,'expense','Walmart'),
    (new.id,'expense','Chedraui'),
    (new.id,'expense','Costco'),
    (new.id,'expense','Gasolina'),
    (new.id,'expense','Restaurantes'),
    (new.id,'expense','Servicios'),
    (new.id,'expense','Otros gastos')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created
after insert on public.profiles
for each row execute function public.create_default_concepts();

-- IMPORTANTE:
-- La regla de 24 horas se valida también en frontend en esta primera versión.
-- Antes de producción conviene agregar una política/función RPC de UPDATE/DELETE
-- que rechace cualquier modificación o eliminación después de 24 horas.
