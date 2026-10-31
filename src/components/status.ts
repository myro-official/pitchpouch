import type { ProposalStatus } from "@/lib/types";

export const STATUS: Record<ProposalStatus, { label: string; tone: "" | "new" | "warn" | "ok" | "bad" }> = {
  new: { label: "새 제안", tone: "new" },
  countered: { label: "답장 대기", tone: "warn" },
  brand_revised: { label: "재제안 도착", tone: "new" },
  accepted: { label: "수락함", tone: "ok" },
  brand_accepted: { label: "조건 합의", tone: "ok" },
  rejected: { label: "거절함", tone: "bad" },
  brand_rejected: { label: "브랜드 거절", tone: "bad" },
};
