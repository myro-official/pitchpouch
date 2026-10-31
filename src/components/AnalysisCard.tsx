"use client";

import { useState } from "react";
import { fmtWon } from "@/lib/pricing";
import type { Analysis, Terms } from "@/lib/types";
import { IconAlert, IconChat, IconList, IconQuestion, IconWon } from "./icons";

const TERM_LABELS: [keyof Terms, string][] = [
  ["brand", "브랜드"],
  ["product", "제품"],
  ["deliverables", "콘텐츠"],
  ["budget", "원고료"],
  ["schedule", "일정"],
  ["usageRights", "2차 활용"],
  ["exclusivity", "독점"],
  ["deletionBan", "삭제 금지"],
  ["revisions", "수정"],
  ["disclosure", "광고 표기"],
];

type ReplyKey = "askMissing" | "requestChanges" | "accept";

export function AnalysisCard({ analysis, onCopy }: { analysis: Analysis; onCopy: (msg: string) => void }) {
  const a = analysis;
  const high = a.risks.filter((r) => r.level === "high").length;
  const tabs: { key: ReplyKey; label: string }[] = [
    { key: "askMissing", label: "조건 묻기" },
    { key: "requestChanges", label: "수정 요청" },
    { key: "accept", label: "수락" },
  ];
  const firstKey = tabs.find((t) => a.replies[t.key])?.key ?? "accept";
  const [reply, setReply] = useState<ReplyKey>(firstKey);
  const idx = tabs.findIndex((t) => t.key === reply);

  return (
    <div className="sheet-in">
      <section className="sec">
        <p className="caption">{a.engine === "ai" ? "AI 분석" : "기본 규칙 분석"}</p>
        <h2 className="sec-title" style={{ marginTop: 4 }}>
          {a.summary}
        </h2>
        <div className="stat-row">
          <div className={`stat ${high ? "hot" : a.risks.length ? "mid" : ""}`}>
            <small>불리한 조항</small>
            <b>{a.risks.length}</b>
          </div>
          <div className={`stat ${a.missing.length ? "mid" : ""}`}>
            <small>빠진 조건</small>
            <b>{a.missing.length}</b>
          </div>
          <div className="stat">
            <small>제시 원고료</small>
            <b style={{ fontSize: a.budgetWon ? 20 : 24 }}>{a.budgetWon ? fmtWon(a.budgetWon) : "없음"}</b>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="blk-head">
          <span className="ico danger">
            <IconAlert />
          </span>
          <h3>불리한 조항</h3>
          <span className="count">{a.risks.length}개</span>
        </div>
        {a.risks.length === 0 ? (
          <p className="caption">눈에 띄는 불리한 조항은 없어요.</p>
        ) : (
          a.risks.map((r, i) => (
            <div className="pt" key={i}>
              <b>
                <span className={`lvl ${r.level}`}>{r.level === "high" ? "주의" : "확인"}</span>
                {r.why}
              </b>
              <div>
                <span className="quote">“{r.clause}”</span>
              </div>
              <p className="ask">→ {r.ask}</p>
            </div>
          ))
        )}
      </section>

      <section className="sec">
        <div className="blk-head">
          <span className="ico warn">
            <IconQuestion />
          </span>
          <h3>빠진 조건</h3>
          <span className="count">{a.missing.length}개</span>
        </div>
        {a.missing.length === 0 ? (
          <p className="caption">필요한 조건이 다 적혀 있어요.</p>
        ) : (
          a.missing.map((m, i) => (
            <div className="pt" key={i}>
              <b>{m.item}</b>
              <p>{m.why}</p>
            </div>
          ))
        )}
      </section>

      <section className="sec">
        <div className="blk-head">
          <span className="ico">
            <IconChat />
          </span>
          <h3>답장</h3>
        </div>
        <div className="seg" style={{ ["--i" as string]: idx }}>
          <span className="thumb" />
          {tabs.map((t) => (
            <button key={t.key} className={reply === t.key ? "on" : ""} onClick={() => setReply(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="reply">{a.replies[reply] || "이 제안에는 필요 없는 답장이에요."}</div>
        {a.replies[reply] && (
          <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => onCopy(a.replies[reply])}>
            답장 복사
          </button>
        )}
      </section>

      <section className="sec">
        <div className="blk-head">
          <span className="ico">
            <IconList />
          </span>
          <h3>조건 정리</h3>
        </div>
        <dl className="terms">
          {TERM_LABELS.map(([k, label]) => (
            <Row key={k} label={label} value={a.terms[k]} />
          ))}
        </dl>
      </section>

      <section className="sec">
        <div className="blk-head">
          <span className="ico">
            <IconWon />
          </span>
          <h3>참고 단가</h3>
        </div>
        {a.price.high > 0 ? (
          <p className="price">
            {fmtWon(a.price.low)} ~ {fmtWon(a.price.high)}
          </p>
        ) : (
          <p className="caption">콘텐츠 개수를 알면 계산해 드려요.</p>
        )}
        <ul className="basis">
          {a.price.basis.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className="caption" style={{ marginTop: 8 }}>
          공개 계산식으로 낸 참고 범위예요. 협찬 체크리스트 기반 검토이며 법률 자문이 아니에요.
        </p>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={value ? "" : "none"}>{value ?? "적혀 있지 않음"}</dd>
    </>
  );
}
