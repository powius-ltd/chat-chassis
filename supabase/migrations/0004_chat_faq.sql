-- Deliberately no seed rows — unlike the source project's version of this
-- migration, which shipped 8 rows of one business's real FAQ content. Each
-- project enters its own FAQ through the admin panel after deploy.
create table public.chat_faq (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  question text not null,
  answer text not null,
  sort_order int not null default 0,
  active boolean not null default true
);

alter table public.chat_faq enable row level security;

-- Visible to anyone, but only active rows — `engine/chat/handler.ts` reads
-- this with the anon client to build the system prompt's FAQ section.
create policy chat_faq_anon_read
  on public.chat_faq for select to anon
  using (active = true);

create policy chat_faq_admin_all
  on public.chat_faq for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
