-- Finanzas App V5
create extension if not exists pgcrypto;

create table if not exists public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,email text,display_name text,
 account_mode text not null default 'individual' check(account_mode in('individual','duo','family')),created_at timestamptz not null default now());

create table if not exists public.workspaces(
 id uuid primary key default gen_random_uuid(),name text,
 type text not null default 'individual' check(type in('individual','duo','family')),
 owner_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now());

create table if not exists public.workspace_members(
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'member' check(role in('owner','member')),created_at timestamptz not null default now(),
 primary key(workspace_id,user_id));

create table if not exists public.workspace_invitations(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 invited_email text not null,invited_by uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in('pending','accepted','cancelled')),created_at timestamptz not null default now());

create table if not exists public.movements(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 workspace_id uuid references public.workspaces(id) on delete cascade,type text not null check(type in('income','expense')),
 concept_name text,description text,amount numeric(14,2) not null check(amount>0),transaction_date date not null default current_date,
 payment_method text check(payment_method in('debit','cash','credit','department_store','kueski')),
 is_shared boolean not null default false,shared_total numeric(14,2),created_at timestamptz not null default now());

create table if not exists public.cards(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 workspace_id uuid references public.workspaces(id) on delete cascade,name text not null,
 product_type text not null check(product_type in('Tarjeta de crédito','Tarjeta departamental','Kueski')),
 credit_limit numeric(14,2) not null default 0,credit_used numeric(14,2) not null default 0,
 cut_day integer check(cut_day between 1 and 31),due_day integer check(due_day between 1 and 31),created_at timestamptz not null default now());

create table if not exists public.concepts(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 workspace_id uuid references public.workspaces(id) on delete cascade,type text not null check(type in('income','expense')),
 name text not null,created_at timestamptz not null default now(),unique(workspace_id,type,name));

create table if not exists public.savings_goals(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 workspace_id uuid references public.workspaces(id) on delete cascade,name text not null,
 target_amount numeric(14,2) not null check(target_amount>0),current_amount numeric(14,2) not null default 0,target_date date,created_at timestamptz not null default now());

alter table public.movements add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.cards add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.concepts add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.savings_goals add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

-- V23: metas de ahorro dinámicas y aportaciones
alter table public.savings_goals add column if not exists planned_amount numeric(14,2) not null default 0;
alter table public.savings_goals add column if not exists frequency text not null default 'monthly';
alter table public.savings_goals drop constraint if exists savings_goals_frequency_check;
alter table public.savings_goals add constraint savings_goals_frequency_check check(frequency in ('monthly','biweekly'));

create table if not exists public.savings_goal_contributions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 workspace_id uuid references public.workspaces(id) on delete cascade,
 goal_id uuid not null references public.savings_goals(id) on delete cascade,
 amount numeric(14,2) not null check(amount>0),
 contribution_date date not null default current_date,
 note text,
 created_at timestamptz not null default now()
);

alter table public.savings_goal_contributions enable row level security;
drop policy if exists "goal contributions workspace data" on public.savings_goal_contributions;
create policy "goal contributions workspace data" on public.savings_goal_contributions for all using(public.is_workspace_member(workspace_id,auth.uid())) with check(public.is_workspace_member(workspace_id,auth.uid()));
grant select,insert,update,delete on public.savings_goal_contributions to authenticated;
create index if not exists savings_goal_contributions_goal_idx on public.savings_goal_contributions(goal_id,contribution_date);

-- Espacios individuales para datos existentes.
insert into public.workspaces(name,type,owner_id)
select coalesce(p.display_name,p.email,'Mis finanzas'),'individual',p.id
from public.profiles p
where not exists(select 1 from public.workspace_members wm where wm.user_id=p.id);

insert into public.workspace_members(workspace_id,user_id,role)
select w.id,w.owner_id,'owner' from public.workspaces w
where not exists(select 1 from public.workspace_members wm where wm.workspace_id=w.id and wm.user_id=w.owner_id);

update public.movements m set workspace_id=wm.workspace_id from public.workspace_members wm where wm.user_id=m.user_id and m.workspace_id is null;
update public.cards c set workspace_id=wm.workspace_id from public.workspace_members wm where wm.user_id=c.user_id and c.workspace_id is null;
update public.concepts c set workspace_id=wm.workspace_id from public.workspace_members wm where wm.user_id=c.user_id and c.workspace_id is null;
update public.savings_goals g set workspace_id=wm.workspace_id from public.workspace_members wm where wm.user_id=g.user_id and g.workspace_id is null;

-- Función segura para evaluar membresía sin recursión de RLS.
create or replace function public.is_workspace_member(wid uuid, uid uuid)
returns boolean language sql security definer set search_path=public
as $$ select exists(select 1 from public.workspace_members where workspace_id=wid and user_id=uid); $$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.movements enable row level security;
alter table public.cards enable row level security;
alter table public.concepts enable row level security;
alter table public.savings_goals enable row level security;

drop policy if exists "workspace read" on public.workspaces;
create policy "workspace read" on public.workspaces for select using(public.is_workspace_member(id,auth.uid()));
drop policy if exists "workspace insert own" on public.workspaces;
create policy "workspace insert own" on public.workspaces for insert with check(owner_id=auth.uid());
drop policy if exists "workspace owner update" on public.workspaces;
create policy "workspace owner update" on public.workspaces for update using(owner_id=auth.uid()) with check(owner_id=auth.uid());

drop policy if exists "members read" on public.workspace_members;
create policy "members read" on public.workspace_members for select using(public.is_workspace_member(workspace_id,auth.uid()));
drop policy if exists "owner insert member" on public.workspace_members;
create policy "owner insert member" on public.workspace_members for insert with check(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=auth.uid()));

drop policy if exists "invitation read" on public.workspace_invitations;
create policy "invitation read" on public.workspace_invitations for select using(invited_by=auth.uid() or lower(invited_email)=lower((select email from auth.users where id=auth.uid())));
drop policy if exists "owner create invitation" on public.workspace_invitations;
create policy "owner create invitation" on public.workspace_invitations for insert with check(invited_by=auth.uid() and exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=auth.uid()));

drop policy if exists "movements own data" on public.movements;
drop policy if exists "movements workspace data" on public.movements;
create policy "movements workspace data" on public.movements for all using(public.is_workspace_member(workspace_id,auth.uid())) with check(public.is_workspace_member(workspace_id,auth.uid()));
drop policy if exists "cards own data" on public.cards;
drop policy if exists "cards workspace data" on public.cards;
create policy "cards workspace data" on public.cards for all using(public.is_workspace_member(workspace_id,auth.uid())) with check(public.is_workspace_member(workspace_id,auth.uid()));
drop policy if exists "concepts own data" on public.concepts;
drop policy if exists "concepts workspace data" on public.concepts;
create policy "concepts workspace data" on public.concepts for all using(public.is_workspace_member(workspace_id,auth.uid())) with check(public.is_workspace_member(workspace_id,auth.uid()));
drop policy if exists "goals own data" on public.savings_goals;
drop policy if exists "goals workspace data" on public.savings_goals;
create policy "goals workspace data" on public.savings_goals for all using(public.is_workspace_member(workspace_id,auth.uid())) with check(public.is_workspace_member(workspace_id,auth.uid()));

grant usage on schema public to authenticated;
grant select,insert,update,delete on public.profiles,public.workspaces,public.workspace_members,public.workspace_invitations,public.movements,public.cards,public.concepts,public.savings_goals to authenticated;

-- ============================================================
-- V6: LÓGICA FINANCIERA BASE
-- ============================================================
alter table public.movements add column if not exists card_id uuid references public.cards(id) on delete set null;
alter table public.movements add column if not exists movement_role text not null default 'normal'
  check (movement_role in ('normal','card_purchase','card_payment','kueski_purchase','kueski_payment'));
alter table public.movements add column if not exists notes text;

create index if not exists movements_workspace_date_idx on public.movements(workspace_id,transaction_date);
create index if not exists movements_card_idx on public.movements(card_id);

create or replace function public.is_real_cash_outflow(movement_type text,payment_method text,movement_role text)
returns boolean language sql immutable as $$
 select movement_type='expense' and (
   payment_method in ('debit','cash') or movement_role in ('card_payment','kueski_payment')
 );
$$;

create or replace function public.workspace_balance(wid uuid,until_date date default current_date)
returns numeric language sql security definer set search_path=public as $$
 select coalesce(sum(case
   when type='income' then amount
   when public.is_real_cash_outflow(type,payment_method,movement_role) then -amount
   else 0 end),0)
 from public.movements where workspace_id=wid and transaction_date<=until_date;
$$;

create or replace function public.card_balance(cid uuid)
returns numeric language sql security definer set search_path=public as $$
 select greatest(0,coalesce(sum(case
   when movement_role in ('card_purchase','kueski_purchase') then amount
   when movement_role in ('card_payment','kueski_payment') then -amount
   else 0 end),0))
 from public.movements where card_id=cid;
$$;

grant execute on function public.workspace_balance(uuid,date) to authenticated;
grant execute on function public.card_balance(uuid) to authenticated;
-- V12: financiamiento Kueski en quincenas (1 a 12)
alter table public.movements add column if not exists kueski_installments integer;
alter table public.movements drop constraint if exists movements_kueski_installments_check;
alter table public.movements add constraint movements_kueski_installments_check check (kueski_installments is null or kueski_installments between 1 and 12);
create index if not exists movements_kueski_idx on public.movements(card_id,kueski_installments) where movement_role='kueski_purchase';


-- V16: meses sin intereses (MSI) para tarjetas de crédito
alter table public.movements add column if not exists card_installments integer;
alter table public.movements drop constraint if exists movements_card_installments_check;
alter table public.movements add constraint movements_card_installments_check
  check (card_installments is null or card_installments between 1 and 24);
create index if not exists movements_card_installments_idx
  on public.movements(card_id,card_installments)
  where movement_role='card_purchase';
