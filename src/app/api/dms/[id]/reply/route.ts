import { getDm } from "@/lib/dms";
import { createClient } from "@/lib/supabase/server";

const DAY_MS = 24 * 60 * 60 * 1000;

// 보관함에서 인스타 DM에 바로 답장한다. 받는 사람은 웹훅이 저장한 보낸 사람(IGSID)이다.
export async function POST(request: Request, ctx: RouteContext<"/api/dms/[id]/reply">) {
  const { data } = await (await createClient()).auth.getUser();
  if (!data.user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 });

  const { id } = await ctx.params;
  const { text } = (await request.json().catch(() => ({}))) as { text?: unknown };
  const body = typeof text === "string" ? text.trim() : "";
  if (!body || body.length > 1000) return Response.json({ error: "보낼 내용을 1000자 안으로 적어 주세요." }, { status: 400 });

  const dm = await getDm(id);
  if (!dm?.senderId) return Response.json({ error: "인스타 DM으로 받은 메시지가 아니에요." }, { status: 404 });
  // Meta 규칙: 상대의 마지막 메시지 뒤 24시간 안에만 API로 답장할 수 있다.
  if (Date.now() - new Date(dm.createdAt).getTime() > DAY_MS) {
    return Response.json({ error: "24시간이 지나서 인스타에서 직접 보내야 해요." }, { status: 409 });
  }

  const res = await fetch(`https://graph.facebook.com/v24.0/${process.env.IG_USER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.IG_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: dm.senderId }, message: { text: body } }),
  });
  if (!res.ok) {
    console.error("[ig] 발송 실패", res.status, await res.text());
    return Response.json({ error: "인스타로 보내지 못했어요. 잠시 뒤에 다시 시도해 주세요." }, { status: 502 });
  }
  return Response.json({ ok: true });
}
