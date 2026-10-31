import { createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { type DmData, saveDm } from "@/lib/dms";
import type { Msg } from "@/lib/inbox";

type Messaging = { sender: { id: string }; message?: { mid: string; text?: string; is_echo?: boolean } };
type Payload = { entry?: { messaging?: Messaging[] }[] };
type Classified = Pick<Msg, "category" | "reply" | "urgency" | "terms" | "termsNote" | "reason">;

// Unified login(비즈니스 포트폴리오 시스템 사용자 토큰)이라 graph.instagram.com이 아니라 graph.facebook.com을 쓴다.
const IG_API = "https://graph.facebook.com/v24.0";

// Meta가 콜백 URL을 등록할 때 보내는 확인 요청
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  if (q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === process.env.IG_VERIFY_TOKEN) {
    return new Response(q.get("hub.challenge"));
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const raw = Buffer.from(await request.arrayBuffer());
  if (!validSignature(raw, request.headers.get("x-hub-signature-256"))) {
    console.warn("[ig] 웹훅 서명이 맞지 않음. IG_APP_SECRET을 확인하세요.");
    return new Response("bad signature", { status: 401 });
  }

  // is_echo는 우리 계정이 보낸 메시지라 제외한다.
  const dms = ((JSON.parse(raw.toString("utf8")) as Payload).entry ?? [])
    .flatMap((e) => e.messaging ?? [])
    .filter((m) => m.message?.text && !m.message.is_echo);

  // 분류가 길어 응답이 늦으면 Meta가 같은 이벤트를 다시 보내므로, 먼저 200을 주고 처리한다.
  after(async () => {
    for (const m of dms) await ingest(m.message!.mid, m.sender.id, m.message!.text!);
  });
  return new Response("ok");
}

function validSignature(raw: Buffer, header: string | null) {
  const secret = process.env.IG_APP_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`);
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

async function ingest(mid: string, senderId: string, text: string) {
  const [who, cls] = await Promise.all([profile(senderId), classify(text)]);
  const data: DmData = { ...who, text, ...cls };
  await saveDm(mid, data);
}

// 보낸 사람의 아이디. 이 토큰으로는 프로필 조회(/{IGSID})가 막혀서 대화 참여자 목록에서 찾는다.
// shortcut: 최근 대화 50개 안에서만 찾는다. 대화가 많아지면 다음 페이지까지 보거나 아이디를 저장해 둔다.
async function profile(igsid: string): Promise<Pick<Msg, "name" | "handle">> {
  const res = await fetch(
    `${IG_API}/${process.env.IG_USER_ID}/conversations?platform=instagram&fields=participants&limit=50&access_token=${process.env.IG_ACCESS_TOKEN}`,
  );
  if (!res.ok) {
    console.warn("[ig] 보낸 사람 조회 실패", res.status, await res.text());
    return { name: "인스타 사용자", handle: "" };
  }
  const j = (await res.json()) as { data?: { participants: { data: { id: string; username: string }[] } }[] };
  const handle = j.data?.flatMap((c) => c.participants.data).find((p) => p.id === igsid)?.username;
  return handle ? { name: handle, handle } : { name: "인스타 사용자", handle: "" };
}

// shortcut: 분류는 형이 만드는 Jev + Claude 코드로 이 함수만 바꾼다. 그 전까지는 전부 "문의"로 넣는다.
async function classify(text: string): Promise<Classified> {
  void text;
  return { category: "inquiry", reply: true, urgency: 0, terms: false, reason: "아직 분류 전이에요" };
}
