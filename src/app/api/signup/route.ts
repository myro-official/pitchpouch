import { createAdminClient } from "@/lib/supabase/admin";

// Supabase 기본 메일은 팀원 주소에만 가서 인증 메일 가입이 안 된다. 프로젝트의 "이메일 인증" 설정은
// 상황판 사이트도 같이 써서 건드리지 않고, 서버가 인증된 상태로 계정을 만든다. 실제 DM 권한(dm_viewer)은 주지 않는다.
// shortcut: 가입 횟수 제한이 없다. 공개 서비스로 열기 전에 rate limit이나 캡차를 붙인다.
export async function POST(request: Request) {
  const { email, password } = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  const mail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const pw = typeof password === "string" ? password : "";
  if (mail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    return Response.json({ error: "이메일 주소를 확인해 주세요." }, { status: 400 });
  }
  if (pw.length < 8 || pw.length > 72) return Response.json({ error: "비밀번호는 8자 이상으로 정해 주세요." }, { status: 400 });

  const { error } = await createAdminClient().auth.admin.createUser({ email: mail, password: pw, email_confirm: true });
  if (error?.code === "email_exists") return Response.json({ error: "이미 가입된 이메일이에요. 로그인해 주세요." }, { status: 409 });
  if (error) {
    console.error("[signup]", error.code, error.message);
    return Response.json({ error: "가입하지 못했어요. 잠시 뒤에 다시 시도해 주세요." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
