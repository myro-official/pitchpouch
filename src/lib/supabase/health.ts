import { createClient } from "./server";

/**
 * Supabase 연결이 살아있는지 가볍게 확인한다.
 * 인증 세션 조회는 테이블이 없어도 동작하므로 health check에 적합하다.
 */
export async function checkSupabaseConnection(): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.getSession();

    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, message: "연결 정상" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    return { ok: false, message };
  }
}
