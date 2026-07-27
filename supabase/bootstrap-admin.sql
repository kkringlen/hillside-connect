-- 1. Sign up through the app using your email address.
-- 2. Replace the email below and run this in Supabase SQL Editor once.
update public.profiles
set role = 'admin', status = 'active', updated_at = now()
where id = (select id from auth.users where lower(email) = lower('YOUR_EMAIL@example.com'));

-- Confirm the result:
select p.id, p.full_name, p.role, p.status, u.email, u.phone
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = lower('YOUR_EMAIL@example.com');
