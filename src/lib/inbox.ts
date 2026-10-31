export type GroupId = "gain" | "rel" | "todo" | "junk";

export type Group = { id: GroupId; label: string; hint: string; tone: "new" | "ok" | "warn" | ""; desc: string };

// 화면의 보관함 탭이 그대로 나오도록 "크리에이터가 다음에 할 행동"으로 묶는다.
export const GROUPS: Group[] = [
  {
    id: "gain", label: "수익 기회", hint: "조건을 보고 답할 제안", tone: "new",
    desc: "돈이나 제품이 오가는 제안. 협찬, 유료 광고, 공동구매, 행사·섭외, 소속 영입처럼 크리에이터가 조건을 보고 수락 여부를 정하는 것",
  },
  {
    id: "rel", label: "관계", hint: "사람과 이어지는 연락", tone: "ok",
    desc: "돈이 오가지 않는 사람 간의 연락. 팬 응원·안부, 아는 사람의 사적인 연락, 커피챗 요청, 다른 크리에이터의 콜라보 제안",
  },
  {
    id: "todo", label: "처리할 일", hint: "내가 해결해 줘야 하는 것", tone: "warn",
    desc: "크리에이터가 직접 해결해 줘야 하는 일. 내 콘텐츠나 제품에 대한 문의, 내가 파는 상품의 주문·배송·환불, 내 사진·영상 사용 허락 요청",
  },
  {
    id: "junk", label: "걸러낼 것", hint: "안 봐도 되는 것", tone: "",
    desc: "답장할 가치가 없거나 해로운 것. 선입금을 요구하는 사기, 악플·성희롱, 나와 무관한 영업·스팸, 스토리에 달린 이모지 같은 짧은 반응",
  },
];

export type CategoryId =
  | "sponsor" | "paid" | "groupbuy" | "event" | "recruit"
  | "fan" | "friend" | "coffee" | "collab"
  | "inquiry" | "order" | "usage"
  | "scam" | "abuse" | "spam" | "story";

export type Category = { id: CategoryId; label: string; group: GroupId; desc: string };

// desc는 분류 모델에 그대로 선택지 설명으로 넘긴다. 서로 겹치지 않게 경계를 적는다.
export const CATEGORIES: Category[] = [
  { id: "sponsor", label: "협찬", group: "gain", desc: "제품 제공이 중심이고 원고료는 없거나 적은 제안" },
  { id: "paid", label: "유료 광고", group: "gain", desc: "광고비를 협의하는 브랜디드 콘텐츠 제안" },
  { id: "groupbuy", label: "공구", group: "gain", desc: "내 팔로워에게 판매하고 수익을 나누는 공동구매 제안" },
  { id: "event", label: "행사·섭외", group: "gain", desc: "행사 참석, 출연, 강연, 촬영 일정을 요청" },
  { id: "recruit", label: "영입", group: "gain", desc: "소속사·MCN·에이전시가 계약이나 소속을 제안" },
  { id: "fan", label: "팬", group: "rel", desc: "응원, 안부, 감상만 있고 요청이 없는 메시지" },
  { id: "friend", label: "지인", group: "rel", desc: "이미 아는 사이의 사적인 연락" },
  { id: "coffee", label: "커피챗", group: "rel", desc: "처음 연락해 만남이나 조언, 진로 상담을 청하고 수익은 없음" },
  { id: "collab", label: "콜라보", group: "rel", desc: "다른 크리에이터가 결과물을 함께 만들어 같이 올리자고 제안" },
  { id: "inquiry", label: "문의", group: "todo", desc: "내 콘텐츠나 제품, 정보에 대한 질문" },
  { id: "order", label: "주문·배송", group: "todo", desc: "내가 파는 상품의 주문, 배송, 교환, 환불 관련 연락" },
  { id: "usage", label: "콘텐츠 사용 요청", group: "todo", desc: "내 사진이나 영상을 가져다 쓰겠다는 허락 요청" },
  { id: "scam", label: "사기", group: "junk", desc: "선입금, 가짜 브랜드, 피싱 링크로 돈이나 정보를 노림" },
  { id: "abuse", label: "악성", group: "junk", desc: "악플, 성희롱, 비방, 협박" },
  { id: "spam", label: "영업·스팸", group: "junk", desc: "나와 상관없는 홍보, 팔로워 판매, 대량 발송" },
  { id: "story", label: "스토리 반응", group: "junk", desc: "내 스토리에 달린 이모지나 짧은 반응" },
];

export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<CategoryId, Category>;

// 분류와 별개로 같은 호출에서 함께 묻는 질문. 긴급을 분류에 섞으면 주제 판정이 흐려진다.
export const AXES = [
  { key: "reply", q: "답장이 필요한가", scale: "예 / 아니오" },
  { key: "urgency", q: "급한 정도", scale: "0 ~ 3 등급 (0 없음, 3 오늘 안에)" },
  { key: "terms", q: "금액이나 조건이 적혀 있나", scale: "예 / 아니오" },
] as const;

export type Classified = {
  group: GroupId;
  reply: boolean;
  urgency: 0 | 1 | 2 | 3;
  terms: boolean;
  termsNote: string;
  reason: string;
  // jev: 1차 신뢰도가 기준 이상이라 Jev 판정을 씀, ai: Claude가 분류, rules: 키워드 규칙
  source: "jev" | "ai" | "rules";
  // Jev를 거쳤다면 그 판정과 신뢰도. accepted가 false면 Claude가 다시 분류했다.
  jev?: {
    group: GroupId | "unclear";
    confidence: number;
    accepted: boolean;
    // 채택되지 않은 이유. low는 신뢰도 미만, unclear는 애매함 선택, risk는 Jev의 사기 신호 판정, veto는 위험 키워드
    why?: "ok" | "low" | "unclear" | "risk" | "veto";
  };
  // 확신한 Jev 판정을 표본으로 Claude가 다시 본 결과. 다르더라도 Jev 판정을 유지하고 불일치만 기록한다.
  audit?: { disagree: boolean; jevGroup: GroupId; claudeGroup: GroupId };
};

export type ClassifyUsage = {
  model: string;
  jev: number;
  ai: number;
  rules: number;
  threshold: number;
  jevInputTokens: number;
  jevCostUsd: number;
  profile: string;
  audit: number;
  auditDisagree: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
};

export type ClassifyResponse = { results: ({ id: string } & Classified)[]; usage: ClassifyUsage };

export type Msg = {
  id: string;
  name: string;
  handle: string;
  // 받은 지 몇 분 지났는지. 화면에서 지금 시각 기준으로 날짜를 계산한다
  minutesAgo: number;
  read: boolean;
  done: boolean;
  text: string;
  group: GroupId;
  // 시연 데이터의 정답 소분류. 화면에는 쓰지 않는다.
  category?: CategoryId;
  reply: boolean;
  urgency: 0 | 1 | 2 | 3;
  terms: boolean;
  // 금액·조건이 있으면 짧게 뽑아 둔 값
  termsNote?: string;
  reason: string;
  pasted?: boolean;
  // 인스타 DM을 보낸 사람(IGSID). 답장을 보낼 때 받는 사람이 된다
  senderId?: string;
  source?: Classified["source"];
  jev?: Classified["jev"];
  audit?: Classified["audit"];
};
