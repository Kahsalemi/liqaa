-- ============================================================
-- لقاء — مخطط قاعدة البيانات + سياسات الحماية RLS
-- انسخ هذا الملف كاملاً والصقه في Supabase → SQL Editor → Run
-- ============================================================

-- 1) جدول الجلسات (لقاء واحد لكل صف)
create table if not exists public.meetings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid(),
  title        text not null default 'لقاء بدون عنوان',
  meeting_type text,
  meeting_date date,
  hijri_date   text,
  meeting_time text,
  time_fmt     text default '24',
  place        text,
  host         text,
  quote_type   text,
  quote        text,
  notes        text,
  next_title   text,
  next_date    date,
  attendees    jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2) جدول المحاور (محور واحد لكل صف — يرتبط بجلسة)
create table if not exists public.agenda_items (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id    uuid not null default auth.uid(),
  sort       int  not null default 0,
  topic      text default '',
  mins       text default '',
  owner      text default '',
  decision   text default '',
  followup   text default '',
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists agenda_meeting_idx on public.agenda_items (meeting_id, sort);

-- 3) تفعيل الحماية على مستوى الصف RLS
alter table public.meetings     enable row level security;
alter table public.agenda_items enable row level security;

-- 4) سياسات الجلسات: كل مستخدم يرى ويعدّل صفوفه فقط
drop policy if exists meetings_select on public.meetings;
drop policy if exists meetings_insert on public.meetings;
drop policy if exists meetings_update on public.meetings;
drop policy if exists meetings_delete on public.meetings;

create policy meetings_select on public.meetings
  for select using (user_id = auth.uid());
create policy meetings_insert on public.meetings
  for insert with check (user_id = auth.uid());
create policy meetings_update on public.meetings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy meetings_delete on public.meetings
  for delete using (user_id = auth.uid());

-- 5) سياسات المحاور: نفس المبدأ
drop policy if exists agenda_select on public.agenda_items;
drop policy if exists agenda_insert on public.agenda_items;
drop policy if exists agenda_update on public.agenda_items;
drop policy if exists agenda_delete on public.agenda_items;

create policy agenda_select on public.agenda_items
  for select using (user_id = auth.uid());
create policy agenda_insert on public.agenda_items
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.user_id = auth.uid()
    )
  );
create policy agenda_update on public.agenda_items
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy agenda_delete on public.agenda_items
  for delete using (user_id = auth.uid());

-- 6) تحديث updated_at تلقائياً
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists meetings_touch on public.meetings;
create trigger meetings_touch
  before update on public.meetings
  for each row execute function public.touch_updated_at();
