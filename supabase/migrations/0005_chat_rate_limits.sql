-- Self-contained, single-bucket limiter — see engine/chat/rate-limit.ts's
-- header comment for why this doesn't reuse a shared multi-bucket table.
create table public.chat_rate_limits (
  ip_hash text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);

alter table public.chat_rate_limits enable row level security;
-- No policies: only reached via the service-role client
-- (engine/supabase/admin.ts) inside the RPC below, never directly over the
-- REST API.

create or replace function public.bump_chat_rate_limit(
  p_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  insert into public.chat_rate_limits (ip_hash, window_start, count)
  values (p_hash, now(), 1)
  on conflict (ip_hash) do update
    set count = case
          when public.chat_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
            then 1
          else public.chat_rate_limits.count + 1
        end,
        window_start = case
          when public.chat_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
            then now()
          else public.chat_rate_limits.window_start
        end
  returning window_start, count into v_window_start, v_count;

  if v_count > p_limit then
    return query select
      false,
      greatest(1, p_window_seconds - extract(epoch from (now() - v_window_start))::integer);
  else
    return query select true, 0;
  end if;
end;
$$;

grant execute on function public.bump_chat_rate_limit(text, integer, integer) to service_role;
