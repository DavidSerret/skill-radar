-- Run once in Supabase: SQL Editor > New query > paste > Run
create table if not exists public.responses (
  name_key   text primary key,
  name       text not null,
  color      text not null,
  answers    jsonb not null,
  scores     jsonb not null,
  area       text,
  hours_sat  int,
  hours_sun  int,
  updated_at timestamptz not null default now()
);

alter table public.responses enable row level security;

create policy "public read"   on public.responses for select to anon using (true);
create policy "public insert" on public.responses for insert to anon with check (true);
create policy "public update" on public.responses for update to anon using (true) with check (true);
