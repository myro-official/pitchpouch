import { analyzeWithRules, finish } from "./analyze";
import { extractWithRules, patchTerms } from "./extract";
import { addProposal, getProposal, normalizeHandle } from "./store";
import type { Creator, Proposal } from "./types";

// 비교·정렬 시연용 샘플 제안 5개. id가 고정이라 여러 번 불러도 한 번만 들어간다.
const SAMPLES: { text: string; source: Proposal["source"]; hoursAgo: number }[] = [
  {
    source: "link",
    hoursAgo: 2,
    text: `■ 브랜드명 : 라온뷰티
■ 담당자 : marketing@raonbeauty.kr
■ 제품명 : 시카 진정 앰플 30ml
■ 진행 콘텐츠 : 릴스 1건 + 스토리 1건
■ 원고료 : 30만원
■ 업로드 일정 : 11월 20일까지
■ 최소 사용 기간 : 2주 사용 후 업로드
■ 2차 활용 : 광고 소재로 6개월 활용
■ 수정 : 2회까지
■ 독점 : 업로드 후 3개월간 경쟁사 스킨케어 협찬 금지`,
  },
  {
    source: "paste",
    hoursAgo: 5,
    text: `안녕하세요 크리에이터님! 미루코스메틱 마케팅팀입니다.
- 제품: 미루 딥 모이스처 수분크림 50ml
- 콘텐츠: 피드 1개
- 원고료: 제품 제공 (현금 원고료 없음)
- 업로드: 12월 5일까지
- 1주 이상 사용 후 솔직한 후기 부탁드려요
- 콘텐츠는 저희 광고에 기간 제한 없이 활용될 수 있습니다
- 업로드 후 6개월간 삭제하지 말아주세요
- 수정은 원하실 때까지 요청드릴 수 있어요
문의: miru.cosmetic@gmail.com`,
  },
  {
    source: "link",
    hoursAgo: 9,
    text: `브랜드: 블룸데이
제품: 무드 블러셔 03 피치
콘텐츠: 릴스 1개, 스토리 2개
원고료: 20만원
업로드 일정: 11월 28일
2차 활용: 3개월
수정: 1회
연락처: hello@bloomday.co.kr`,
  },
  {
    source: "paste",
    hoursAgo: 20,
    text: `루미에르 브랜드입니다. 신상 아이섀도 팔레트 '노을' 협찬 제안드려요.
피드 1개 + 릴스 1개, 원고료 45만원 드립니다.
업로드는 12월 10일까지, 4주 정도 충분히 써보시고 올려주세요.
2차 활용은 1년, 수정은 2회까지 부탁드려요.`,
  },
  {
    source: "paste",
    hoursAgo: 30,
    text: `아쿠아랩 브랜드입니다! 수분 마스크팩 10매 보내드릴게요.
릴스 1개 부탁드리고 원고료는 15만원이에요.
11월 22일까지 업로드, 1주 사용 후 올려주시면 됩니다.
광고 표기 없이 자연스럽게 부탁드려요.`,
  },
];

export function ensureDemo(creator: Creator) {
  const handle = normalizeHandle(creator.handle);
  SAMPLES.forEach((s, i) => {
    const id = `demo${i + 1}-${handle}`.slice(0, 40);
    if (getProposal(id)) return;
    const x = extractWithRules(s.text);
    const draft = analyzeWithRules(s.text);
    patchTerms(draft, x);
    draft.summary = `${draft.terms.brand}의 ${draft.terms.product ?? "제품"} 협찬 제안${draft.budgetWon === null ? " (원고료 미기재)" : ""}`;
    const at = new Date(Date.now() - s.hoursAgo * 3600_000).toISOString();
    addProposal({
      id,
      handle,
      source: s.source,
      brandName: x.brandName ?? "브랜드",
      contact: x.contact ?? "",
      rawText: s.text,
      analysis: finish(draft, creator, "rules"),
      meta: { category: x.category, uploadDate: x.uploadDate, uploadTime: null, minUse: x.minUse, exclusivity: x.exclusivity },
      status: "new",
      counter: null,
      brandReply: null,
      createdAt: at,
      updatedAt: at,
    });
  });
}
