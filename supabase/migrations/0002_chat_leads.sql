create table public.chat_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  locale text not null,
  name text not null,
  phone text not null,
  question text not null,
  handled boolean not null default false
);

alter table public.chat_leads enable row level security;

-- Anonymous visitors may only insert — never read or update other people's
-- leads. `submit_lead` (engine/chat/tools.ts) runs as the anon key.
create policy chat_leads_anon_insert
  on public.chat_leads for insert to anon with check (true);

-- Wrapped in a scalar subquery so Postgres evaluates is_admin() once per
-- query, not once per row (the "initplan" RLS performance pattern).
create policy chat_leads_admin_read
  on public.chat_leads for select to authenticated
  using ((select public.is_admin()));

create policy chat_leads_admin_update
  on public.chat_leads for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
