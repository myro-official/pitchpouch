import { createClient } from "@supabase/supabase-js";

/**
 * service role 키를 쓰는 서버 전용 클라이언트. RLS를 건너뛰니 로그인 확인을 마친 라우트에서만 쓴다.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY가 없어요");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
