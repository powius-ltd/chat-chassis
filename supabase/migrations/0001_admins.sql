-- Allowlist of admin users, and the is_admin() every later policy in this
-- chassis gates on. If a project already defines this table (another chassis,
-- an existing admin system), skip this migration instead of redefining it.
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- No policies at all: nobody can read/write this table via the API, not
-- even authenticated users. Managed exclusively via the SQL editor /
-- migrations (service_role, which bypasses RLS).

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to authenticated;
