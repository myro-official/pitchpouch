import { connection } from "next/server";
import { listDms } from "@/lib/dms";
import { createClient } from "@/lib/supabase/server";

// shortcut: 연결된 인스타 계정이 하나라 로그인한 사람은 모두 같은 DM을 본다. 크리에이터가 여럿이 되면 계정별로 나눈다.
export async function GET() {
  await connection();
  try {
    const { data } = await (await createClient()).auth.getUser();
    if (!data.user) return Response.json({ dms: [] }, { status: 401 });
    return Response.json({ dms: await listDms() });
  } catch (e) {
    console.error(e);
    return Response.json({ dms: [] }, { status: 503 });
  }
}
