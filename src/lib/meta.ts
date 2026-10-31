import type { Proposal, ProposalMeta } from "./types";

// 제품 카테고리: 대분류 > 소분류
export const CATEGORIES: Record<string, string[]> = {
  스킨케어: ["마스크팩", "바르는 제품"],
  색조: ["아이", "블러셔", "립", "베이스"],
  기타: ["바디·헤어", "기타"],
};
export const MIN_USE = ["없음", "1주", "2주", "4주"] as const;

const CATEGORY_WORDS: [string, RegExp][] = [
  ["스킨케어 · 마스크팩", /(마스크\s*팩|시트\s*팩|패드|[^가-힣]팩|^팩|워시오프)/],
  ["색조 · 아이", /(아이\s*섀도|섀도우|마스카라|아이\s*라이너|브로우|아이\s*팔레트)/],
  ["색조 · 블러셔", /(블러셔|블러쉬|치크)/],
  ["색조 · 립", /(립스틱|립\s*틴트|틴트|립\s*글로스|립밤|립)/],
  ["색조 · 베이스", /(쿠션|파운데이션|컨실러|프라이머|파우더|베이스)/],
  ["스킨케어 · 바르는 제품", /(세럼|크림|토너|앰플|에센스|로션|선크림|선\s*스틱|클렌저|클렌징|미스트|오일)/],
  ["기타 · 바디·헤어", /(바디|샴푸|트리트먼트|헤어)/],
];

export function detectCategory(text: string) {
  return CATEGORY_WORDS.find(([, re]) => re.test(text))?.[0] ?? null;
}

// "11월 20일", "11/20", "2026-11-20" → "2026-11-20". 이미 지난 날짜면 내년으로 본다.
export function parseDate(text: string | null | undefined, now = new Date()): string | null {
  if (!text) return null;
  const iso = text.match(/(20\d{2})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})/);
  if (iso) return fmt(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const md = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) ?? text.match(/(?<!\d)(\d{1,2})\/(\d{1,2})(?!\d)/);
  if (!md) return null;
  const m = Number(md[1]);
  const d = Number(md[2]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  let y = now.getFullYear();
  if (new Date(y, m - 1, d) < new Date(now.getFullYear(), now.getMonth(), now.getDate())) y++;
  return fmt(y, m, d);
}

function fmt(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function dateLabel(iso: string | null | undefined) {
  if (!iso) return "";
  const [, m, d] = iso.split("-").map(Number);
  return `${m}월 ${d}일`;
}

export function minUseDays(v: string | null | undefined) {
  const n = Number(v?.match(/(\d+)\s*주/)?.[1]);
  if (n) return n * 7;
  const days = Number(v?.match(/(\d+)\s*일/)?.[1]);
  return days || 0;
}

// 독점 문장에서 기간(개월)을 읽는다. 기간이 없으면 3개월로 본다.
function exclusiveMonths(t: string) {
  if (/(1\s*년|12\s*개월)/.test(t)) return 12;
  const m = Number(t.match(/(\d+)\s*개월/)?.[1]);
  if (m) return m;
  const w = Number(t.match(/(\d+)\s*주/)?.[1]);
  if (w) return Math.max(1, Math.round(w / 4));
  return 3;
}

const CLOSED = new Set(["rejected", "brand_rejected"]);

export function exclusivityOf(p: Proposal) {
  return p.meta?.exclusivity || p.analysis?.terms.exclusivity || null;
}

export type Conflict = { with: string; withName: string; text: string; short: string };

// 제안 A의 독점 기간 안에 같은 대분류(또는 경쟁사 전체 금지)의 제안 B 업로드가 잡히면 서로 충돌로 본다.
export function findConflicts(list: Proposal[]) {
  const out = new Map<string, Conflict[]>();
  const push = (id: string, c: Conflict) => out.set(id, [...(out.get(id) ?? []), c]);
  const live = list.filter((p) => !CLOSED.has(p.status));

  for (const a of live) {
    const ex = exclusivityOf(a);
    if (!ex) continue;
    const months = exclusiveMonths(ex);
    const start = new Date(a.meta?.uploadDate ?? a.createdAt.slice(0, 10));
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);
    const allBrands = /(타\s*브랜드|모든|전체|일체)/.test(ex) && !/(동종|같은|경쟁)/.test(ex);
    const aTop = a.meta?.category?.split(" · ")[0];

    for (const b of live) {
      if (b.id === a.id || b.brandName === a.brandName) continue;
      const bTop = b.meta?.category?.split(" · ")[0];
      if (!allBrands && aTop && bTop && aTop !== bTop) continue;
      const bDate = new Date(b.meta?.uploadDate ?? b.createdAt.slice(0, 10));
      if (bDate < start || bDate > end) continue;
      const until = `${end.getMonth() + 1}월 ${end.getDate()}일`;
      push(b.id, {
        with: a.id,
        withName: a.brandName,
        short: `${a.brandName} 독점 조건에 걸려요`,
        text: `${a.brandName} 독점 조건(${ex})에 걸려요. ${until}까지 ${aTop ?? "같은 분야"} 협찬이 막힐 수 있어요.`,
      });
      push(a.id, {
        with: b.id,
        withName: b.brandName,
        short: `${b.brandName} 제안과 독점 기간이 겹쳐요`,
        text: `${b.brandName} 제안 업로드(${dateLabel(b.meta?.uploadDate) || "일정 미정"})가 이 제안의 독점 기간(${until}까지)과 겹쳐요.`,
      });
    }
  }
  return out;
}

export function emptyMeta(): ProposalMeta {
  return { category: null, uploadDate: null, uploadTime: null, minUse: null, exclusivity: null };
}
