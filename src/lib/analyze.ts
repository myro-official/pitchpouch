import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { estimatePrice } from "./pricing";
import type { Analysis, Creator, Deliverables, Missing, Risk, Terms } from "./types";

const nullableText = z.string().nullable();

const AnalysisSchema = z.object({
  summary: z.string(),
  terms: z.object({
    brand: nullableText,
    product: nullableText,
    deliverables: nullableText,
    schedule: nullableText,
    budget: nullableText,
    usageRights: nullableText,
    exclusivity: nullableText,
    deletionBan: nullableText,
    revisions: nullableText,
    disclosure: nullableText,
  }),
  deliverables: z.object({ feed: z.number().int(), reels: z.number().int(), story: z.number().int() }),
  budgetWon: z.number().int().nullable(),
  missing: z.array(z.object({ item: z.string(), why: z.string() })),
  risks: z.array(
    z.object({
      clause: z.string(),
      level: z.enum(["high", "medium"]),
      why: z.string(),
      ask: z.string(),
    }),
  ),
  replies: z.object({ askMissing: z.string(), requestChanges: z.string(), accept: z.string() }),
});

const SYSTEM = `너는 인스타그램 뷰티 마이크로 크리에이터(팔로워 5천~3만)를 돕는 협찬 제안 검토 도우미다.
브랜드가 보낸 협찬 제안(DM, 메일, 카톡, 계약서 문장, 또는 폼 내용)을 읽고 크리에이터가 답하기 전에 확인할 것을 정리한다.

규칙
- 법률 자문이 아니다. "확인해 보세요", "요청해 보세요" 수준으로 말한다. 단정하거나 겁주지 않는다.
- terms: 제안에 실제로 적힌 내용만 짧게 옮긴다. 없으면 null.
- deliverables: 요구 콘텐츠 개수. 피드(게시물), 릴스(영상), 스토리로 나눠 센다. 개수가 없고 "게시물 부탁" 정도면 feed 1.
- budgetWon: 제시된 현금 금액을 원 단위 정수로. 제품만 제공이거나 금액이 없으면 null.
- missing: 협찬 진행 전에 꼭 정해야 하는데 빠진 것. 후보는 원고료(현금), 업로드 일정, 콘텐츠 개수와 형태, 2차 활용 여부와 기간, 수정 횟수, 광고 표기 방식, 제품 반납 여부. 실제로 빠진 것만 넣고 이유는 한 문장.
- risks: 크리에이터에게 불리할 수 있는 조건. 2차 활용(기간 무제한, 광고 소재 사용, 무상), 독점·경쟁사 금지, 업로드 후 삭제 금지 기간, 수정 무제한, 과도한 일정, 광고 표기 생략 요구 등. 실제로 적힌 것만. level은 돈이나 권리를 크게 잃을 수 있으면 high. ask는 브랜드에 보낼 수정 요청 한 문장.
- replies: 크리에이터 1인칭, 정중하고 짧은 DM 말투(-요체). askMissing은 빠진 조건을 묻는 답장, requestChanges는 불리한 조건 수정을 요청하는 답장, accept는 조건을 정리해 수락하는 답장. 빠진 것이나 위험이 없으면 해당 답장은 빈 문자열.
- summary: 이 제안을 한 문장으로 요약.
- 모든 문장은 한국어.`;

let client: Anthropic | null = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  return client;
}

export async function analyzeProposal(text: string, creator: Creator): Promise<Analysis> {
  const anthropic = getClient();
  if (anthropic) {
    try {
      const res = await anthropic.messages.parse({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        system: SYSTEM,
        output_config: { effort: "low", format: zodOutputFormat(AnalysisSchema) },
        messages: [
          {
            role: "user",
            content: `크리에이터: @${creator.handle}, ${creator.category}, 팔로워 ${creator.followers}명, 평균 조회수 ${creator.avgViews}회\n\n<제안>\n${text}\n</제안>`,
          },
        ],
      });
      if (res.stop_reason !== "refusal" && res.parsed_output) {
        return finish(res.parsed_output, creator, "ai");
      }
    } catch (err) {
      console.error("[analyze] AI 분석 실패, 규칙 분석으로 전환", err);
    }
  }
  return finish(analyzeWithRules(text), creator, "rules");
}

type Draft = Omit<Analysis, "price" | "engine">;

export function finish(draft: Draft, creator: Creator, engine: Analysis["engine"]): Analysis {
  const hasUsageRights = Boolean(draft.terms.usageRights);
  return { ...draft, price: estimatePrice(creator, draft.deliverables, hasUsageRights), engine };
}

// API 키가 없거나 호출이 실패했을 때 쓰는 규칙 기반 분석. 실제 입력 문장을 읽어 판단한다.
export function analyzeWithRules(text: string): Draft {
  const t = text.replace(/[^\S\n]+/g, " ");
  const find = (re: RegExp) => t.match(re)?.[0]?.trim() ?? null;

  const deliverables: Deliverables = {
    feed: count(t, /(피드|게시물|포스팅)/),
    reels: count(t, /(릴스|reels|숏폼|영상)/i),
    story: count(t, /(스토리|story)/i),
  };
  if (!deliverables.feed && !deliverables.reels && !deliverables.story && /(업로드|올려|홍보|리뷰)/.test(t)) {
    deliverables.feed = 1;
  }

  const budgetWon = parseWon(t);
  const productOnly = /(제품만|제품 제공|무상 제공|제품을 보내|협찬품)/.test(t) && budgetWon === null;

  const terms: Terms = {
    brand: line(t, "브랜드") ?? find(/[가-힣A-Za-z0-9]+(?=\s*(코스메틱|뷰티|입니다|이에요|예요))/),
    product: line(t, "제품") ?? find(/[가-힣A-Za-z0-9 ]{0,12}(크림|세럼|토너|앰플|선크림|쿠션|립|마스크팩|클렌저|에센스|로션)/),
    deliverables: describe(deliverables),
    schedule: find(/(\d{1,2}\s*월\s*\d{1,2}\s*일|\d{1,2}\/\d{1,2}|이번\s*주|다음\s*주|\d+\s*일\s*(이내|안에|까지))[^.,!?\n]{0,10}/),
    budget: budgetWon !== null ? `${budgetWon.toLocaleString("ko-KR")}원` : productOnly ? "제품 제공만" : null,
    usageRights: find(/[^.,!?\n]{0,30}(2차\s*활용|2차활용|광고\s*소재|재가공|광고에\s*사용|활용\s*권한)[^.,!?\n]{0,30}/),
    exclusivity: find(/[^.,!?\n]{0,30}(독점|경쟁사|타\s*브랜드)[^.,!?\n]{0,30}/),
    deletionBan: find(/[^.,!?\n]{0,30}(삭제\s*금지|삭제하지|유지\s*기간|게시\s*유지)[^.,!?\n]{0,30}/),
    revisions: find(/[^.,!?\n]{0,30}(수정|피드백)[^.,!?\n]{0,30}/),
    disclosure: find(/[^.,!?\n]{0,10}(광고\s*표기|#광고|유료\s*광고|협찬\s*표기|광고\s*문구)[^.,!?\n]{0,10}/),
  };

  const missing: Missing[] = [];
  if (budgetWon === null)
    missing.push({ item: "원고료", why: productOnly ? "제품 제공만 있고 현금 원고료가 적혀 있지 않아요." : "금액이 적혀 있지 않아요." });
  if (!terms.schedule) missing.push({ item: "업로드 일정", why: "언제까지 올려야 하는지 정해지지 않았어요." });
  if (!terms.deliverables) missing.push({ item: "콘텐츠 개수와 형태", why: "피드, 릴스, 스토리 중 무엇을 몇 개인지 없어요." });
  if (!terms.usageRights) missing.push({ item: "2차 활용 여부", why: "브랜드가 콘텐츠를 광고로 다시 쓰는지 확인이 필요해요." });
  if (!terms.revisions) missing.push({ item: "수정 횟수", why: "수정 요청을 몇 번까지 받는지 정해 두면 좋아요." });
  if (!terms.disclosure) missing.push({ item: "광고 표기", why: "유료 광고 표기 방식을 미리 맞춰야 해요." });

  const risks: Risk[] = [];
  if (terms.usageRights) {
    const unlimited = /(무기한|무제한|영구|기간\s*제한\s*없)/.test(t);
    risks.push({
      clause: terms.usageRights,
      level: unlimited || budgetWon === null ? "high" : "medium",
      why: unlimited ? "기간 제한 없이 내 콘텐츠가 광고로 쓰일 수 있어요." : "내 콘텐츠가 브랜드 광고로 쓰일 수 있어요.",
      ask: "2차 활용 기간을 3개월로 정하고, 활용 비용을 따로 협의하고 싶어요.",
    });
  }
  if (terms.exclusivity)
    risks.push({ clause: terms.exclusivity, level: "medium", why: "기간 동안 다른 브랜드 협찬을 못 받을 수 있어요.", ask: "독점 기간과 제외 범위를 구체적으로 알려 주세요." });
  if (terms.deletionBan)
    risks.push({ clause: terms.deletionBan, level: "medium", why: "게시물을 내 마음대로 정리할 수 없어요.", ask: "게시 유지 기간을 1개월로 줄일 수 있을까요?" });
  if (/(무제한|횟수\s*제한\s*없|원하실\s*때까지)/.test(t) && terms.revisions)
    risks.push({ clause: terms.revisions, level: "high", why: "수정이 끝없이 이어질 수 있어요.", ask: "수정은 2회까지로 정하고 싶어요." });
  if (/(광고\s*표기\s*(없이|생략|빼)|표기하지)/.test(t))
    risks.push({ clause: terms.disclosure ?? "광고 표기 생략", level: "high", why: "광고 표기를 빼면 뒷광고 문제가 생길 수 있어요.", ask: "유료 광고 표기는 꼭 넣을게요." });

  const missingList = missing.map((m) => m.item).join(", ");
  return {
    summary: `${terms.brand ?? "브랜드"}의 ${terms.product ?? "제품"} 협찬 제안${budgetWon === null ? " (원고료 미기재)" : ""}`,
    terms,
    deliverables,
    budgetWon,
    missing,
    risks,
    replies: {
      askMissing: missing.length
        ? `안녕하세요, 제안 감사합니다! 진행 전에 ${missingList}을(를) 알려 주시면 검토 후 바로 답드릴게요.`
        : "",
      requestChanges: risks.length
        ? `제안 감사합니다. 진행하고 싶은데 몇 가지만 조정 부탁드려요. ${risks.map((r) => r.ask).join(" ")}`
        : "",
      accept: `제안 감사합니다! 말씀하신 조건(${describe(deliverables) ?? "콘텐츠"}${terms.schedule ? `, ${terms.schedule}` : ""})으로 진행할게요.`,
    },
  };
}

// 브랜드 폼에서 온 "라벨: 값" 줄을 읽는다.
function line(t: string, label: string) {
  return t.match(new RegExp(`^${label}:\\s*(.+)$`, "m"))?.[1]?.trim() ?? null;
}

function count(t: string, word: RegExp) {
  const m = t.match(new RegExp(`${word.source}\\s*(\\d+)\\s*(개|회|건|편)?|(\\d+)\\s*(개|회|건|편)?\\s*${word.source}`, word.flags));
  if (m) return Number(m[2] ?? m[4] ?? m[5] ?? 1) || 1;
  return word.test(t) ? 1 : 0;
}

function parseWon(t: string): number | null {
  const man = t.match(/(\d+(?:\.\d+)?)\s*만\s*원/);
  if (man) return Math.round(Number(man[1]) * 10000);
  const won = t.match(/(\d{1,3}(?:,\d{3})+|\d{4,})\s*원/);
  if (won) return Number(won[1].replace(/,/g, ""));
  return null;
}

function describe(d: Deliverables) {
  const parts = [d.feed && `피드 ${d.feed}개`, d.reels && `릴스 ${d.reels}개`, d.story && `스토리 ${d.story}개`].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
