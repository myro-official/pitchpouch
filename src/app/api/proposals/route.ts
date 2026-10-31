import { analyzeProposal } from "@/lib/analyze";
import { ensureDemo } from "@/lib/demo";
import { extractWithRules, patchTerms } from "@/lib/extract";
import { dateLabel, emptyMeta } from "@/lib/meta";
import { addProposal, getCreator, listProposals, normalizeHandle, saveCreator } from "@/lib/store";
import type { BrandForm, Creator, Proposal, ProposalMeta } from "@/lib/types";

type Body =
  | { source: "paste"; creator: Creator; text: string }
  | { source: "link"; handle: string; form: BrandForm };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const handle = params.get("handle");
  if (!handle) return Response.json({ proposals: [] });
  if (params.get("demo") === "1") {
    ensureDemo(getCreator(handle) ?? { handle, name: handle, followers: 12000, avgViews: 8000, category: "뷰티" });
  }
  return Response.json({ proposals: listProposals(handle) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Body;

  let creator: Creator | null;
  let text: string;
  let brandName = "";
  let contact = "";
  let meta: ProposalMeta = emptyMeta();

  if (body.source === "paste") {
    creator = saveCreator(body.creator);
    text = body.text?.trim() ?? "";
    if (text.length < 10) return Response.json({ error: "제안 내용을 조금 더 붙여넣어 주세요." }, { status: 400 });
    const x = extractWithRules(text);
    meta = { category: x.category, uploadDate: x.uploadDate, uploadTime: null, minUse: x.minUse, exclusivity: x.exclusivity };
    brandName = x.brandName ?? "";
  } else {
    creator = getCreator(body.handle);
    if (!creator) return Response.json({ error: "없는 링크예요." }, { status: 404 });
    const f = body.form;
    if (!f.brandName?.trim() || !f.product?.trim()) {
      return Response.json({ error: "브랜드명과 제품을 입력해 주세요." }, { status: 400 });
    }
    brandName = f.brandName.trim();
    contact = f.contact?.trim() ?? "";
    text = formToText(f);
    meta = {
      category: f.category || null,
      uploadDate: f.uploadDate || null,
      uploadTime: f.uploadTime || null,
      minUse: f.minUse && f.minUse !== "없음" ? f.minUse : null,
      exclusivity: f.exclusivity?.trim() || null,
    };
  }

  const analysis = await analyzeProposal(text, creator);
  if (analysis.engine === "rules" && body.source === "paste") {
    const x = extractWithRules(text);
    patchTerms(analysis.terms, x);
    analysis.summary = `${analysis.terms.brand ?? "브랜드"}의 ${analysis.terms.product ?? "제품"} 협찬 제안${analysis.budgetWon === null ? " (원고료 미기재)" : ""}`;
  }
  const now = new Date().toISOString();
  const proposal: Proposal = {
    id: crypto.randomUUID().slice(0, 8),
    handle: normalizeHandle(creator.handle),
    source: body.source,
    brandName: brandName || analysis.terms.brand || "브랜드 미상",
    contact,
    rawText: text,
    analysis,
    meta,
    status: "new",
    counter: null,
    brandReply: null,
    createdAt: now,
    updatedAt: now,
  };
  addProposal(proposal);
  return Response.json({ proposal });
}

function formToText(f: BrandForm) {
  const d = f.deliverables;
  const items = [d.feed && `피드 ${d.feed}개`, d.reels && `릴스 ${d.reels}개`, d.story && `스토리 ${d.story}개`]
    .filter(Boolean)
    .join(", ");
  return [
    `브랜드: ${f.brandName}`,
    `제품: ${f.product}`,
    f.category ? `제품 카테고리: ${f.category}` : "",
    `요청 콘텐츠: ${items || "미정"}`,
    `원고료: ${f.budgetWon ? `${f.budgetWon}원` : "제품 제공만 (현금 원고료 없음)"}`,
    f.uploadDate ? `업로드 일정: ${dateLabel(f.uploadDate)}까지` : f.schedule ? `업로드 일정: ${f.schedule}` : "",
    f.minUse && f.minUse !== "없음" ? `업로드 전 최소 사용 기간: ${f.minUse}` : "",
    f.usageRights ? `2차 활용: ${f.usageRights}` : "",
    f.exclusivity ? `독점 조건: ${f.exclusivity}` : "",
    f.revisions ? `수정 횟수: ${f.revisions}` : "",
    f.memo ? `추가 요청: ${f.memo}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
