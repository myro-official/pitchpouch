import type { Creator, Proposal } from "./types";

// 1차 프로토타입용 서버 메모리 저장소. 서버가 재시작되면 비워진다.
// 다음 단계에서 Supabase(supabase/schema.sql)로 교체한다.
type Db = { creators: Map<string, Creator>; proposals: Map<string, Proposal> };

const g = globalThis as unknown as { __pitchpouchDb?: Db };
const db: Db = (g.__pitchpouchDb ??= { creators: new Map(), proposals: new Map() });

export function normalizeHandle(h: string) {
  return h.trim().replace(/^@/, "").toLowerCase();
}

export function saveCreator(c: Creator) {
  const creator = { ...c, handle: normalizeHandle(c.handle) };
  db.creators.set(creator.handle, creator);
  return creator;
}

export function getCreator(handle: string) {
  return db.creators.get(normalizeHandle(handle)) ?? null;
}

export function addProposal(p: Proposal) {
  db.proposals.set(p.id, p);
  return p;
}

export function getProposal(id: string) {
  return db.proposals.get(id) ?? null;
}

export function updateProposal(id: string, patch: Partial<Proposal>) {
  const cur = db.proposals.get(id);
  if (!cur) return null;
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  db.proposals.set(id, next);
  return next;
}

export function listProposals(handle: string) {
  const h = normalizeHandle(handle);
  return [...db.proposals.values()]
    .filter((p) => p.handle === h)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
