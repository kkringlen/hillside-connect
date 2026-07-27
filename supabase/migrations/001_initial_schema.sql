-- Hillside Connect production schema
-- Run this entire file in Supabase SQL Editor on a new project.

begin;

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum ('admin', 'leader', 'member', 'guest');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_status as enum ('pending', 'active', 'deactivated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.audience_type as enum ('public', 'members', 'leaders', 'team');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.team_member_role as enum ('leader', 'member', 'read_only');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.prayer_status as enum ('pending', 'approved', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.prayer_visibility as enum ('leadership', 'members');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  role public.app_role not null default 'guest',
  status public.account_status not null default 'pending',
  directory_email text,
  directory_phone text,
  show_email boolean not null default false,
  show_phone boolean not null default false,
  notification_preferences jsonb not null default '{"announcements":true,"events":true,"team_notices":true,"discussions":true,"prayer":true,"hidden_team_ids":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.private_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email text,
  phone text,
  updated_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  team_role public.team_member_role not null default 'member',
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 160),
  body text not null check (char_length(trim(body)) between 2 and 10000),
  audience public.audience_type not null default 'members',
  team_id uuid references public.teams(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((audience = 'team' and team_id is not null) or (audience <> 'team' and team_id is null))
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 160),
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text not null default '',
  audience public.audience_type not null default 'public',
  team_id uuid references public.teams(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at),
  check ((audience = 'team' and team_id is not null) or (audience <> 'team' and team_id is null))
);

create table if not exists public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles(id) on delete set null,
  requester_name text not null default 'Anonymous',
  body text not null check (char_length(trim(body)) between 2 and 10000),
  visibility public.prayer_visibility not null default 'leadership',
  status public.prayer_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.direct_conversation_members (
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(trim(body)) between 1 and 10000),
  created_at timestamptz not null default now()
);

create table if not exists public.team_notices (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  title text not null check (char_length(trim(title)) between 2 and 160),
  body text not null check (char_length(trim(body)) between 2 and 10000),
  meeting_at timestamptz,
  location text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_discussions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  title text not null check (char_length(trim(title)) between 2 and 160),
  body text not null check (char_length(trim(body)) between 2 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_discussion_comments (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.team_discussions(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  subject_type text not null,
  subject_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_status_role on public.profiles(status, role);
create index if not exists idx_team_members_user on public.team_members(user_id);
create index if not exists idx_announcements_created on public.announcements(created_at desc);
create index if not exists idx_events_starts on public.events(starts_at);
create index if not exists idx_prayers_status_created on public.prayer_requests(status, created_at desc);
create index if not exists idx_direct_members_user on public.direct_conversation_members(user_id);
create index if not exists idx_direct_messages_conversation on public.direct_messages(conversation_id, created_at);
create index if not exists idx_team_notices_team on public.team_notices(team_id, created_at desc);
create index if not exists idx_team_discussions_team on public.team_discussions(team_id, created_at desc);
create index if not exists idx_discussion_comments_discussion on public.team_discussion_comments(discussion_id, created_at);

-- Helper functions are SECURITY DEFINER so policies do not recurse through profiles/team_members.
create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.current_status()
returns public.account_status
language sql
stable
security definer
set search_path = public
as $$ select status from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select coalesce(public.current_role() = 'admin' and public.current_status() = 'active', false) $$;

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_status() = 'active' and public.current_role() in ('admin','leader','member'), false)
$$;

create or replace function public.is_team_member(check_team uuid, check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.team_members tm where tm.team_id = check_team and tm.user_id = check_user)
$$;

create or replace function public.is_team_leader(check_team uuid, check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists(
    select 1 from public.team_members tm
    join public.profiles p on p.id = tm.user_id
    where tm.team_id = check_team and tm.user_id = check_user and tm.team_role = 'leader'
      and p.role = 'leader' and p.status = 'active'
  )
$$;

create or replace function public.share_team(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.team_members a
    join public.team_members b on b.team_id = a.team_id
    where a.user_id = user_a and b.user_id = user_b
  )
$$;

create or replace function public.leads_shared_team(viewer uuid, target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.team_members lead
    join public.team_members member on member.team_id = lead.team_id
    where lead.user_id = viewer and lead.team_role = 'leader' and member.user_id = target
  )
$$;

create or replace function public.can_view_audience(check_audience public.audience_type, check_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when check_audience = 'public' then true
    when not public.is_active_member() then false
    when check_audience = 'members' then true
    when check_audience = 'leaders' then public.current_role() in ('admin','leader')
    when check_audience = 'team' then public.is_admin() or public.is_team_member(check_team)
    else false
  end
$$;

create or replace function public.can_manage_content(check_audience public.audience_type, check_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_admin() then true
    when public.current_status() <> 'active' or public.current_role() <> 'leader' then false
    when check_audience = 'public' then false
    when check_audience = 'team' then public.is_team_leader(check_team)
    else true
  end
$$;

create or replace function public.is_conversation_member(check_conversation uuid, check_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.direct_conversation_members m
    where m.conversation_id = check_conversation and m.user_id = check_user
  )
$$;

-- Keep profile contact fields synchronized with verified Auth data.
create or replace function public.sync_directory_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare priv public.private_profiles%rowtype;
begin
  select * into priv from public.private_profiles where user_id = new.id;
  new.directory_email := case when new.show_email then priv.email else null end;
  new.directory_phone := case when new.show_phone then priv.phone else null end;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and not public.is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status then
      raise exception 'Only an administrator may change role or account status';
    end if;
    if new.directory_email is distinct from old.directory_email or new.directory_phone is distinct from old.directory_phone then
      raise exception 'Directory contact fields are derived from verified Auth data';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged on public.profiles;
create trigger profiles_protect_privileged before update on public.profiles
for each row execute function public.protect_profile_privileged_fields();

drop trigger if exists profiles_sync_directory on public.profiles;
create trigger profiles_sync_directory before insert or update of show_email, show_phone on public.profiles
for each row execute function public.sync_directory_fields();

create or replace function public.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare display_name text;
begin
  display_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, new.phone, 'Guest'), '@', 1));

  insert into public.profiles (id, full_name, role, status)
  values (new.id, display_name, 'guest', 'pending')
  on conflict (id) do update set full_name = coalesce(nullif(trim(excluded.full_name), ''), public.profiles.full_name);

  insert into public.private_profiles (user_id, email, phone, updated_at)
  values (new.id, new.email, new.phone, now())
  on conflict (user_id) do update set email = excluded.email, phone = excluded.phone, updated_at = now();

  update public.profiles p
  set directory_email = case when p.show_email then new.email else null end,
      directory_phone = case when p.show_phone then new.phone else null end,
      updated_at = now()
  where p.id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_or_changed on auth.users;
create trigger on_auth_user_created_or_changed
after insert or update of email, phone, raw_user_meta_data on auth.users
for each row execute function public.handle_auth_user_change();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- Keep modification timestamps accurate without trusting the browser.
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists announcements_touch_updated_at on public.announcements;
create trigger announcements_touch_updated_at before update on public.announcements
for each row execute function public.touch_updated_at();

drop trigger if exists events_touch_updated_at on public.events;
create trigger events_touch_updated_at before update on public.events
for each row execute function public.touch_updated_at();

drop trigger if exists prayers_touch_updated_at on public.prayer_requests;
create trigger prayers_touch_updated_at before update on public.prayer_requests
for each row execute function public.touch_updated_at();

drop trigger if exists notices_touch_updated_at on public.team_notices;
create trigger notices_touch_updated_at before update on public.team_notices
for each row execute function public.touch_updated_at();

drop trigger if exists discussions_touch_updated_at on public.team_discussions;
create trigger discussions_touch_updated_at before update on public.team_discussions
for each row execute function public.touch_updated_at();

drop trigger if exists comments_touch_updated_at on public.team_discussion_comments;
create trigger comments_touch_updated_at before update on public.team_discussion_comments
for each row execute function public.touch_updated_at();

create or replace function public.log_admin_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role or old.status is distinct from new.status then
    insert into public.activity_log(actor_id, action, subject_type, subject_id, details)
    values (auth.uid(), 'profile_access_change', 'profile', new.id::text,
      jsonb_build_object('old_role', old.role, 'new_role', new.role, 'old_status', old.status, 'new_status', new.status));
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_log_admin_change on public.profiles;
create trigger profiles_log_admin_change after update on public.profiles
for each row execute function public.log_admin_profile_change();

-- Directory function returns only information the viewer is authorized to see.
create or replace function public.get_member_directory()
returns table (
  id uuid,
  full_name text,
  role public.app_role,
  email text,
  phone text,
  team_ids uuid[]
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.role,
    case
      when public.is_admin() then priv.email
      when public.current_role() = 'leader' and public.leads_shared_team(auth.uid(), p.id) then priv.email
      else p.directory_email
    end as email,
    case
      when public.is_admin() then priv.phone
      when public.current_role() = 'leader' and public.leads_shared_team(auth.uid(), p.id) then priv.phone
      else p.directory_phone
    end as phone,
    coalesce(array_agg(tm.team_id) filter (where tm.team_id is not null), '{}'::uuid[]) as team_ids
  from public.profiles p
  left join public.private_profiles priv on priv.user_id = p.id
  left join public.team_members tm on tm.user_id = p.id
  where public.is_active_member() and p.status = 'active' and p.role <> 'guest'
  group by p.id, p.full_name, p.role, p.directory_email, p.directory_phone, priv.email, priv.phone
  order by p.full_name;
$$;

create or replace function public.get_direct_recipients()
returns table (id uuid, full_name text, role public.app_role)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.role
  from public.profiles p
  where public.is_active_member()
    and p.id <> auth.uid()
    and p.status = 'active'
    and p.role <> 'guest'
    and (public.is_admin() or p.role = 'admin' or public.share_team(auth.uid(), p.id))
  order by p.full_name;
$$;

create or replace function public.get_admin_people()
returns table (
  id uuid,
  full_name text,
  role public.app_role,
  status public.account_status,
  email text,
  phone text,
  team_ids uuid[],
  team_roles jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.role, p.status, priv.email, priv.phone,
    coalesce(array_agg(tm.team_id) filter (where tm.team_id is not null), '{}'::uuid[]) as team_ids,
    coalesce(jsonb_object_agg(tm.team_id::text, tm.team_role) filter (where tm.team_id is not null), '{}'::jsonb) as team_roles,
    p.created_at
  from public.profiles p
  left join public.private_profiles priv on priv.user_id = p.id
  left join public.team_members tm on tm.user_id = p.id
  where public.is_admin()
  group by p.id, p.full_name, p.role, p.status, priv.email, priv.phone, p.created_at
  order by p.created_at desc;
$$;

create or replace function public.start_direct_conversation(target_user uuid, initial_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare conversation uuid;
begin
  if not public.is_active_member() then raise exception 'Active membership required'; end if;
  if target_user = auth.uid() then raise exception 'Cannot message yourself'; end if;
  if not exists(select 1 from public.profiles p where p.id = target_user and p.status = 'active' and p.role <> 'guest') then
    raise exception 'Recipient is unavailable';
  end if;
  if not (public.is_admin() or exists(select 1 from public.profiles p where p.id = target_user and p.role = 'admin') or public.share_team(auth.uid(), target_user)) then
    raise exception 'You may message administrators or members of your teams';
  end if;
  if char_length(trim(initial_message)) < 1 then raise exception 'Message cannot be empty'; end if;

  insert into public.direct_conversations(created_by) values (auth.uid()) returning id into conversation;
  insert into public.direct_conversation_members(conversation_id, user_id)
  values (conversation, auth.uid()), (conversation, target_user);
  insert into public.direct_messages(conversation_id, sender_id, body)
  values (conversation, auth.uid(), trim(initial_message));
  return conversation;
end;
$$;

create or replace function public.admin_set_team_memberships(target_user uuid, memberships jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare item jsonb; tid uuid; trole public.team_member_role;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  delete from public.team_members where user_id = target_user;
  for item in select * from jsonb_array_elements(coalesce(memberships, '[]'::jsonb)) loop
    tid := (item ->> 'team_id')::uuid;
    trole := coalesce((item ->> 'team_role')::public.team_member_role, 'member');
    insert into public.team_members(team_id, user_id, team_role, approved_by)
    values (tid, target_user, trole, auth.uid());
  end loop;
  insert into public.activity_log(actor_id, action, subject_type, subject_id, details)
  values (auth.uid(), 'team_memberships_set', 'profile', target_user::text, jsonb_build_object('memberships', memberships));
end;
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.private_profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.announcements enable row level security;
alter table public.events enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.direct_conversations enable row level security;
alter table public.direct_conversation_members enable row level security;
alter table public.direct_messages enable row level security;
alter table public.team_notices enable row level security;
alter table public.team_discussions enable row level security;
alter table public.team_discussion_comments enable row level security;
alter table public.activity_log enable row level security;

-- Profiles
create policy profiles_select on public.profiles for select using (
  id = auth.uid() or public.is_admin() or (public.is_active_member() and status = 'active' and role <> 'guest')
);
create policy profiles_update_self_admin on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create policy private_profiles_select on public.private_profiles for select using (
  user_id = auth.uid() or public.is_admin() or (public.current_role() = 'leader' and public.leads_shared_team(auth.uid(), user_id))
);

-- Teams and memberships
create policy teams_select on public.teams for select using (public.is_admin() or public.is_team_member(id));
create policy teams_admin_all on public.teams for all using (public.is_admin()) with check (public.is_admin());

create policy team_members_select on public.team_members for select using (
  public.is_admin() or user_id = auth.uid() or public.is_team_member(team_id)
);
create policy team_members_admin_all on public.team_members for all using (public.is_admin()) with check (public.is_admin());

-- Announcements
create policy announcements_select on public.announcements for select using (public.can_view_audience(audience, team_id));
create policy announcements_insert on public.announcements for insert with check (author_id = auth.uid() and public.can_manage_content(audience, team_id));
create policy announcements_update on public.announcements for update using (public.is_admin() or (author_id = auth.uid() and public.can_manage_content(audience, team_id)) or (audience = 'team' and public.is_team_leader(team_id))) with check (public.can_manage_content(audience, team_id));
create policy announcements_delete on public.announcements for delete using (public.is_admin() or (author_id = auth.uid() and public.can_manage_content(audience, team_id)) or (audience = 'team' and public.is_team_leader(team_id)));

-- Events
create policy events_select on public.events for select using (public.can_view_audience(audience, team_id));
create policy events_insert on public.events for insert with check (author_id = auth.uid() and public.can_manage_content(audience, team_id));
create policy events_update on public.events for update using (public.is_admin() or (author_id = auth.uid() and public.can_manage_content(audience, team_id)) or (audience = 'team' and public.is_team_leader(team_id))) with check (public.can_manage_content(audience, team_id));
create policy events_delete on public.events for delete using (public.is_admin() or (author_id = auth.uid() and public.can_manage_content(audience, team_id)) or (audience = 'team' and public.is_team_leader(team_id)));

-- Prayer requests
create policy prayers_public_submit on public.prayer_requests for insert to anon with check (requester_id is null and visibility = 'leadership' and status = 'pending');
create policy prayers_authenticated_submit on public.prayer_requests for insert to authenticated with check (
  requester_id = auth.uid() and status = 'pending' and (visibility = 'leadership' or (visibility = 'members' and public.is_active_member()))
);
create policy prayers_select on public.prayer_requests for select using (
  public.is_admin() or (public.current_role() = 'leader' and public.current_status() = 'active') or
  (public.is_active_member() and visibility = 'members' and status = 'approved') or requester_id = auth.uid()
);
create policy prayers_manage on public.prayer_requests for update using (public.is_admin() or (public.current_role() = 'leader' and public.current_status() = 'active')) with check (public.is_admin() or (public.current_role() = 'leader' and public.current_status() = 'active'));
create policy prayers_delete on public.prayer_requests for delete using (public.is_admin() or (public.current_role() = 'leader' and public.current_status() = 'active'));

-- Direct messaging
create policy conversations_select on public.direct_conversations for select using (public.is_conversation_member(id));
create policy conversation_members_select on public.direct_conversation_members for select using (public.is_conversation_member(conversation_id));
create policy direct_messages_select on public.direct_messages for select using (public.is_conversation_member(conversation_id));
create policy direct_messages_insert on public.direct_messages for insert with check (sender_id = auth.uid() and public.is_active_member() and public.is_conversation_member(conversation_id));

-- Team notices
create policy team_notices_select on public.team_notices for select using (public.is_admin() or public.is_team_member(team_id));
create policy team_notices_insert on public.team_notices for insert with check (author_id = auth.uid() and public.is_team_leader(team_id));
create policy team_notices_update on public.team_notices for update using (public.is_admin() or public.is_team_leader(team_id)) with check (public.is_admin() or public.is_team_leader(team_id));
create policy team_notices_delete on public.team_notices for delete using (public.is_admin() or public.is_team_leader(team_id));

-- Team discussions and comments
create policy discussions_select on public.team_discussions for select using (public.is_admin() or public.is_team_member(team_id));
create policy discussions_insert on public.team_discussions for insert with check (author_id = auth.uid() and public.is_team_leader(team_id));
create policy discussions_update on public.team_discussions for update using (public.is_admin() or public.is_team_leader(team_id)) with check (public.is_admin() or public.is_team_leader(team_id));
create policy discussions_delete on public.team_discussions for delete using (public.is_admin() or public.is_team_leader(team_id));

create policy comments_select on public.team_discussion_comments for select using (
  exists(select 1 from public.team_discussions d where d.id = discussion_id and (public.is_admin() or public.is_team_member(d.team_id)))
);
create policy comments_insert on public.team_discussion_comments for insert with check (
  author_id = auth.uid() and public.is_active_member() and exists(select 1 from public.team_discussions d where d.id = discussion_id and public.is_team_member(d.team_id))
);
create policy comments_update on public.team_discussion_comments for update using (
  author_id = auth.uid() or public.is_admin() or exists(select 1 from public.team_discussions d where d.id = discussion_id and public.is_team_leader(d.team_id))
) with check (author_id = auth.uid() or public.is_admin());
create policy comments_delete on public.team_discussion_comments for delete using (
  author_id = auth.uid() or public.is_admin() or exists(select 1 from public.team_discussions d where d.id = discussion_id and public.is_team_leader(d.team_id))
);

create policy activity_log_admin_select on public.activity_log for select using (public.is_admin());

-- Grants: the browser may only use anon/authenticated roles. service_role is never exposed.
grant usage on schema public to anon, authenticated;
grant select on public.announcements, public.events to anon;
grant insert on public.prayer_requests to anon;
grant select, update on public.profiles to authenticated;
grant select on public.private_profiles to authenticated;
grant select on public.teams, public.team_members to authenticated;
grant select, insert, update, delete on public.announcements, public.events, public.prayer_requests to authenticated;
grant select on public.direct_conversations, public.direct_conversation_members to authenticated;
grant select, insert on public.direct_messages to authenticated;
grant select, insert, update, delete on public.team_notices, public.team_discussions, public.team_discussion_comments to authenticated;
grant select on public.activity_log to authenticated;
revoke execute on function public.get_member_directory() from public, anon;
revoke execute on function public.get_direct_recipients() from public, anon;
revoke execute on function public.get_admin_people() from public, anon;
revoke execute on function public.start_direct_conversation(uuid, text) from public, anon;
revoke execute on function public.admin_set_team_memberships(uuid, jsonb) from public, anon;
grant execute on function public.get_member_directory() to authenticated;
grant execute on function public.get_direct_recipients() to authenticated;
grant execute on function public.get_admin_people() to authenticated;
grant execute on function public.start_direct_conversation(uuid, text) to authenticated;
grant execute on function public.admin_set_team_memberships(uuid, jsonb) to authenticated;

-- Seed ministry teams.
insert into public.teams(slug, name, description) values
('vision', 'Vision Team', 'Church vision, planning, and leadership coordination.'),
('youth', 'Youth Team', 'Youth ministry leaders and volunteers.'),
('children', 'Children''s Ministry', 'Children''s ministry leaders and volunteers.'),
('young-adults', 'Young Adult Ministry (YAM)', 'Young adult ministry and fellowship.'),
('local-missions', 'Local Missions Team', 'Local outreach and community service.'),
('sunday-school', 'Sunday School Team', 'Sunday school teachers and coordinators.'),
('mens', 'Men''s Ministry', 'Men''s ministry planning and fellowship.'),
('womens', 'Women''s Ministry', 'Women''s ministry planning and fellowship.'),
('financial', 'Financial Team', 'Restricted finance team communication.'),
('building-grounds', 'Building & Grounds', 'Facilities, maintenance, and property needs.'),
('missions', 'Missions Team', 'Mission support, trips, and planning.'),
('worship', 'Worship Team', 'Worship leaders, musicians, and production volunteers.')
on conflict (slug) do update set name = excluded.name, description = excluded.description;

-- Enable Realtime for shared communication tables when available.
do $$
declare table_name text;
begin
  foreach table_name in array array['announcements','events','prayer_requests','direct_messages','team_notices','team_discussions','team_discussion_comments'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
exception when undefined_object then null;
end $$;

commit;
