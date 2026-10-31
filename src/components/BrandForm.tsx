"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Creator, Deliverables } from "@/lib/types";
import { IconShield } from "./icons";

const USAGE = ["없음", "3개월", "6개월", "1년", "기간 제한 없음"];
const REVISIONS = ["1회", "2회", "3회", "제한 없음"];

export function BrandForm({ handle }: { handle: string }) {
  const router = useRouter();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [missing, setMissing] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [contact, setContact] = useState("");
  const [product, setProduct] = useState("");
  const [d, setD] = useState<Deliverables>({ feed: 0, reels: 1, story: 0 });
  const [budget, setBudget] = useState("");
  const [productOnly, setProductOnly] = useState(false);
  const [schedule, setSchedule] = useState("");
  const [usage, setUsage] = useState("없음");
  const [exclusivity, setExclusivity] = useState("");
  const [revisions, setRevisions] = useState("2회");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/creators/${encodeURIComponent(handle)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setCreator(j.creator))
      .catch(() => setMissing(true));
  }, [handle]);

  const budgetOk = productOnly || Number(budget) > 0;
  const ok = brandName.trim() && product.trim() && budgetOk && d.feed + d.reels + d.story > 0;

  const submit = async () => {
    setBusy(true);
    setErr("");
    const res = await fetch("/api/proposals", {
      method: "POST",
      body: JSON.stringify({
        source: "link",
        handle,
        form: {
          brandName,
          contact,
          product,
          deliverables: d,
          budgetWon: productOnly ? null : Number(budget) * 10000,
          schedule,
          usageRights: usage === "없음" ? "" : `브랜드 광고 소재로 2차 활용 (${usage})`,
          exclusivity,
          revisions: revisions === "제한 없음" ? "수정 횟수 제한 없음" : `수정 ${revisions}`,
          memo,
        },
      }),
    });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error);
    const { proposal } = await res.json();
    router.push(`/s/${proposal.id}`);
  };

  if (missing)
    return (
      <div className="app">
        <section className="sec">
          <h1 className="page-title">링크를 찾을 수 없어요</h1>
          <p className="lead">크리에이터에게 링크를 다시 받아 주세요.</p>
        </section>
      </div>
    );

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
        <p className="caption">협찬 제안서</p>
        <h1 className="page-title" style={{ marginTop: 4 }}>
          @{creator?.handle ?? handle}님에게
          <br />
          협찬을 제안해요
        </h1>
        <p className="lead">가입 없이 작성하고, 답변은 이 기기에서 바로 확인할 수 있어요.</p>
      </section>

      <section className="sec">
        <h2 className="sec-title">브랜드</h2>
        <div className="field row2">
          <div>
            <label className="label">브랜드명</label>
            <input className="input" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="OO코스메틱" />
          </div>
          <div>
            <label className="label">연락처 (선택)</label>
            <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="이메일" />
          </div>
        </div>
        <div className="field">
          <label className="label">제품</label>
          <input className="input" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="신제품 진정 세럼 50ml" />
        </div>
      </section>

      <section className="sec">
        <h2 className="sec-title">요청 콘텐츠</h2>
        <div className="field" style={{ display: "grid", gap: 8 }}>
          {(
            [
              ["feed", "피드"],
              ["reels", "릴스"],
              ["story", "스토리"],
            ] as const
          ).map(([k, label]) => (
            <div className="stepper" key={k}>
              <b>{label}</b>
              <span className="ctl">
                <button onClick={() => setD({ ...d, [k]: Math.max(0, d[k] - 1) })}>−</button>
                <span>{d[k]}</span>
                <button onClick={() => setD({ ...d, [k]: d[k] + 1 })}>+</button>
              </span>
            </div>
          ))}
        </div>
        <div className="field">
          <label className="label">업로드 희망 일정</label>
          <input className="input" value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="11월 20일까지" />
        </div>
      </section>

      <section className="sec">
        <h2 className="sec-title">원고료</h2>
        <div className="field">
          <label className="label">현금 원고료 (만원)</label>
          <input
            className="input"
            inputMode="numeric"
            disabled={productOnly}
            value={productOnly ? "" : budget}
            onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))}
            placeholder={productOnly ? "제품 제공만" : "예: 30"}
          />
        </div>
        <div className="chips" style={{ marginTop: 10 }}>
          <button className={`chip ${productOnly ? "on" : ""}`} onClick={() => setProductOnly(!productOnly)}>
            현금 없이 제품만 제공
          </button>
        </div>
      </section>

      <section className="sec">
        <h2 className="sec-title">조건</h2>
        <div className="field">
          <label className="label">2차 활용 (광고 소재로 재사용)</label>
          <div className="chips">
            {USAGE.map((u) => (
              <button key={u} className={`chip ${usage === u ? "on" : ""}`} onClick={() => setUsage(u)}>
                {u}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="label">수정 횟수</label>
          <div className="chips">
            {REVISIONS.map((r) => (
              <button key={r} className={`chip ${revisions === r ? "on" : ""}`} onClick={() => setRevisions(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="label">독점 조건 (선택)</label>
          <input className="input" value={exclusivity} onChange={(e) => setExclusivity(e.target.value)} placeholder="예: 3개월간 경쟁 브랜드 협찬 금지" />
        </div>
        <div className="field">
          <label className="label">추가 요청 (선택)</label>
          <textarea className="textarea" style={{ minHeight: 96 }} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 업로드 후 6개월간 삭제하지 말아 주세요" />
        </div>
        {err && <p className="err">{err}</p>}
      </section>

      <div className="cta" style={{ bottom: 0 }}>
        <button className="btn" disabled={!ok || busy} onClick={submit}>
          {busy ? "보내는 중" : "제안 보내기"}
        </button>
      </div>
    </div>
  );
}
