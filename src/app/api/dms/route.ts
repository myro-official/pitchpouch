import { connection } from "next/server";
import { canViewDms, listDms } from "@/lib/dms";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  await connection();
  try {
    const { data } = await (await createClient()).auth.getUser();
    if (!data.user) return Response.json({ dms: [] }, { status: 401 });
    return Response.json({ dms: canViewDms(data.user) ? await listDms() : [] });
  } catch (e) {
    console.error(e);
    return Response.json({ dms: [] }, { status: 503 });
  }
}
