# Hackathon Starter

Next.js 16 (App Router) + TypeScript + Tailwind + Supabase 보일러플레이트.
주제 공개 후 핵심 기능 하나만 얹으면 바로 배포할 수 있게 만든 발사대.

## 빠른 시작

```bash
# 1. 의존성 (이미 설치돼 있음)
npm install

# 2. 환경변수 설정
cp .env.local.example .env.local
# .env.local 에 Supabase URL / anon key 를 채운다

# 3. 개발 서버
npm run dev
```

브라우저에서 열면 환경변수와 Supabase 연결 상태가 체크리스트로 보인다.

## 구조

```
src/
  app/
    page.tsx              연결 상태 대시보드 (주제 정해지면 교체)
    layout.tsx            루트 레이아웃
    globals.css           Tailwind + 디자인 토큰 자리
  lib/supabase/
    client.ts             브라우저용 클라이언트 (use client 컴포넌트)
    server.ts             서버용 클라이언트 (서버 컴포넌트/액션/라우트)
    middleware.ts         세션 갱신 로직
    health.ts             연결 상태 체크
  proxy.ts                요청마다 세션 갱신 (Next.js 16 proxy 규칙)
```

## Supabase 클라이언트 사용법

```ts
// 서버 컴포넌트 / Server Action / Route Handler
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();
const { data } = await supabase.from("your_table").select();

// 클라이언트 컴포넌트 ("use client")
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
```

## 주제 공개 후 할 일

1. `src/app/page.tsx` 를 실제 핵심 화면으로 교체
2. Supabase 대시보드에서 테이블 생성 (GRANT 포함, steering 규칙 참고)
3. GitHub push → Vercel 자동 배포
4. 배포 주소에서 핵심 시나리오 직접 확인

## 환경변수 (Vercel에도 동일하게 등록)

| 키 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개 anon 키 (브라우저 노출 OK) |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 키 (절대 클라이언트 노출 금지) |
