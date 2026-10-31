"use client";

import { useCallback, useEffect, useState } from "react";
import type { Creator, Proposal } from "@/lib/types";
import { IconShield } from "./icons";
import { STATUS } from "./status";

export function BrandStatus({ id }: { id: string }) {
  const [p, setP] = useState<Proposal | null>(null);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [missing, setMissing] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const seenKey = `pitchpouch_brand_seen_${id}`;
  const [seen, setSeen] = useState<string | null>(() => {
    try {
      return localStorage.getItem(seenKey) ?? "new";
    } catch {
      return null;
    }
  });

  // 크리에이터 답장이 오면 탭 제목에도 표시한다.
  const fresh = Boolean(p && seen !== null && p.status !== seen && ["countered", "accepted", "rejected"].includes(p.status));
  useEffect(() => {
    document.title = fresh ? "(1) 새 답장 · PitchPouch" : "PitchPouch";
  }, [fresh]);
  const markSeen = () => {
    if (!p) return;
    setSeen(p.status);
    try {
      localStorage.setItem(seenKey, p.status);
    } catch {}
  };

  const load = useCallback(async () => {
    const res = await fetch(`/api/proposals/${id}`, { cache: "no-store" });
    if (!res.ok) return setMissing(true);
    const j = await res.json();
    setP(j.proposal);
    setCreator(j.creator);
  }, [id]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 4000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  const act = async (action: string) => {
    setBusy(true);
    await fetch(`/api/proposals/${id}`, { method: "PATCH", body: JSON.stringify({ action, reply }) });
    await load();
    setBusy(false);
  };

  if (missing)
    return (
      <div className="app">
        <section className="sec">
          <h1 className="page-title">제안을 찾을 수 없어요</h1>
        </section>
      </div>
    );
  if (!p) return <div className="app" />;

  const s = STATUS[p.status];
  const handle = creator?.handle ?? p.handle;
  const title =
    p.status === "new"
      ? "제안을 보냈어요"
      : p.status === "countered"
        ? "수정 요청이 왔어요"
        : p.status === "accepted" || p.status === "brand_accepted"
          ? "협찬이 확정됐어요"
          : p.status === "brand_revised"
            ? "다시 제안했어요"
            : "진행하지 않기로 했어요";

  return (
    <div className="app" style={{ paddingBottom: 24 }}>
      <header className="top">
        <span className="brand">
          <span className="brand-mark" style={{ color: "var(--on-brand)" }}>
            <IconShield />
          </span>
          PitchPouch
        </span>
      </header>
      <section className="sec">
        {fresh && (
          <button className="note fresh sheet-in" onClick={markSeen}>
            <b>@{handle}님이 답장했어요</b>
            <span>확인했어요</span>
          </button>
        )}
        <span className={`badge ${s.tone}`}>{s.label}</span>
        <h1 className="page-title" style={{ marginTop: 10 }}>
          {title}
        </h1>
        <p className="lead">
          @{handle}님에게 보낸 {p.brandName} 제안이에요.
          {p.status === "new" && " 크리에이터가 확인하면 이 화면에 바로 표시돼요."}
        </p>
      </section>

      {p.status === "countered" && p.counter && (
        <>
          <section className="sec sheet-in">
            <h2 className="sec-title">크리에이터 요청</h2>
            <div style={{ marginTop: 8 }}>
              {p.counter.items.map((it) => (
                <div className="pt" key={it}>
                  <b>{it}</b>
                </div>
              ))}
            </div>
            <div className="field">
              <label className="label">답변 (선택)</label>
              <textarea className="textarea" style={{ minHeight: 96 }} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="예: 2차 활용은 3개월로 조정할게요." />
            </div>
          </section>
          <div className="cta" style={{ bottom: 0, flexWrap: "wrap" }}>
            <button className="btn ghost" disabled={busy} onClick={() => act("brand_reject")}>
              거절
            </button>
            <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={() => act("brand_accept")}>
              요청대로 수락
            </button>
            <button className="btn ghost" style={{ flex: "1 0 100%" }} disabled={busy || !reply.trim()} onClick={() => act("brand_revise")}>
              조건 바꿔서 다시 제안
            </button>
          </div>
        </>
      )}

      <section className="sec">
        <h2 className="sec-title">보낸 제안</h2>
        <div className="reply">{p.rawText}</div>
      </section>
    </div>
  );
}
