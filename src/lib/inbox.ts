import dummy from "./dummy.json";

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
  source?: Classified["source"];
  jev?: Classified["jev"];
  audit?: Classified["audit"];
};

const RAW: (Omit<Msg, "group" | "read" | "done"> & { category: CategoryId })[] = [
  {
    id: "m1", name: "글로우랩 마케팅", handle: "glowlab.official", minutesAgo: 1,
    text: "안녕하세요 글로우랩입니다! 신제품 세럼 릴스 1건에 광고비 150만원 제안드리고 싶어요. 11/20 업로드, 2차 활용은 3개월 가능하면 좋겠습니다. 가능하시면 단가표 부탁드려요.",
    category: "paid", reply: true, urgency: 3, terms: true, termsNote: "150만원 · 릴스 1건 · 11/20 · 2차 활용 3개월",
    reason: "광고비를 명시하고 업로드 일정을 정해 제안했어요.",
  },
  {
    id: "m2", name: "더마시그널", handle: "dermasignal_kr", minutesAgo: 12,
    text: "안녕하세요 :) 저희 진정 앰플 제품 보내드리고 싶은데 주소 알려주실 수 있을까요? 사용해 보시고 마음에 드시면 스토리 한 번만 부탁드려요!",
    category: "sponsor", reply: true, urgency: 1, terms: false,
    reason: "제품 제공이 중심이고 원고료 언급이 없어요.",
  },
  {
    id: "m3", name: "유나", handle: "yuna.0214", minutesAgo: 25,
    text: "언니 어제 올리신 루틴 영상 보고 그대로 따라 했는데 진짜 피부결 달라졌어요ㅠㅠ 항상 잘 보고 있어요 응원해요!!",
    category: "fan", reply: false, urgency: 0, terms: false,
    reason: "응원과 감상만 있고 요청이 없어요.",
  },
  {
    id: "m4", name: "이도현", handle: "dohyun_lee", minutesAgo: 40,
    text: "안녕하세요 인스타 보고 연락드려요. 뷰티 쪽 크리에이터 준비하는 대학생인데, 30분만 커피 한 잔 사드리고 시작 과정 여쭤봐도 될까요?",
    category: "coffee", reply: true, urgency: 1, terms: false,
    reason: "처음 연락해 만남과 조언을 청하고 수익은 없어요.",
  },
  {
    id: "m5", name: "핏코 스튜디오", handle: "fitco.studio", minutesAgo: 60,
    text: "공동구매 제안드려요. 저희 선크림을 팔로워분들께 판매해 주시면 판매가의 25%를 수수료로 드립니다. 1차 물량 500개, 11월 말 오픈 예정이에요.",
    category: "groupbuy", reply: true, urgency: 2, terms: true, termsNote: "수수료 25% · 500개 · 11월 말 오픈",
    reason: "판매 수익을 나누는 공동구매이고 수수료율이 적혀 있어요.",
  },
  {
    id: "m6", name: "익명", handle: "user_82716", minutesAgo: 60,
    text: "(성적인 표현이 담긴 메시지)",
    category: "abuse", reply: false, urgency: 0, terms: false,
    reason: "성적 수치심을 주는 표현이 있어요.",
  },
  {
    id: "m7", name: "스테이 에이전시", handle: "stay.agency", minutesAgo: 120,
    text: "안녕하세요, 스테이 에이전시 매니저입니다. 팔로워 7만 이상 뷰티 크리에이터분들 대상으로 전속 계약을 안내드리고 있어요. 이번 주 중 20분 통화 가능하실까요?",
    category: "recruit", reply: true, urgency: 2, terms: false,
    reason: "에이전시가 소속 계약을 제안했어요.",
  },
  {
    id: "m8", name: "민서", handle: "minseo_pic", minutesAgo: 120,
    text: "오랜만이야! 다음 주 토요일에 시간 돼? 성수에서 밥 한번 먹자~",
    category: "friend", reply: true, urgency: 1, terms: false,
    reason: "아는 사이의 사적인 약속 연락이에요.",
  },
  {
    id: "m9", name: "서울뷰티위크", handle: "seoulbeautyweek", minutesAgo: 180,
    text: "11/29 성수 팝업 현장 토크 세션에 패널로 모시고 싶습니다. 출연료 50만원, 교통비 별도 지원이에요. 11/10까지 회신 부탁드립니다.",
    category: "event", reply: true, urgency: 3, terms: true, termsNote: "출연료 50만원 · 11/29 · 회신 11/10",
    reason: "행사 출연 일정과 출연료가 적혀 있어요.",
  },
  {
    id: "m10", name: "클리어스킨_공식", handle: "clearskin.promo", minutesAgo: 180,
    text: "[당첨 안내] 선착순 협찬 이벤트 당첨! 배송비 4,900원만 아래 링크에서 먼저 결제해 주시면 정품 풀세트를 보내드립니다. bit.ly/xxxx",
    category: "scam", reply: false, urgency: 0, terms: false,
    reason: "선입금을 요구하고 외부 링크로 유도해요.",
  },
  {
    id: "m11", name: "하리", handle: "hari.daily", minutesAgo: 240,
    text: "안녕하세요! 저도 스킨케어 콘텐츠 하는데 같이 '나의 3단계 루틴 vs 너의 루틴' 릴스 만들어 보면 어떨까요? 서로 계정에 같이 올리면 좋을 것 같아요.",
    category: "collab", reply: true, urgency: 1, terms: false,
    reason: "결과물을 함께 만들어 같이 올리자는 제안이에요.",
  },
  {
    id: "m12", name: "소라", handle: "sora_skin", minutesAgo: 300,
    text: "혹시 영상에서 쓰신 토너 이름이 뭐예요? 지성인데 써도 괜찮을까요?",
    category: "inquiry", reply: true, urgency: 1, terms: false,
    reason: "내 콘텐츠 속 제품에 대한 질문이에요.",
  },
  {
    id: "m13", name: "주문 문의", handle: "buyer_jiwon", minutesAgo: 300,
    text: "어제 공구로 주문한 세트 아직 배송 시작이 안 됐다고 떠요. 언제쯤 받을 수 있을까요?",
    category: "order", reply: true, urgency: 3, terms: false,
    reason: "내가 판 상품의 배송 지연 문의예요.",
  },
  {
    id: "m14", name: "브이로그매거진", handle: "vlog.magazine", minutesAgo: 360,
    text: "저희 매거진 웹진 기사에 크리에이터님 루틴 영상 캡처 몇 장을 사용하고 싶습니다. 출처 표기하고 쓰면 허락해 주실 수 있을까요?",
    category: "usage", reply: true, urgency: 2, terms: false,
    reason: "내 영상 캡처를 가져다 쓰겠다는 허락 요청이에요.",
  },
  {
    id: "m15", name: "팔로우업", handle: "followup_boost", minutesAgo: 420,
    text: "팔로워 1만명 3만원! 좋아요 릴스 조회수 패키지 상시 판매합니다. 문의주세요 (대량 발송)",
    category: "spam", reply: false, urgency: 0, terms: false,
    reason: "나와 상관없는 팔로워 판매 홍보예요.",
  },
  {
    id: "m16", name: "익명", handle: "gg_9981", minutesAgo: 480,
    text: "(외모를 비하하는 악성 메시지)",
    category: "abuse", reply: false, urgency: 0, terms: false,
    reason: "외모 비하와 비방이 담겨 있어요.",
  },
  {
    id: "m17", name: "지수", handle: "jisu__kim", minutesAgo: 540,
    text: "🔥🔥🔥",
    category: "story", reply: false, urgency: 0, terms: false,
    reason: "스토리에 달린 이모지 반응이에요.",
  },
];

// 손으로 쓴 17개는 오늘 받은 것으로 두고 앞 10개만 안 읽은 상태로 둔다.
const handwritten: Msg[] = RAW.map((m, i) => ({ ...m, group: CAT[m.category].group, read: i >= 10, done: false }));

// 더미 받은함: 시험에 쓴 라벨 DM 140개를 실제 분류 파이프라인에 통과시킨 결과(scripts/eval/build-dummy.mjs)
export const DEMO: Msg[] = [...handwritten, ...(dummy as unknown as Msg[])].sort((a, b) => a.minutesAgo - b.minutesAgo);
