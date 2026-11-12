create sequence if not exists public.personal_voice_serial_seq start 1 increment 1 no cycle;

create or replace function public.personal_voice_assign_serial()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if new.voice_serial is null then
    new.voice_serial := nextval('public.personal_voice_serial_seq');
  end if;
  return new;
end;
$function$;
revoke all on function public.personal_voice_assign_serial() from public, anon, authenticated;

create table if not exists public.personal_voice_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  voice_serial bigint not null unique,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  language text not null default 'bn-BD' check (language ~ '^[A-Za-z0-9_-]{2,16}$'),
  provider_id text not null default 'indicf5',
  status text not null default 'draft' check (status in ('draft','active','revoked')),
  consent_voice_use boolean not null default false,
  consent_sample_storage boolean not null default false,
  consent_model_training boolean not null default false,
  sample_object_key text,
  sample_mime_type text,
  sample_bytes bigint check (sample_bytes is null or sample_bytes between 1 and 5242880),
  reference_text text check (reference_text is null or char_length(reference_text) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sample_object_key is null or consent_sample_storage),
  check (status <> 'active' or sample_object_key is not null),
  unique (owner_id, id)
);
drop trigger if exists personal_voice_assign_serial on public.personal_voice_profiles;
create trigger personal_voice_assign_serial before insert on public.personal_voice_profiles
for each row execute function public.personal_voice_assign_serial();
create index if not exists personal_voice_profiles_owner_idx on public.personal_voice_profiles(owner_id, voice_serial);

create table if not exists public.personal_voice_preferences (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  default_profile_id uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_voice_catalog (
  id text primary key,
  display_name text not null,
  language text not null,
  style text not null,
  provider_id text not null,
  provider_voice_id text not null,
  preview_url text,
  license_status text not null check (license_status in ('verified','restricted','unknown')),
  consent_status text not null check (consent_status in ('documented','required','unknown')),
  enabled boolean not null default false
);

create table if not exists public.personal_voice_saved_catalog (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  voice_serial bigint not null unique,
  catalog_voice_id text not null references public.personal_voice_catalog(id) on delete restrict,
  nickname text,
  created_at timestamptz not null default now(),
  unique(owner_id, catalog_voice_id)
);
drop trigger if exists personal_voice_saved_catalog_assign_serial on public.personal_voice_saved_catalog;
create trigger personal_voice_saved_catalog_assign_serial before insert on public.personal_voice_saved_catalog
for each row execute function public.personal_voice_assign_serial();

create or replace function public.personal_voice_protect_identity()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if new.owner_id is distinct from old.owner_id then raise exception 'voice_profile_owner_immutable'; end if;
  if new.voice_serial is distinct from old.voice_serial then raise exception 'voice_serial_immutable'; end if;
  new.updated_at = now();
  return new;
end;
$function$;
drop trigger if exists personal_voice_protect_identity on public.personal_voice_profiles;
create trigger personal_voice_protect_identity before update on public.personal_voice_profiles
for each row execute function public.personal_voice_protect_identity();

alter table public.personal_voice_profiles enable row level security;
alter table public.personal_voice_preferences enable row level security;
alter table public.personal_voice_catalog enable row level security;
alter table public.personal_voice_saved_catalog enable row level security;

drop policy if exists "personal voice owner select" on public.personal_voice_profiles;
create policy "personal voice owner select" on public.personal_voice_profiles for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "personal voice owner insert" on public.personal_voice_profiles;
create policy "personal voice owner insert" on public.personal_voice_profiles for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "personal voice owner update" on public.personal_voice_profiles;
create policy "personal voice owner update" on public.personal_voice_profiles for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "personal voice owner delete" on public.personal_voice_profiles;
create policy "personal voice owner delete" on public.personal_voice_profiles for delete to authenticated using (owner_id = (select auth.uid()));

drop policy if exists "personal voice preference owner select" on public.personal_voice_preferences;
create policy "personal voice preference owner select" on public.personal_voice_preferences for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "personal voice preference owner insert" on public.personal_voice_preferences;
create policy "personal voice preference owner insert" on public.personal_voice_preferences for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "personal voice preference owner update" on public.personal_voice_preferences;
create policy "personal voice preference owner update" on public.personal_voice_preferences for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "personal voice catalog authenticated read" on public.personal_voice_catalog;
create policy "personal voice catalog authenticated read" on public.personal_voice_catalog for select to authenticated using (enabled = true);
drop policy if exists "personal voice saved catalog owner select" on public.personal_voice_saved_catalog;
create policy "personal voice saved catalog owner select" on public.personal_voice_saved_catalog for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "personal voice saved catalog owner insert" on public.personal_voice_saved_catalog;
create policy "personal voice saved catalog owner insert" on public.personal_voice_saved_catalog for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "personal voice saved catalog owner delete" on public.personal_voice_saved_catalog;
create policy "personal voice saved catalog owner delete" on public.personal_voice_saved_catalog for delete to authenticated using (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.personal_voice_profiles to authenticated;
grant select, insert, update on public.personal_voice_preferences to authenticated;
grant select on public.personal_voice_catalog to authenticated;
grant select, insert, delete on public.personal_voice_saved_catalog to authenticated;

insert into public.personal_voice_catalog
(id,display_name,language,style,provider_id,provider_voice_id,license_status,consent_status,enabled)
values
('edge-bn-pradeep','Pradeep Neural · বাংলা পুরুষ','bn-BD','standard','edge','bn-BD-PradeepNeural','unknown','required',true),
('edge-bn-nabanita','Nabanita Neural · বাংলা নারী','bn-BD','standard','edge','bn-BD-NabanitaNeural','unknown','required',true),
('azure-bn-pradeep','Pradeep Neural · বাংলা পুরুষ','bn-BD','standard','azure','bn-BD-PradeepNeural','unknown','required',true),
('azure-bn-nabanita','Nabanita Neural · বাংলা নারী','bn-BD','standard','azure','bn-BD-NabanitaNeural','unknown','required',true)
on conflict (id) do update set display_name=excluded.display_name, provider_id=excluded.provider_id,
  provider_voice_id=excluded.provider_voice_id, license_status=excluded.license_status,
  consent_status=excluded.consent_status, enabled=excluded.enabled;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('personal-voice-samples','personal-voice-samples',false,6291456,array['application/octet-stream'])
on conflict (id) do update set public=false,file_size_limit=6291456,allowed_mime_types=array['application/octet-stream'];

drop policy if exists "personal voice sample owner read" on storage.objects;
create policy "personal voice sample owner read" on storage.objects for select to authenticated
using (bucket_id='personal-voice-samples' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "personal voice sample owner insert" on storage.objects;
create policy "personal voice sample owner insert" on storage.objects for insert to authenticated
with check (bucket_id='personal-voice-samples' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "personal voice sample owner update" on storage.objects;
create policy "personal voice sample owner update" on storage.objects for update to authenticated
using (bucket_id='personal-voice-samples' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='personal-voice-samples' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "personal voice sample owner delete" on storage.objects;
create policy "personal voice sample owner delete" on storage.objects for delete to authenticated
using (bucket_id='personal-voice-samples' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- One sequence is shared by cloned profiles and saved catalog voices. Deletion never recycles serials.

create table if not exists public.personal_voice_synthesis_usage (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count between 0 and 10)
);
alter table public.personal_voice_synthesis_usage enable row level security;

create or replace function public.personal_voice_consume_synthesis_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare allowed boolean;
begin
  if auth.uid() is null then return false; end if;
  insert into public.personal_voice_synthesis_usage as usage
    (owner_id, window_started_at, request_count)
  values (auth.uid(), now(), 1)
  on conflict (owner_id) do update set
    window_started_at = case
      when usage.window_started_at <= now() - interval '1 minute' then now()
      else usage.window_started_at
    end,
    request_count = case
      when usage.window_started_at <= now() - interval '1 minute' then 1
      else usage.request_count + 1
    end
  where usage.window_started_at <= now() - interval '1 minute'
     or usage.request_count < 10
  returning true into allowed;
  return coalesce(allowed, false);
end;
$function$;
revoke all on function public.personal_voice_consume_synthesis_quota() from public, anon;
grant execute on function public.personal_voice_consume_synthesis_quota() to authenticated;
