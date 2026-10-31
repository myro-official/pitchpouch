import type { Creator, Deliverables, PriceRange } from "./types";

// 참고용 공개 계산식. 팀이 근거 자료를 모으면 단가 계수만 조정한다.
const WON_PER_FOLLOWER_FEED = 5;
const WON_PER_VIEW_REELS = 20;
const WON_PER_FOLLOWER_STORY = 1.5;
const USAGE_RIGHTS_MARKUP = 0.3;

export function estimatePrice(
  creator: Pick<Creator, "followers" | "avgViews">,
  d: Deliverables,
  hasUsageRights: boolean,
): PriceRange {
  const reach = Math.max(creator.avgViews, creator.followers * 0.3);
  const feed = d.feed * creator.followers * WON_PER_FOLLOWER_FEED;
  const reels = d.reels * reach * WON_PER_VIEW_REELS;
  const story = d.story * creator.followers * WON_PER_FOLLOWER_STORY;
  let mid = feed + reels + story;
  if (hasUsageRights) mid *= 1 + USAGE_RIGHTS_MARKUP;

  const basis: string[] = [];
  if (d.feed) basis.push(`피드 ${d.feed}개 × 팔로워 ${fmt(creator.followers)}명 × ${WON_PER_FOLLOWER_FEED}원`);
  if (d.reels) basis.push(`릴스 ${d.reels}개 × 평균 조회 ${fmt(Math.round(reach))}회 × ${WON_PER_VIEW_REELS}원`);
  if (d.story) basis.push(`스토리 ${d.story}개 × 팔로워 ${fmt(creator.followers)}명 × ${WON_PER_FOLLOWER_STORY}원`);
  if (hasUsageRights) basis.push(`2차 활용 포함 +${USAGE_RIGHTS_MARKUP * 100}%`);
  if (!basis.length) basis.push("콘텐츠 개수가 없어 계산하지 않았어요");

  return {
    low: roundWon(mid * 0.8),
    high: roundWon(mid * 1.2),
    basis,
  };
}

function roundWon(n: number) {
  return Math.round(n / 10000) * 10000;
}

export function fmt(n: number) {
  return n.toLocaleString("ko-KR");
}

export function fmtWon(n: number) {
  if (n >= 10000) {
    const man = n / 10000;
    return `${Number.isInteger(man) ? man : man.toFixed(1)}만원`;
  }
  return `${fmt(n)}원`;
}
