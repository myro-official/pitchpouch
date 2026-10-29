import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 서버(서버 컴포넌트, Route Handler, Server Action)에서 사용하는 Supabase 클라이언트.
 * 쿠키 기반으로 로그인 세션을 읽고 갱신한다.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트에서 set이 호출되면 무시된다.
            // 세션 갱신은 middleware가 담당하므로 안전하다.
          }
        },
      },
    },
  );
}
