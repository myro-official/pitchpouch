import { connection } from "next/server";
import { listDms } from "@/lib/dms";

// shortcut: 로그인이 없어 주소만 알면 누구나 연결된 계정의 DM을 본다. 실제 사용자를 받기 전에 로그인 뒤로 옮긴다.
export async function GET() {
  await connection();
  try {
    return Response.json({ dms: await listDms() });
  } catch (e) {
    // 저장소가 아직 없으면 화면은 데모 DM만 보여 준다.
    console.error(e);
    return Response.json({ dms: [] }, { status: 503 });
  }
}
