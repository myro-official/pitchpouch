-- PitchPouch DM 보관함. `supabase db push`로 적용한다.
-- 웹훅(/api/instagram/webhook)이 쓰고 /api/dms가 읽는다. 둘 다 서버가 service role로만 접근한다.
create table public.dms (
  id text primary key, -- 인스타 메시지 id(mid)
  data jsonb not null, -- 보낸 사람, 원문, 분류 결과 (src/lib/inbox.ts의 Msg에서 id, ago를 뺀 것)
  created_at timestamptz not null default now()
);
alter table public.dms enable row level security;
revoke all on public.dms from anon, authenticated;
grant all on public.dms to service_role;
