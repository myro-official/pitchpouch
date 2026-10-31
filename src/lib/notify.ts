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
  // 크리에이터가 보낸 답장 문장을 메일 본문에 그대로 싣는다. 거절은 준비된 문장이 없어 알림만 보낸다.
  const reply = p.status === "countered" ? p.counter?.message : p.status === "accepted" ? p.analysis?.replies.accept : null;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM ?? "PitchPouch <onboarding@resend.dev>",
        to,
        subject: `[PitchPouch] @${p.handle} ${subject}`,
        html: `<p>${escape(p.brandName)} 담당자님, @${escape(p.handle)}님이 협찬 제안에 답했어요.</p>${reply ? `<p style="white-space:pre-line">${escape(reply)}</p>` : ""}${items ? `<ul>${items}</ul>` : ""}<p><a href="${link}">답변 확인하기</a></p>`,
      }),
    });
    // Resend 테스트 발신자는 계정 본인 주소로만 보내져서 403이 조용히 나기 쉽다. 원인을 로그로 남긴다.
    if (!res.ok) console.error("[notify] 메일 발송 거부", res.status, await res.text());
    return res.ok ? "email" : "page";
  } catch (err) {
    console.error("[notify] 메일 발송 실패", err);
    return "page";
  }
}

function escape(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
