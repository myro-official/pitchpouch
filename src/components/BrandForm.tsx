"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { FormDraft } from "@/lib/extract";
import { CATEGORIES, dateLabel, MIN_USE } from "@/lib/meta";
import type { Creator, Deliverables } from "@/lib/types";
import { IconPaste, IconShield } from "./icons";

const USAGE = ["없음", "3개월", "6개월", "1년", "기간 제한 없음"];
const REVISIONS = ["1회", "2회", "3회", "제한 없음"];
type Part = "brand" | "content" | "budget" | "terms";

function Fold({
  title,
  summary,
  open,
  onToggle,
  done,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`sec fold ${open ? "open" : ""}`}>
      <button className="fold-head" onClick={onToggle} aria-expanded={open}>
        <span className="fold-tx">
          <span className="sec-title">{title}</span>
          {!open && <small className={done ? "" : "todo"}>{summary}</small>}
        </span>
        <svg className="fold-chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div className="fold-body">
        <div>{children}</div>
      </div>
    </section>
  );
}

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
  const [uploadDate, setUploadDate] = useState("");
  const [catTop, setCatTop] = useState("");
  const [catSub, setCatSub] = useState("");
  const [minUse, setMinUse] = useState("없음");
  const [usage, setUsage] = useState("없음");
  const [exclusivity, setExclusivity] = useState("");
  const [revisions, setRevisions] = useState("2회");
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<Part | null>("brand");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const [filling, setFilling] = useState(false);
  const [filled, setFilled] = useState("");
  const toggle = (p: Part) => setOpen(open === p ? null : p);

  useEffect(() => {
    fetch(`/api/creators/${encodeURIComponent(handle)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setCreator(j.creator))
      .catch(() => setMissing(true));
  }, [handle]);

  const budgetOk = productOnly || Number(budget) > 0;
  const ok = brandName.trim() && product.trim() && budgetOk && d.feed + d.reels + d.story > 0;

  const autofill = async () => {
    setFilling(true);
    setFilled("");
    setErr("");
    const res = await fetch("/api/extract", { method: "POST", body: JSON.stringify({ text: paste }) });
    setFilling(false);
    if (!res.ok) return setFilled((await res.json()).error);
    const f = (await res.json()).draft as FormDraft;
    let n = 0;
    const put = <T,>(v: T | null | undefined, set: (v: T) => void) => {
      if (v !== null && v !== undefined && v !== "") {
        set(v);
        n++;
      }
    };
    put(f.brandName, setBrandName);
    put(f.contact, setContact);
    put(f.product, setProduct);
    put(f.deliverables, setD);
    put(f.schedule, setSchedule);
    put(f.uploadDate, setUploadDate);
    put(f.minUse, setMinUse);
    if (f.category) {
      const [top, sub] = f.category.split(" · ");
      setCatTop(top);
      setCatSub(sub ?? "");
      n++;
    }
    put(f.usage, setUsage);
    put(f.revisions, setRevisions);
    put(f.exclusivity, setExclusivity);
    put(f.memo, setMemo);
    if (f.productOnly) {
      setProductOnly(true);
      setBudget("");
      n++;
    } else if (f.budgetMan) {
      setProductOnly(false);
      setBudget(String(f.budgetMan));
      n++;
    }
    if (!n) return setFilled("알아볼 수 있는 조건이 없어요. 아래 칸에 직접 적어 주세요.");
    setFilled(`${n}개 항목을 채웠어요. 펼쳐서 맞는지 확인해 주세요.`);
    setPasteOpen(false);
    setOpen(null);
  };

  const items = [d.feed && `피드 ${d.feed}`, d.reels && `릴스 ${d.reels}`, d.story && `스토리 ${d.story}`].filter(Boolean);
  const summaries = {
    brand: [brandName, product, catSub || catTop].filter(Boolean).join(" · ") || "브랜드명과 제품을 적어 주세요",
    content: items.length
      ? [items.join(", "), uploadDate ? `${dateLabel(uploadDate)}까지` : schedule, minUse !== "없음" && `${minUse} 사용 후`].filter(Boolean).join(" · ")
      : "콘텐츠를 1개 이상 골라 주세요",
    budget: productOnly ? "현금 없이 제품만 제공" : Number(budget) > 0 ? `${budget}만원` : "원고료를 적어 주세요",
    terms: [`2차 활용 ${usage}`, `수정 ${revisions}`, exclusivity && "독점 있음", memo && "추가 요청 있음"].filter(Boolean).join(" · "),
  };

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
          schedule: uploadDate ? `${dateLabel(uploadDate)}까지` : schedule,
          category: catTop ? [catTop, catSub].filter(Boolean).join(" · ") : "",
          uploadDate,
          minUse,
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
    <div className="app" style={{ paddingBottom: 0 }}>
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
        <div className="paste-box">
          {!pasteOpen ? (
            <button className="paste-open" onClick={() => setPasteOpen(true)}>
              <span className="ico"><IconPaste size={18} /></span>
              <span className="tx">
                <b>쓰던 제안 양식이 있나요?</b>
                <small>붙여넣으면 아래 칸을 자동으로 채워요</small>
              </span>
            </button>
          ) : (
            <>
              <label className="label">협찬 제안 문구 붙여넣기</label>
              <textarea
                className="textarea"
                style={{ minHeight: 140 }}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={"예)\n브랜드: OO코스메틱\n제품: 진정 세럼 50ml\n콘텐츠: 릴스 1건\n원고료: 30만원\n업로드: 11월 20일까지\n2차 활용: 6개월"}
                autoFocus
              />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn ghost sm" onClick={() => setPasteOpen(false)}>닫기</button>
                <button className="btn sm" style={{ flex: 1 }} disabled={paste.trim().length < 10 || filling} onClick={autofill}>
                  {filling ? "읽는 중" : "자동으로 채우기"}
                </button>
              </div>
            </>
          )}
          {filled && <p className="fill-note">{filled}</p>}
        </div>
      </section>

      <Fold title="브랜드" summary={summaries.brand} done={Boolean(brandName.trim() && product.trim())} open={open === "brand"} onToggle={() => toggle("brand")}>
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
        <div className="field">
          <label className="label">제품 카테고리</label>
          <div className="chips">
            {Object.keys(CATEGORIES).map((c) => (
              <button
                key={c}
                className={`chip ${catTop === c ? "on" : ""}`}
                onClick={() => {
                  setCatTop(catTop === c ? "" : c);
                  setCatSub("");
                }}
              >
                {c}
              </button>
            ))}
          </div>
          {catTop && (
            <div className="chips sub">
              {CATEGORIES[catTop].map((c) => (
                <button key={c} className={`chip ${catSub === c ? "on" : ""}`} onClick={() => setCatSub(catSub === c ? "" : c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </Fold>

      <Fold title="요청 콘텐츠" summary={summaries.content} done={items.length > 0} open={open === "content"} onToggle={() => toggle("content")}>
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
          <label className="label">업로드 희망 일자</label>
          <input
            className="input date"
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={uploadDate}
            onChange={(e) => setUploadDate(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
          />
          {!uploadDate && schedule && <p className="caption" style={{ marginTop: 6 }}>양식에 적힌 일정: {schedule}</p>}
        </div>
        <div className="field">
          <label className="label">업로드 전 최소 사용 기간</label>
          <div className="chips">
            {MIN_USE.map((m) => (
              <button key={m} className={`chip ${minUse === m ? "on" : ""}`} onClick={() => setMinUse(m)}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </Fold>

      <Fold title="원고료" summary={summaries.budget} done={budgetOk} open={open === "budget"} onToggle={() => toggle("budget")}>
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
      </Fold>

      <Fold title="조건" summary={summaries.terms} done open={open === "terms"} onToggle={() => toggle("terms")}>
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
      </Fold>
      {err && <p className="err" style={{ padding: "0 20px" }}>{err}</p>}

      <div className="cta" style={{ bottom: 0 }}>
        <button className="btn" disabled={!ok || busy} onClick={submit}>
          {busy ? "보내는 중" : "제안 보내기"}
        </button>
      </div>
    </div>
  );
}
