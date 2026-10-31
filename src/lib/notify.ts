import type { Proposal } from "./types";

const SUBJECT: Partial<Record<Proposal["status"], string>> = {
  countered: "크리에이터가 수정 요청을 보냈어요",
  accepted: "크리에이터가 협찬을 수락했어요",
  rejected: "크리에이터가 이번 제안은 진행하지 않기로 했어요",
};

// 크리에이터가 답하면 브랜드 연락처(이메일)로 알린다. RESEND_API_KEY가 없으면 보내지 않고 "page"를 돌려준다.
// 브랜드는 제안을 보낸 뒤 열린 상태 화면(/s/[id])에서도 바로 알림을 본다.
export async function notifyBrand(p: Proposal, origin: string): Promise<"email" | "page"> {
  const subject = SUBJECT[p.status];
  const to = p.contact.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0];
  const key = process.env.RESEND_API_KEY;
  if (!subject || !to || !key) return "page";

  const link = `${origin}/s/${p.id}`;
  const items = p.counter?.items.map((i) => `<li>${escape(i)}</li>`).join("") ?? "";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM ?? "PitchPouch <onboarding@resend.dev>",
        to,
        subject: `[PitchPouch] @${p.handle} ${subject}`,
        html: `<p>${escape(p.brandName)} 담당자님, @${escape(p.handle)}님이 협찬 제안에 답했어요.</p>${items ? `<ul>${items}</ul>` : ""}<p><a href="${link}">답변 확인하기</a></p>`,
      }),
    });
    return res.ok ? "email" : "page";
  } catch (err) {
    console.error("[notify] 메일 발송 실패", err);
    return "page";
  }
}

function escape(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
