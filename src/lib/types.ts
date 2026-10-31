export type Creator = {
  handle: string;
  name: string;
  followers: number;
  avgViews: number;
  category: string;
};

export type Deliverables = { feed: number; reels: number; story: number };

export type Terms = {
  brand: string | null;
  product: string | null;
  deliverables: string | null;
  schedule: string | null;
  budget: string | null;
  usageRights: string | null;
  exclusivity: string | null;
  deletionBan: string | null;
  revisions: string | null;
  disclosure: string | null;
};

export type Missing = { item: string; why: string };

export type Risk = {
  clause: string;
  level: "high" | "medium";
  why: string;
  ask: string;
};

export type PriceRange = {
  low: number;
  high: number;
  basis: string[];
};

export type Analysis = {
  summary: string;
  terms: Terms;
  deliverables: Deliverables;
  budgetWon: number | null;
  missing: Missing[];
  risks: Risk[];
  replies: { askMissing: string; requestChanges: string; accept: string };
  price: PriceRange;
  engine: "ai" | "rules";
};

export type ProposalStatus =
  | "new"
  | "countered"
  | "accepted"
  | "rejected"
  | "brand_accepted"
  | "brand_rejected"
  | "brand_revised";

export type CounterOffer = {
  items: string[];
  message: string;
  at: string;
};

export type ProposalMeta = {
  category: string | null; // "스킨케어 · 마스크팩"
  uploadDate: string | null; // "2026-11-20"
  minUse: string | null; // 업로드 전 최소 사용 기간 "2주"
  exclusivity: string | null;
};

export type Proposal = {
  id: string;
  handle: string;
  source: "link" | "paste";
  brandName: string;
  contact: string;
  rawText: string;
  analysis: Analysis | null;
  meta: ProposalMeta;
  status: ProposalStatus;
  counter: CounterOffer | null;
  brandReply: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BrandForm = {
  brandName: string;
  contact: string;
  product: string;
  deliverables: Deliverables;
  budgetWon: number | null;
  schedule: string;
  category: string;
  uploadDate: string;
  minUse: string;
  usageRights: string;
  exclusivity: string;
  revisions: string;
  memo: string;
};
