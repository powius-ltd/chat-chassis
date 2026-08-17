create table public.chat_unanswered (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  locale text not null,
  question text not null,
  handled boolean not null default false
);

alter table public.chat_unanswered enable row level security;

create policy chat_unanswered_anon_insert
  on public.chat_unanswered for insert to anon with check (true);

create policy chat_unanswered_admin_read
  on public.chat_unanswered for select to authenticated
  using ((select public.is_admin()));

create policy chat_unanswered_admin_update
  on public.chat_unanswered for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
