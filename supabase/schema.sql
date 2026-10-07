-- Meridian campaigns. Run this in the Supabase SQL editor.
-- The app and CLI use the service role on the server. The browser never sees that key.
-- Row level security is on and there are no anon policies, so the public API key cannot read these tables.

create table if not exists public.campaigns (
  id uuid primary key,
  name text not null,
  revision integer not null default 1,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists public.eras (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  position integer not null
);

create table if not exists public.techs (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  era_id uuid references public.eras (id),
  title text not null,
  description text not null default '',
  detail text not null default '',
  glyph text not null default 'compass',
  proficiency text not null,
  commitment text not null,
  author text not null,
  x double precision not null default 0,
  y double precision not null default 0,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists public.milestones (
  id uuid primary key,
  tech_id uuid not null references public.techs (id) on delete cascade,
  name text not null,
  done boolean not null default false,
  position integer not null
);

create table if not exists public.links (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  source uuid not null references public.techs (id) on delete cascade,
  target uuid not null references public.techs (id) on delete cascade,
  author text not null,
  created_at bigint not null,
  unique (source, target)
);

create index if not exists eras_campaign on public.eras (campaign_id, position);
create index if not exists techs_campaign on public.techs (campaign_id);
create index if not exists milestones_tech on public.milestones (tech_id, position);
create index if not exists links_campaign on public.links (campaign_id);

alter table public.campaigns enable row level security;
alter table public.eras enable row level security;
alter table public.techs enable row level security;
alter table public.milestones enable row level security;
alter table public.links enable row level security;

create or replace function public.bump_campaign(campaign uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_revision integer;
begin
  update public.campaigns
  set revision = revision + 1,
      updated_at = (extract(epoch from clock_timestamp()) * 1000)::bigint
  where id = campaign
  returning revision into next_revision;
  return next_revision;
end;
$$;

revoke all on function public.bump_campaign(uuid) from public;
grant execute on function public.bump_campaign(uuid) to service_role;
