"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { type Conflict, dateLabel, findConflicts, minUseDays } from "@/lib/meta";
import type { Creator, Proposal } from "@/lib/types";
import { AnalysisCard } from "./AnalysisCard";
import { IconBack, IconBell, IconCheck, IconEmpty, IconInbox, IconLink, IconPaste, IconShield } from "./icons";
import { STATUS } from "./status";

const PROFILE_KEY = "pitchpouch_creator";
const SEEN_KEY = "pitchpouch_alerts_seen";
type Tab = "inbox" | "alerts" | "paste" | "link";
// 시연은 유료(PRO) 기준. 무료로 보려면 false.
const PRO = true;
const DONE = new Set(["accepted", "rejected", "brand_accepted", "brand_rejected"]);

type Alert = { id: string; at: string; title: string; body: string; tone: "new" | "warn" | "ok" | "bad" };

function buildAlerts(list: Proposal[], conflicts: Map<string, Conflict[]>): Alert[] {
  const out: Alert[] = [];
  for (const p of list) {
    out.push({ id: p.id, at: p.createdAt, title: `${p.brandName}에서 새 제안이 왔어요`, body: p.analysis?.summary ?? "", tone: "new" });
    if (p.status === "brand_accepted") out.push({ id: p.id, at: p.updatedAt, title: `${p.brandName}가 수정 요청을 받아들였어요`, body: p.brandReply ?? "", tone: "ok" });
    if (p.status === "brand_rejected") out.push({ id: p.id, at: p.updatedAt, title: `${p.brandName}가 수정 요청을 거절했어요`, body: p.brandReply ?? "", tone: "bad" });
    if (p.status === "brand_revised") out.push({ id: p.id, at: p.updatedAt, title: `${p.brandName}가 조건을 다시 제안했어요`, body: p.brandReply ?? "", tone: "new" });
  }
  const seen = new Set<string>();
  for (const [id, cs] of conflicts) {
    const p = list.find((x) => x.id === id);
    for (const c of cs) {
      const key = [id, c.with].sort().join("|");
      if (seen.has(key) || !p) continue;
      seen.add(key);
      out.push({ id, at: p.updatedAt > p.createdAt ? p.updatedAt : p.createdAt, title: `${p.brandName}와 ${c.withName} 조건이 겹쳐요`, body: c.text, tone: "warn" });
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

function readSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
}

const PROFILE_EVENT = "pitchpouch-profile";

function readProfileRaw() {
  try {
    return localStorage.getItem(PROFILE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeProfile(c: Creator | null) {
  try {
    if (c) localStorage.setItem(PROFILE_KEY, JSON.stringify(c));
    else localStorage.removeItem(PROFILE_KEY);
  } catch {}
  window.dispatchEvent(new Event(PROFILE_EVENT));
}

function subscribeProfile(cb: () => void) {
  window.addEventListener(PROFILE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(PROFILE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

// 서버 렌더링 중에는 null(아직 모름)을 돌려준다.
function useProfile() {
  const raw = useSyncExternalStore(subscribeProfile, readProfileRaw, () => null);
  const creator = useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Creator;
    } catch {
      return null;
    }
  }, [raw]);
  return { ready: raw !== null, creator };
}

export function CreatorApp() {
  const { ready, creator } = useProfile();
  const [tab, setTab] = useState<Tab>("inbox");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [seenAt, setSeenAt] = useState(readSeen);

  // 서버 메모리 저장소가 재시작돼도 링크가 살아 있도록 프로필을 다시 등록한다.
  useEffect(() => {
    if (creator) void fetch("/api/creators", { method: "POST", body: JSON.stringify(creator) });
  }, [creator]);

  const refresh = useCallback(async () => {
    if (!creator) return;
    const res = await fetch(`/api/proposals?handle=${encodeURIComponent(creator.handle)}`, { cache: "no-store" });
    if (res.ok) setProposals((await res.json()).proposals);
  }, [creator]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, 4000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refresh]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("복사했어요");
    } catch {
      showToast("복사하지 못했어요");
    }
  };

  const conflicts = useMemo(() => findConflicts(proposals), [proposals]);
  const alerts = useMemo(() => buildAlerts(proposals, conflicts), [proposals, conflicts]);
  const active = proposals.filter((p) => !DONE.has(p.status));
  const unread = active.filter((p) => p.status === "new" || p.status === "brand_revised").length;
  const unseen = alerts.filter((a) => a.at > seenAt).length;
  const open = proposals.find((p) => p.id === openId) ?? null;
  const markSeen = () => {
    const now = new Date().toISOString();
    setSeenAt(now);
    try {
      localStorage.setItem(SEEN_KEY, now);
    } catch {}
  };

  if (!ready) return <div className="app" />;
  if (!creator)
    return (
      <Onboarding
        onDone={(c) => writeProfile(c)}
      />
    );

  return (
    <div className="app">
      <header className="top">
        <span className="brand">
          <span className="brand-mark" style={{ color: "var(--on-brand)" }}>
            <IconShield />
          </span>
          PitchPouch
          {PRO && <span className="pro">PRO</span>}
        </span>
        <button
          className="link-btn"
          onClick={() => {
            writeProfile(null);
            setProposals([]);
          }}
        >
          @{creator.handle} · 프로필 변경
        </button>
      </header>

      {open ? (
        <Detail
          proposal={open}
          conflicts={conflicts.get(open.id) ?? []}
          onBack={() => setOpenId(null)}
          onCopy={copy}
          onChanged={refresh}
          showToast={showToast}
        />
      ) : tab === "inbox" ? (
        <Inbox proposals={active} conflicts={conflicts} onOpen={setOpenId} onPaste={() => setTab("paste")} />
      ) : tab === "alerts" ? (
        <Alerts alerts={alerts} seenAt={seenAt} done={proposals.filter((p) => DONE.has(p.status))} onOpen={setOpenId} />
      ) : tab === "paste" ? (
        <Paste
          creator={creator}
          onDone={async (p) => {
            await refresh();
            setTab("inbox");
            setOpenId(p.id);
          }}
        />
      ) : (
        <MyLink creator={creator} onCopy={copy} />
      )}

      <nav className="tabbar">
        {(
          [
            ["inbox", "받은함", <IconInbox key="i" />],
            ["alerts", "알림함", <IconBell key="b" />],
            ["paste", "붙여넣기", <IconPaste key="p" />],
            ["link", "내 링크", <IconLink key="l" />],
          ] as const
        ).map(([key, label, icon]) => (
          <button
            key={key}
            className={tab === key && !open ? "on" : ""}
            onClick={() => {
              setOpenId(null);
              if (tab === "alerts" && key !== "alerts") markSeen();
              setTab(key);
              window.scrollTo({ top: 0 });
            }}
          >
            {icon}
            {label}
            {key === "inbox" && unread > 0 && <span className="dot">{unread}</span>}
            {key === "alerts" && unseen > 0 && tab !== "alerts" && <span className="dot">{unseen}</span>}
          </button>
        ))}
      </nav>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Onboarding({ onDone }: { onDone: (c: Creator) => void }) {
  const [handle, setHandle] = useState("");
  const [followers, setFollowers] = useState("");
  const [avgViews, setAvgViews] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = handle.trim() && Number(followers) > 0;

  const submit = async () => {
    setBusy(true);
    setErr("");
    const res = await fetch("/api/creators", {
      method: "POST",
      body: JSON.stringify({ handle, followers: Number(followers), avgViews: Number(avgViews), category: "뷰티" }),
    });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error);
    onDone((await res.json()).creator);
  };

  return (
    <div className="app">
      <header className="top">
        <span className="brand">
          <span className="brand-mark" style={{ color: "var(--on-brand)" }}>
            <IconShield />
          </span>
          PitchPouch
        </span>
      </header>
      <section className="sec">
        <h1 className="page-title">
          협찬 제안,
          <br />
          이제 한 곳에서 확인해요
        </h1>
        <p className="lead">세 칸만 채우면 내 협찬 링크가 바로 생겨요.</p>
        <div className="field">
          <label className="label">인스타 아이디</label>
          <input className="input" placeholder="@beauty.min" value={handle} onChange={(e) => setHandle(e.target.value)} />
        </div>
        <div className="field row2">
          <div>
            <label className="label">팔로워 수</label>
            <input className="input" inputMode="numeric" placeholder="12000" value={followers} onChange={(e) => setFollowers(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <label className="label">릴스 평균 조회수</label>
            <input className="input" inputMode="numeric" placeholder="8000" value={avgViews} onChange={(e) => setAvgViews(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>
        {err && <p className="err">{err}</p>}
      </section>
      <div className="cta" style={{ bottom: 0 }}>
        <button className="btn" disabled={!ok || busy} onClick={submit}>
          {busy ? "만드는 중" : "시작하기"}
        </button>
      </div>
    </div>
  );
}

type Sort = "recent" | "upload" | "use";
const SORTS: [Sort, string][] = [
  ["recent", "최신순"],
  ["upload", "업로드 빠른순"],
  ["use", "사용 기간 짧은순"],
];

function metaLine(p: Proposal) {
  const m = p.meta;
  return [m?.category?.split(" · ").pop(), m?.uploadDate && `${dateLabel(m.uploadDate)} 업로드`, m?.minUse && `${m.minUse} 사용`]
    .filter(Boolean)
    .join(" · ");
}

function Inbox({
  proposals,
  conflicts,
  onOpen,
  onPaste,
}: {
  proposals: Proposal[];
  conflicts: Map<string, Conflict[]>;
  onOpen: (id: string) => void;
  onPaste: () => void;
}) {
  const [sort, setSort] = useState<Sort>("recent");
  const [cat, setCat] = useState("전체");
  const todo = proposals.filter((p) => ["new", "brand_revised"].includes(p.status)).length;
  const conflictCount = proposals.filter((p) => conflicts.has(p.id)).length;

  const shown = useMemo(() => {
    const far = "9999-12-31";
    const list = proposals.filter((p) => cat === "전체" || p.meta?.category?.startsWith(cat));
    if (sort === "upload") return [...list].sort((a, b) => (a.meta?.uploadDate ?? far).localeCompare(b.meta?.uploadDate ?? far));
    if (sort === "use") return [...list].sort((a, b) => (minUseDays(a.meta?.minUse) || 999) - (minUseDays(b.meta?.minUse) || 999));
    return list;
  }, [proposals, sort, cat]);

  return (
    <section className="sec">
      <h1 className="page-title">받은함</h1>
      <p className="lead">{proposals.length ? `확인할 제안 ${todo}건` : "링크와 붙여넣기로 받은 제안이 여기 모여요."}</p>
      {conflictCount > 0 && (
        <div className="note warn" style={{ marginTop: 14 }}>
          서로 조건이 겹치는 제안이 {conflictCount}건 있어요. 독점 조건을 먼저 확인해 주세요.
        </div>
      )}
      {PRO && proposals.length > 1 && (
        <div className="filters">
          <div className="seg" style={{ ["--n" as string]: SORTS.length, ["--i" as string]: SORTS.findIndex(([k]) => k === sort) }}>
            <span className="thumb" />
            {SORTS.map(([k, label]) => (
              <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>
                {label}
              </button>
            ))}
          </div>
          <div className="chips" style={{ marginTop: 10 }}>
            {["전체", "스킨케어", "색조", "기타"].map((c) => (
              <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
      {proposals.length === 0 ? (
        <div className="empty">
          <IconEmpty />
          <p>아직 받은 제안이 없어요</p>
          <button className="btn sm" style={{ marginTop: 14 }} onClick={onPaste}>
            받은 DM 붙여넣기
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty">
          <p>이 카테고리 제안은 없어요</p>
        </div>
      ) : (
        <div className="list">
          {shown.map((p) => {
            const s = STATUS[p.status];
            const risks = p.analysis?.risks.length ?? 0;
            const clash = conflicts.get(p.id);
            const meta = metaLine(p);
            return (
              <button key={p.id} className="item" onClick={() => onOpen(p.id)}>
                <span className="tile">{p.brandName.slice(0, 1)}</span>
                <span className="tx">
                  <b>{p.brandName}</b>
                  <small>
                    {p.source === "link" ? "링크" : "붙여넣기"} · {risks ? `불리한 조항 ${risks}개` : "불리한 조항 없음"} · {timeAgo(p.createdAt)}
                  </small>
                  {meta && <small>{meta}</small>}
                  {clash && <small className="clash">{clash[0].short}</small>}
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

function Alerts({ alerts, seenAt, done, onOpen }: { alerts: Alert[]; seenAt: string; done: Proposal[]; onOpen: (id: string) => void }) {
  const [view, setView] = useState<"alerts" | "done">("alerts");
  return (
    <section className="sec">
      <h1 className="page-title">알림함</h1>
      <div className="seg" style={{ marginTop: 14, ["--n" as string]: 2, ["--i" as string]: view === "alerts" ? 0 : 1 }}>
        <span className="thumb" />
        <button className={view === "alerts" ? "on" : ""} onClick={() => setView("alerts")}>
          알림
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
            {alerts.map((a, i) => (
              <button key={`${a.id}-${i}`} className={`item alert ${a.at > seenAt ? "unseen" : ""}`} onClick={() => onOpen(a.id)}>
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

function Paste({ creator, onDone }: { creator: Creator; onDone: (p: Proposal) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true);
    setErr("");
    const res = await fetch("/api/proposals", { method: "POST", body: JSON.stringify({ source: "paste", creator, text }) });
    setBusy(false);
    if (!res.ok) return setErr((await res.json()).error);
    onDone((await res.json()).proposal);
  };

  if (busy)
    return (
      <section className="sec">
        <div className="loading">
          <div className="bar">
            <i />
          </div>
          조건을 하나씩 읽고 있어요
        </div>
      </section>
    );

  return (
    <>
      <section className="sec">
        <h1 className="page-title">받은 제안 붙여넣기</h1>
        <p className="lead">DM, 메일, 카톡, 계약서 문장 모두 돼요.</p>
        <div className="field">
          <textarea
            className="textarea"
            placeholder={"브랜드에게 받은 협찬 제안을 그대로 붙여넣어 주세요.\n\n예) 안녕하세요! OO코스메틱입니다. 신제품 세럼을 보내드리고 싶은데 릴스 1개 부탁드려요..."}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        {err && <p className="err">{err}</p>}
      </section>
      <div className="cta">
        <button className="btn" disabled={text.trim().length < 10} onClick={submit}>
          분석하기
        </button>
      </div>
    </>
  );
}

function MyLink({ creator, onCopy }: { creator: Creator; onCopy: (t: string) => void }) {
  const url = `${window.location.origin}/p/${creator.handle}`;
  return (
    <section className="sec">
      <h1 className="page-title">내 협찬 링크</h1>
      <p className="lead">바이오에 걸고, 협찬 DM이 오면 이 링크로 안내해 주세요.</p>
      <div className="link-box">
        <code>{url}</code>
        <button className="btn sm" onClick={() => onCopy(url)}>
          복사
        </button>
      </div>
      <div className="field">
        <label className="label">DM 안내 문구</label>
        <div className="reply">{`협찬 제안 감사합니다! 조건 확인을 위해 아래 링크로 제안 부탁드려요 :)\n${url}`}</div>
        <button
          className="btn ghost sm"
          style={{ marginTop: 10 }}
          onClick={() => onCopy(`협찬 제안 감사합니다! 조건 확인을 위해 아래 링크로 제안 부탁드려요 :)\n${url}`)}
        >
          안내 문구 복사
        </button>
      </div>
      <a className="btn ghost" style={{ marginTop: 20, textDecoration: "none" }} href={url} target="_blank" rel="noreferrer">
        브랜드 화면 미리 보기
      </a>
    </section>
  );
}

function Detail({
  proposal: p,
  conflicts,
  onBack,
  onCopy,
  onChanged,
  showToast,
}: {
  proposal: Proposal;
  conflicts: Conflict[];
  onBack: () => void;
  onCopy: (t: string) => void;
  onChanged: () => Promise<void>;
  showToast: (m: string) => void;
}) {
  const a = p.analysis;
  const options = useMemo(
    () => [
      ...(a?.risks.map((r) => r.ask) ?? []),
      ...(a?.missing.map((m) => `${m.item}을(를) 알려 주세요.`) ?? []),
    ],
    [a],
  );
  const [picked, setPicked] = useState<string[]>(options.slice(0, 3));
  const [busy, setBusy] = useState(false);

  const act = async (body: object, msg: string) => {
    setBusy(true);
    await fetch(`/api/proposals/${p.id}`, { method: "PATCH", body: JSON.stringify(body) });
    await onChanged();
    setBusy(false);
    showToast(msg);
  };

  const s = STATUS[p.status];
  const canCounter = p.source === "link" && ["new", "brand_revised"].includes(p.status);

  return (
    <>
      <section className="sec" style={{ paddingBottom: 8 }}>
        <button className="link-btn" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: -6 }}>
          <IconBack size={18} /> 받은함
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <h1 className="page-title" style={{ flex: 1 }}>
            {p.brandName}
          </h1>
          <span className={`badge ${s.tone}`}>{s.label}</span>
        </div>
        <p className="caption">
          {p.source === "link" ? "링크로 받은 제안" : "붙여넣은 제안"}
          {p.contact ? ` · ${p.contact}` : ""}
        </p>
        {metaLine(p) && <p className="caption">{metaLine(p)}</p>}
        {conflicts.map((c) => (
          <div key={c.with} className="note warn" style={{ marginTop: 12 }}>
            주의: {c.text}
          </div>
        ))}
        {p.brandReply && <div className="note" style={{ marginTop: 12 }}>브랜드 답변: {p.brandReply}</div>}
        {p.status === "countered" && <div className="note warn" style={{ marginTop: 12 }}>수정 요청을 보냈어요. 브랜드 답변을 기다리는 중이에요.</div>}
      </section>

      {a && <AnalysisCard analysis={a} onCopy={onCopy} />}

      {canCounter && options.length > 0 && (
        <section className="sec">
          <h2 className="sec-title">브랜드에 수정 요청</h2>
          <p className="lead">보낼 항목을 고르면 브랜드가 같은 링크에서 답해요.</p>
          <div style={{ marginTop: 8 }}>
            {options.map((o) => {
              const on = picked.includes(o);
              return (
                <button key={o} className={`check ${on ? "on" : ""}`} onClick={() => setPicked(on ? picked.filter((x) => x !== o) : [...picked, o])}>
                  <span className="box">{on && <IconCheck />}</span>
                  <span>{o}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="cta">
        {canCounter ? (
          <>
            <button className="btn ghost" disabled={busy} onClick={() => act({ action: "accept" }, "수락했어요")}>
              그대로 수락
            </button>
            <button
              className="btn"
              disabled={busy || picked.length === 0}
              onClick={() => act({ action: "counter", items: picked, message: a?.replies.requestChanges ?? "" }, "수정 요청을 보냈어요")}
            >
              수정 요청 보내기
            </button>
          </>
        ) : p.source === "paste" && p.status === "new" ? (
          <>
            <button className="btn ghost" disabled={busy} onClick={() => act({ action: "reject" }, "거절로 정리했어요")}>
              거절
            </button>
            <button className="btn" disabled={busy} onClick={() => act({ action: "accept" }, "진행으로 정리했어요")}>
              답장 보냄, 진행
            </button>
          </>
        ) : null}
      </div>
    </>
  );
}

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}
