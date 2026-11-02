-- Run this in the SQL Editor for the SAME Supabase project used by the app.
-- This is read-only: it does not change any data.
select
  u.email,
  p.id,
  p.display_name,
  p.role,
  p.active
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) in (lower('sudalaigpt@gmail.com'), lower('sudalaigpt2009@gmail.com'))
order by u.email;
