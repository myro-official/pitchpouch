import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { analyzeWithRules } from "./analyze";

export const USAGE = ["없음", "3개월", "6개월", "1년", "기간 제한 없음"] as const;
export const REVISIONS = ["1회", "2회", "3회", "제한 없음"] as const;

export type FormDraft = {
  brandName: string | null;
  contact: string | null;
  product: string | null;
  deliverables: { feed: number; reels: number; story: number } | null;
  budgetMan: number | null;
  productOnly: boolean;
  schedule: string | null;
  usage: (typeof USAGE)[number] | null;
  revisions: (typeof REVISIONS)[number] | null;
  exclusivity: string | null;
  memo: string | null;
  engine: "ai" | "rules";
};

const Schema = z.object({
  brandName: z.string().nullable(),
  contact: z.string().nullable(),
  product: z.string().nullable(),
  deliverables: z.object({ feed: z.number().int(), reels: z.number().int(), story: z.number().int() }).nullable(),
  budgetMan: z.number().nullable(),
  productOnly: z.boolean(),
  schedule: z.string().nullable(),
  usage: z.enum(USAGE).nullable(),
  revisions: z.enum(REVISIONS).nullable(),
  exclusivity: z.string().nullable(),
  memo: z.string().nullable(),
});

const SYSTEM = `브랜드가 쓰는 인스타그램 협찬 제안 양식(DM, 메일, 카톡 문구)을 읽고 제안 폼 칸에 옮긴다.
- 적힌 내용만 옮기고, 없으면 null. 추측하지 않는다.
- brandName: 브랜드명. contact: 이메일이나 전화번호. product: 제품명(용량 포함 가능).
- deliverables: 피드(게시물), 릴스(영상, 숏폼), 스토리 개수. 콘텐츠 요청이 아예 없으면 null.
- budgetMan: 현금 원고료를 만원 단위 숫자로(30만원이면 30). productOnly: 현금 없이 제품만 제공이면 true.
- schedule: 업로드 일정을 짧게("11월 20일까지").
- usage: 2차 활용(광고 소재 재사용) 기간. 언급 없으면 null, 기간 없이 활용만 적혀 있으면 "기간 제한 없음".
- revisions: 수정 횟수. 무제한이면 "제한 없음".
- exclusivity: 독점이나 경쟁사 금지 조건 한 줄.
- memo: 위에 안 들어가는 요청(게시 유지 기간, 광고 표기, 해시태그, 가이드 등)을 짧게 모아서.`;

export async function extractForm(text: string): Promise<FormDraft> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const res = await new Anthropic().messages.parse({
        model: "claude-opus-5-5",
        max_tokens: 4000,
        system: SYSTEM,
        output_config: { effort: "low", format: zodOutputFormat(Schema) },
        messages: [{ role: "user", content: `<양식>\n${text}\n</양식>` }],
      });
      if (res.stop_reason !== "refusal" && res.parsed_output) return { ...res.parsed_output, engine: "ai" };
    } catch (err) {
      console.error("[extract] AI 추출 실패, 규칙 추출로 전환", err);
    }
  }
  return extractWithRules(text);
}

// "■ 브랜드명 : OO", "- 제품: OO", "1. 원고료 - 30만원" 같은 양식 줄을 읽는다.
function field(t: string, labels: string) {
  const re = new RegExp(`^[\\s\\-•·■□▶▷●○*※✔✅\\d.)\\]]*[가-힣 ]{0,4}?(?:${labels})[^:：\\-\\n]{0,8}\\s*[:：\\-]\\s*(.+)$`, "m");
  return t.match(re)?.[1]?.trim() || null;
}

export function extractWithRules(text: string): FormDraft {
  const r = analyzeWithRules(text);
  const d = r.deliverables;
  const anyContent = d.feed + d.reels + d.story > 0;

  const usageText =
    field(text, "2차\\s*활용|2차활용|활용\\s*기간|광고\\s*활용|콘텐츠\\s*활용") ??
    r.terms.usageRights ??
    text.match(/[^.,!?\n]{0,20}(광고|2차|마케팅)[^.,!?\n]{0,15}활용[^.,!?\n]{0,15}/)?.[0]?.trim() ??
    null;
  const revText = field(text, "수정") ?? r.terms.revisions;
  const budgetText = field(text, "원고료|고료|비용|예산|페이|금액|활동비");
  const productOnly =
    r.budgetWon === null && /(제품\s*(만|제공|협찬)|무상\s*제공|협찬품|원고료\s*(없|미지급)|무가)/.test(budgetText ?? text);

  const tags = field(text, "해시태그|태그");
  const memo = [r.terms.deletionBan, tags ? `해시태그 ${tags}` : r.terms.disclosure, field(text, "가이드|필수\\s*문구|유의\\s*사항")]
    .filter(Boolean)
    .join(" / ");

  return {
    brandName: clean(field(text, "브랜드|업체|회사|상호")) ?? r.terms.brand,
    contact: text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? text.match(/01[016789][-\s]?\d{3,4}[-\s]?\d{4}/)?.[0] ?? null,
    product: clean(field(text, "제품|상품|품목")) ?? clean(r.terms.product?.replace(/^(이번에|이번|저희|새로)\s*/, "") ?? null),
    deliverables: anyContent ? d : null,
    budgetMan: r.budgetWon !== null ? Math.round(r.budgetWon / 1000) / 10 : null,
    productOnly,
    schedule: clean(field(text, "업로드|게시|일정|마감|기한")) ?? r.terms.schedule,
    usage: usageText ? pickUsage(usageText) : null,
    revisions: revText ? pickRevisions(revText) : null,
    exclusivity: clean(field(text, "독점|경쟁")) ?? r.terms.exclusivity,
    memo: memo || null,
    engine: "rules",
  };
}

function clean(v: string | null) {
  return v ? v.replace(/^["'“”]|["'“”]$/g, "").trim() || null : null;
}

function pickUsage(t: string): FormDraft["usage"] {
  if (/(불가|없음|안\s*함|미사용|X\b)/.test(t)) return "없음";
  if (/(무기한|무제한|영구|제한\s*없)/.test(t)) return "기간 제한 없음";
  if (/(1\s*년|12\s*개월)/.test(t)) return "1년";
  const m = Number(t.match(/(\d+)\s*개월/)?.[1]);
  if (m) return m <= 3 ? "3개월" : m <= 6 ? "6개월" : "1년";
  return "기간 제한 없음";
}

function pickRevisions(t: string): FormDraft["revisions"] {
  if (/(무제한|제한\s*없|원하실\s*때까지)/.test(t)) return "제한 없음";
  const n = Number(t.match(/(\d+)\s*(회|번)/)?.[1]);
  if (!n) return null;
  return n <= 1 ? "1회" : n === 2 ? "2회" : n === 3 ? "3회" : "제한 없음";
}
