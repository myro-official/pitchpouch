"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { type Conflict, dateLabel, exclusivityOf, minUseDays } from "@/lib/meta";
import type { Proposal } from "@/lib/types";
import { IconBack, IconCheck, IconEmpty } from "./icons";
import { STATUS } from "./status";

export const DONE = new Set(["accepted", "rejected", "brand_accepted", "brand_rejected"]);

/* ---------- 공용 ---------- */

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

export function metaLine(p: Proposal) {
  const m = p.meta;
  return [m?.category?.split(" · ").pop(), m?.uploadDate && `${dateLabel(m.uploadDate)} 업로드`, m?.minUse && `${m.minUse} 사용`]
    .filter(Boolean)
    .join(" · ");
}

const won = (n: number) => (n >= 10000 ? `${Math.round(n / 1000) / 10}만원` : `${n.toLocaleString("ko-KR")}원`);
const checks = (p: Proposal) => (p.analysis?.missing.length ?? 0) + (p.analysis?.risks.length ?? 0);
const topCat = (p: Proposal) => p.meta?.category?.split(" · ")[0] ?? "미분류";

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

/* ---------- 받은함 ---------- */

type Sort = "recent" | "budget" | "upload" | "checks" | "use";
const SORTS: [Sort, string][] = [
  ["recent", "최신순"],
  ["budget", "원고료 높은순"],
  ["upload", "업로드 빠른순"],
  ["checks", "확인할 것 많은순"],
  ["use", "사용 기간 짧은순"],
];

const TAGS: [string, (p: Proposal, c: Map<string, Conflict[]>) => boolean][] = [
  ["스킨케어", (p) => topCat(p) === "스킨케어"],
  ["색조", (p) => topCat(p) === "색조"],
  ["현금 원고료", (p) => (p.analysis?.budgetWon ?? 0) > 0],
  ["제품만 제공", (p) => !p.analysis?.budgetWon],
  ["독점 있음", (p) => Boolean(exclusivityOf(p))],
  ["2차 활용", (p) => Boolean(p.analysis?.terms.usageRights)],
  ["겹침 주의", (p, c) => c.has(p.id)],
];

const DEFAULT_ORDER = ["스킨케어", "색조", "기타", "미분류"];
const PREF_KEY = "pitchpouch_inbox_prefs";
type Prefs = { sort: Sort; group: boolean; order: string[] };

function sorter(sort: Sort) {
  const far = "9999-12-31";
  return (a: Proposal, b: Proposal) => {
    if (sort === "budget") return (b.analysis?.budgetWon ?? 0) - (a.analysis?.budgetWon ?? 0);
    if (sort === "upload") return (a.meta?.uploadDate ?? far).localeCompare(b.meta?.uploadDate ?? far);
    if (sort === "checks") return checks(b) - checks(a);
    if (sort === "use") return (minUseDays(a.meta?.minUse) || 999) - (minUseDays(b.meta?.minUse) || 999);
    return b.createdAt.localeCompare(a.createdAt);
  };
}

export function Inbox({
  proposals,
  conflicts,
  pro,
  onOpen,
  onPaste,
  onDemo,
  onCompare,
}: {
  proposals: Proposal[];
  conflicts: Map<string, Conflict[]>;
  pro: boolean;
  onOpen: (id: string) => void;
  onPaste: () => void;
  onDemo: () => void;
  onCompare: (ids: string[]) => void;
}) {
  const [prefs, setPrefsState] = useState<Prefs>(() => load(PREF_KEY, { sort: "recent", group: false, order: DEFAULT_ORDER }));
  const setPrefs = (p: Partial<Prefs>) => {
    const next = { ...prefs, ...p };
    setPrefsState(next);
    save(PREF_KEY, next);
  };
  const [tags, setTags] = useState<string[]>([]);
  const [sheet, setSheet] = useState<"sort" | "tags" | "group" | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const todo = proposals.filter((p) => ["new", "brand_revised"].includes(p.status)).length;
  const conflictCount = proposals.filter((p) => conflicts.has(p.id)).length;

  const filtered = useMemo(
    () =>
      proposals
        .filter((p) => tags.every((t) => TAGS.find(([k]) => k === t)![1](p, conflicts)))
        .sort(sorter(prefs.sort)),
    [proposals, tags, prefs.sort, conflicts],
  );

  const groups = useMemo(() => {
    if (!pro || !prefs.group) return [{ name: "", items: filtered }];
    const order = [...prefs.order, ...DEFAULT_ORDER.filter((g) => !prefs.order.includes(g))];
    return order.map((name) => ({ name, items: filtered.filter((p) => topCat(p) === name) })).filter((g) => g.items.length);
  }, [filtered, pro, prefs.group, prefs.order]);

  const move = (i: number, d: -1 | 1) => {
    const o = [...prefs.order];
    const j = i + d;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    setPrefs({ order: o });
  };

  const toggleTag = (t: string) => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);
  const togglePick = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <>
      <section className="sec">
        <div className="title-row">
          <h1 className="page-title">받은함</h1>
          {pro && proposals.length > 1 && (
            <button className="sort-btn" onClick={() => setSheet("sort")} aria-label="정렬 바꾸기">
              {SORTS.find(([k]) => k === prefs.sort)?.[1]}
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="m7 10 5 5 5-5" />
              </svg>
            </button>
          )}
        </div>
        <p className="lead">{proposals.length ? `확인할 제안 ${todo}건` : "링크와 붙여넣기로 받은 제안이 여기 모여요."}</p>
        {pro && (tags.length > 0 || prefs.group) && (
          <div className="active-chips">
            {tags.map((t) => (
              <button key={t} className="chip tag on" onClick={() => toggleTag(t)}>
                #{t} ✕
              </button>
            ))}
            {prefs.group && (
              <button className="chip on" onClick={() => setPrefs({ group: false })}>
                카테고리 묶음 ✕
              </button>
            )}
          </div>
        )}

        {proposals.length === 0 ? (
          <div className="empty">
            <IconEmpty />
            <p>아직 받은 제안이 없어요</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
              <button className="btn sm" onClick={onPaste}>
                받은 DM 붙여넣기
              </button>
              <button className="btn ghost sm" onClick={onDemo}>
                샘플 제안 5개 넣기
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <p>이 태그에 맞는 제안이 없어요</p>
            <button className="link-btn" onClick={() => setTags([])}>
              태그 지우기
            </button>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.name || "all"}>
              {g.name && (
                <h3 className="group-title">
                  {g.name} <span>{g.items.length}</span>
                </h3>
              )}
              <div className="list">
                {g.items.map((p) => (
                  <Row
                    key={p.id}
                    p={p}
                    clash={conflicts.get(p.id)}
                    picking={picking}
                    on={picked.includes(p.id)}
                    onClick={() => (picking ? togglePick(p.id) : onOpen(p.id))}
                  />
                ))}
              </div>
            </div>
          ))
        )}
        {pro && proposals.length > 0 && proposals.length < 5 && (
          <button className="link-btn" style={{ marginTop: 12 }} onClick={onDemo}>
            비교용 샘플 제안 넣기
          </button>
        )}
      </section>
      {picking && (
        <div className="cta">
          <button className="btn" disabled={picked.length < 2} onClick={() => onCompare(picked)}>
            {picked.length < 2 ? "2개 이상 골라 주세요" : `${picked.length}개 비교하기`}
          </button>
        </div>
      )}
      {pro && proposals.length > 1 && (
        <Dial
          lifted={picking}
          items={[
            { key: "tags", label: tags.length ? `태그 ${tags.length}개` : "태그로 거르기", icon: ICON.tag, on: tags.length > 0, act: () => setSheet("tags") },
            { key: "group", label: "카테고리 묶기", icon: ICON.group, on: prefs.group, act: () => setSheet("group") },
            {
              key: "compare",
              label: picking ? "비교 취소" : "골라서 비교",
              icon: ICON.compare,
              on: picking,
              act: () => {
                setPicking(!picking);
                setPicked([]);
              },
            },
            ...(conflictCount > 0
              ? [{ key: "clash", label: `겹침 주의 ${conflictCount}건`, icon: ICON.alert, on: tags.includes("겹침 주의"), act: () => setTags(["겹침 주의"]) }]
              : []),
          ]}
        />
      )}
      <Sheet open={sheet !== null} title={sheet === "sort" ? "정렬" : sheet === "tags" ? "태그로 거르기" : "카테고리 묶기"} onClose={() => setSheet(null)}>
        {sheet === "sort" && (
          <div className="sheet-list">
            {SORTS.map(([k, label]) => (
              <button
                key={k}
                className={`sheet-opt ${prefs.sort === k ? "on" : ""}`}
                onClick={() => {
                  setPrefs({ sort: k });
                  setSheet(null);
                }}
              >
                {label}
                {prefs.sort === k && <IconCheck size={16} />}
              </button>
            ))}
          </div>
        )}
        {sheet === "tags" && (
          <>
            <div className="chips">
              {TAGS.map(([t]) => (
                <button key={t} className={`chip tag ${tags.includes(t) ? "on" : ""}`} onClick={() => toggleTag(t)}>
                  #{t}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button className="btn ghost" style={{ flex: "0 0 32%" }} onClick={() => setTags([])}>
                지우기
              </button>
              <button className="btn" onClick={() => setSheet(null)}>
                {filtered.length}개 보기
              </button>
            </div>
          </>
        )}
        {sheet === "group" && (
          <>
            <div className="group-row" style={{ marginTop: 0 }}>
              <button className={`switch ${prefs.group ? "on" : ""}`} onClick={() => setPrefs({ group: !prefs.group })} aria-pressed={prefs.group}>
                <i />
              </button>
              <span>스킨케어는 스킨케어끼리, 색조는 색조끼리</span>
            </div>
            {prefs.group && (
              <>
                <label className="label" style={{ marginTop: 18 }}>
                  묶음 순서
                </label>
                <div className="order-list" style={{ marginTop: 0 }}>
                  {prefs.order.map((g, i) => (
                    <div key={g} className="order-item">
                      <b>{i + 1}</b>
                      <span>{g}</span>
                      <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${g} 위로`}>
                        ↑
                      </button>
                      <button onClick={() => move(i, 1)} disabled={i === prefs.order.length - 1} aria-label={`${g} 아래로`}>
                        ↓
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </Sheet>
    </>
  );
}

function Row({ p, clash, picking, on, onClick }: { p: Proposal; clash?: Conflict[]; picking: boolean; on: boolean; onClick: () => void }) {
  const s = STATUS[p.status];
  const budget = p.analysis?.budgetWon;
  const n = checks(p);
  return (
    <button className={`item ${picking ? "picking" : ""}`} onClick={onClick}>
      {picking ? (
        <span className={`check-box ${on ? "on" : ""}`}>{on && <IconCheck />}</span>
      ) : (
        <span className="tile">{p.brandName.slice(0, 1)}</span>
      )}
      <span className="tx">
        <b>{p.brandName}</b>
        <small>
          {p.meta?.category?.split(" · ").pop() ?? "카테고리 미정"} · {p.source === "link" ? "링크" : "붙여넣기"} · {timeAgo(p.createdAt)}
        </small>
        <span className="pills">
          <i className={budget ? "" : "weak"}>{budget ? won(budget) : "제품만"}</i>
          {p.meta?.uploadDate && <i>{dateLabel(p.meta.uploadDate)}</i>}
          {p.meta?.minUse && <i>{p.meta.minUse} 사용</i>}
          {n > 0 && <i className="warn">확인 {n}</i>}
        </span>
        {clash && <small className="clash">{clash[0].short}</small>}
      </span>
      <span className={`badge ${s.tone}`}>{s.label}</span>
    </button>
  );
}

/* ---------- 비교 ---------- */

export function Compare({ proposals, conflicts, onBack, onOpen }: { proposals: Proposal[]; conflicts: Map<string, Conflict[]>; onBack: () => void; onOpen: (id: string) => void }) {
  const maxBudget = Math.max(...proposals.map((p) => p.analysis?.budgetWon ?? 0));
  const minChecks = Math.min(...proposals.map(checks));
  const rows: [string, (p: Proposal) => { v: string; tone?: "best" | "bad" }][] = [
    ["카테고리", (p) => ({ v: p.meta?.category ?? "-" })],
    [
      "원고료",
      (p) => {
        const b = p.analysis?.budgetWon;
        return { v: b ? won(b) : "제품만", tone: b && b === maxBudget ? "best" : !b ? "bad" : undefined };
      },
    ],
    ["적정 단가", (p) => ({ v: p.analysis ? `${won(p.analysis.price.low)}~${won(p.analysis.price.high)}` : "-" })],
    ["콘텐츠", (p) => ({ v: p.analysis?.terms.deliverables ?? "-" })],
    ["업로드", (p) => ({ v: p.meta?.uploadDate ? dateLabel(p.meta.uploadDate) : "미정" })],
    ["최소 사용", (p) => ({ v: p.meta?.minUse ?? "-" })],
    ["2차 활용", (p) => ({ v: p.analysis?.terms.usageRights ? "있음" : "없음", tone: p.analysis?.terms.usageRights ? "bad" : undefined })],
    ["독점", (p) => ({ v: exclusivityOf(p) ? "있음" : "없음", tone: exclusivityOf(p) ? "bad" : undefined })],
    ["확인할 것", (p) => ({ v: `${checks(p)}개`, tone: checks(p) === minChecks ? "best" : undefined })],
    ["겹침", (p) => ({ v: conflicts.has(p.id) ? "주의" : "없음", tone: conflicts.has(p.id) ? "bad" : undefined })],
  ];

  return (
    <section className="sec">
      <button className="link-btn" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: -6 }}>
        <IconBack size={18} /> 받은함
      </button>
      <h1 className="page-title" style={{ marginTop: 8 }}>
        제안 {proposals.length}개 비교
      </h1>
      <p className="lead">초록색은 더 나은 조건, 빨간색은 확인이 필요한 조건이에요.</p>
      <div className="cmp-wrap">
        <table className="cmp">
          <thead>
            <tr>
              <th />
              {proposals.map((p) => (
                <th key={p.id}>
                  <button onClick={() => onOpen(p.id)}>{p.brandName}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, f]) => (
              <tr key={label}>
                <th>{label}</th>
                {proposals.map((p) => {
                  const c = f(p);
                  return (
                    <td key={p.id} className={c.tone ?? ""}>
                      {c.v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------- 알림함 ---------- */

export type Alert = { key: string; id: string; at: string; title: string; body: string; tone: "new" | "warn" | "ok" | "bad" };

export function buildAlerts(list: Proposal[], conflicts: Map<string, Conflict[]>): Alert[] {
  const out: Alert[] = [];
  for (const p of list) {
    out.push({ key: `new:${p.id}`, id: p.id, at: p.createdAt, title: `${p.brandName}에서 새 제안이 왔어요`, body: p.analysis?.summary ?? "", tone: "new" });
    const reply = {
      brand_accepted: [`${p.brandName}가 수정 요청을 받아들였어요`, "ok"],
      brand_rejected: [`${p.brandName}가 수정 요청을 거절했어요`, "bad"],
      brand_revised: [`${p.brandName}가 조건을 다시 제안했어요`, "new"],
    }[p.status as string] as [string, Alert["tone"]] | undefined;
    if (reply) out.push({ key: `${p.status}:${p.id}:${p.updatedAt}`, id: p.id, at: p.updatedAt, title: reply[0], body: p.brandReply ?? "", tone: reply[1] });
  }
  const seen = new Set<string>();
  for (const [id, cs] of conflicts) {
    const p = list.find((x) => x.id === id);
    for (const c of cs) {
      const pair = [id, c.with].sort().join("|");
      if (seen.has(pair) || !p) continue;
      seen.add(pair);
      out.push({ key: `clash:${pair}`, id, at: p.updatedAt > p.createdAt ? p.updatedAt : p.createdAt, title: `${p.brandName}와 ${c.withName} 조건이 겹쳐요`, body: c.text, tone: "warn" });
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export function Alerts({
  alerts,
  read,
  done,
  onOpenAlert,
  onOpen,
  onReadAll,
}: {
  alerts: Alert[];
  read: Set<string>;
  done: Proposal[];
  onOpenAlert: (a: Alert) => void;
  onOpen: (id: string) => void;
  onReadAll: () => void;
}) {
  const [view, setView] = useState<"alerts" | "done">("alerts");
  const unread = alerts.filter((a) => !read.has(a.key)).length;
  return (
    <section className="sec">
      <div className="title-row">
        <h1 className="page-title">알림함</h1>
        {view === "alerts" && unread > 0 && (
          <button className="link-btn" onClick={onReadAll}>
            모두 읽음
          </button>
        )}
      </div>
      <div className="seg" style={{ marginTop: 14, ["--n" as string]: 2, ["--i" as string]: view === "alerts" ? 0 : 1 }}>
        <span className="thumb" />
        <button className={view === "alerts" ? "on" : ""} onClick={() => setView("alerts")}>
          알림 {unread > 0 && unread}
        </button>
        <button className={view === "done" ? "on" : ""} onClick={() => setView("done")}>
          처리한 제안 {done.length > 0 && done.length}
        </button>
      </div>
      {view === "alerts" ? (
        alerts.length === 0 ? (
          <div className="empty">
            <p>아직 알림이 없어요</p>
          </div>
        ) : (
          <div className="list">
            {alerts.map((a) => (
              <button key={a.key} className={`item alert ${read.has(a.key) ? "" : "unseen"}`} onClick={() => onOpenAlert(a)}>
                <span className={`adot ${a.tone}`} />
                <span className="tx">
                  <b>{a.title}</b>
                  {a.body && <small>{a.body}</small>}
                </span>
                <span className="caption">{timeAgo(a.at)}</span>
              </button>
            ))}
          </div>
        )
      ) : done.length === 0 ? (
        <div className="empty">
          <p>수락하거나 거절한 제안이 여기 모여요</p>
        </div>
      ) : (
        <div className="list">
          {done.map((p) => {
            const s = STATUS[p.status];
            return (
              <button key={p.id} className="item" onClick={() => onOpen(p.id)}>
                <span className="tile">{p.brandName.slice(0, 1)}</span>
                <span className="tx">
                  <b>{p.brandName}</b>
                  <small>{metaLine(p) || (p.source === "link" ? "링크로 받은 제안" : "붙여넣은 제안")}</small>
                </span>
                <span className={`badge ${s.tone}`}>{s.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------- 플로팅 메뉴 (HairPass 스피드 다이얼) ---------- */

const svg = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" aria-hidden>
    {d}
  </svg>
);
const ICON = {
  tag: svg(
    <>
      <path d="M3 12V4a1 1 0 011-1h8l9 9-9 9-9-9z" />
      <circle cx="8" cy="8" r="1.5" />
    </>,
  ),
  group: svg(
    <>
      <rect x="3" y="4" width="18" height="6" rx="2" />
      <rect x="3" y="14" width="18" height="6" rx="2" />
    </>,
  ),
  compare: svg(
    <>
      <rect x="3" y="4" width="7" height="16" rx="2" />
      <rect x="14" y="4" width="7" height="16" rx="2" />
    </>,
  ),
  alert: svg(<path d="M12 3l9.5 17h-19L12 3zM12 10v4M12 17.5v.01" />),
};

type DialItem = { key: string; label: string; icon: ReactNode; on: boolean; act: () => void };

function Dial({ items, lifted }: { items: DialItem[]; lifted: boolean }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const n = items.length;
  const active = items.some((i) => i.on && i.key !== "compare");
  return (
    <div className={`dial ${open ? "open" : ""} ${lifted ? "lifted" : ""}`}>
      <div className="dial-scrim" onClick={() => setOpen(false)} />
      <div className="dial-menu" inert={!open}>
        {items.map((it, i) => (
          <button
            key={it.key}
            className={`dial-item ${it.on ? "on" : ""}`}
            style={{ ["--i" as string]: i, ["--r" as string]: n - 1 - i }}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              setOpen(false);
              it.act();
            }}
          >
            <span className="dl">{it.label}</span>
            <span className="dc">{it.icon}</span>
          </button>
        ))}
      </div>
      <button ref={btn} className="dial-btn" aria-expanded={open} aria-label={open ? "메뉴 닫기" : "정렬·필터 메뉴 열기"} onClick={() => setOpen(!open)}>
        <svg className="i-home" viewBox="0 0 24 24" aria-hidden>
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        <svg className="i-x" viewBox="0 0 24 24" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
        {active && !open && <span className="dial-dot" />}
      </button>
    </div>
  );
}

function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className={`bsheet ${open ? "open" : ""}`} inert={!open}>
      <div className="bsheet-scrim" onClick={onClose} />
      <div className="bsheet-panel" role="dialog" aria-label={title}>
        <div className="bsheet-grab" />
        <div className="bsheet-head">
          <h2 className="sec-title">{title}</h2>
          <button className="link-btn" onClick={onClose}>
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
