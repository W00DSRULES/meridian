-- Campaign membership. Run this in the Supabase SQL editor after supabase/schema.sql.
-- The app server uses the service role. The browser never sees that key.
-- A signed-in person who opens /c/<campaign id> joins that campaign.
-- Only members can open or edit it. The creator is stored as owner.

create table if not exists public.members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at bigint not null,
  primary key (campaign_id, user_id)
);

create index if not exists members_user on public.members (user_id, created_at);

alter table public.members enable row level security;
