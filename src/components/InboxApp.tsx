"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AXES, CAT, CATEGORIES, type CategoryId, DEMO, type GroupId, GROUPS, type Msg } from "@/lib/inbox";
import { IconBack, IconChat, IconCheck, IconEmpty, IconInbox, IconLink, IconList, IconShield } from "./icons";

type Tab = "inbox" | "rules" | "connect";
type Filter = "all" | GroupId;

const ME = { handle: "beauty.min", followers: "7.2만" };

function catClass(id: CategoryId) {
  if (id === "abuse" || id === "scam") return "c-bad";
  const tone = GROUPS.find((g) => g.id === CAT[id].group)?.tone;
  return `c-${tone || "none"}`;
}

// 급한 순, 같으면 받은 순
const byUrgency = (a: Msg, b: Msg) => b.urgency - a.urgency;

function Pills({ m }: { m: Msg }) {
  return (
    <div className="pills">
      <i className={catClass(m.category)}>{CAT[m.category].label}</i>
      {m.reply && <i>답장 필요</i>}
      {m.urgency >= 2 && <i className="warn">급함 {m.urgency}</i>}
      {m.terms && <i>조건 있음</i>}
    </div>
  );
}

export function InboxApp() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [filter, setFilter] = useState<Filter>("all");
  const [onlyReply, setOnlyReply] = useState(false);
  const [junkOpen, setJunkOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, CategoryId>>({});
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState(false);
  const [connected, setConnected] = useState(true);
  const [linking, setLinking] = useState(false);
  const [toast, setToast] = useState("");

  const [live, setLive] = useState<Msg[]>([]);
  // 웹훅이 저장한 실제 인스타 DM을 5초마다 가져와 데모 DM 앞에 둔다.
  useEffect(() => {
    const load = () =>
      fetch("/api/dms", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => setLive(j.dms ?? []))
        .catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const msgs = useMemo<Msg[]>(
    () => [...live, ...DEMO].map((m) => ({ ...m, category: overrides[m.id] ?? m.category })),
    [live, overrides],
  );
  const open = msgs.find((m) => m.id === openId) ?? null;

  const goHome = useCallback(() => {
    setOpenId(null);
    setSheet(false);
  }, []);
  useEffect(() => {
    window.addEventListener("popstate", goHome);
    return () => window.removeEventListener("popstate", goHome);
  }, [goHome]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  };
  const openMsg = (id: string) => {
    setOpenId(id);
    if (!history.state?.pp) history.pushState({ pp: 1 }, "");
    window.scrollTo({ top: 0 });
  };
  // 목업이라 이동은 안내만 한다. 연동 후에는 해당 대화방 링크로 바꾼다.
  const goChat = (m: Msg) => showToast(`@${m.handle} 채팅방으로 이동해요`);
  const link = () => {
    setLinking(true);
    setTimeout(() => {
      setLinking(false);
      setConnected(true);
    }, 900);
  };

  const needReply = msgs.filter((m) => m.reply).length;
  const urgent = msgs.filter((m) => m.urgency >= 2).length;
  const withTerms = msgs.filter((m) => m.terms).length;
  const inGroup = (g: GroupId) => msgs.filter((m) => CAT[m.category].group === g);
  const visible = (g: GroupId) => inGroup(g).filter((m) => !onlyReply || m.reply).sort(byUrgency);

  const Row = ({ m }: { m: Msg }) => {
    const hidden = m.category === "abuse" && !revealed.has(m.id);
    return (
      <div className="item">
        <button className="row-main" onClick={() => openMsg(m.id)}>
          <span className="tile">{m.name.slice(0, 1)}</span>
          <span className="tx">
            <b>{m.name}</b>
            <small>{hidden ? "상처가 될 수 있어 가려 뒀어요" : m.text}</small>
            <Pills m={m} />
          </span>
          <span className="caption">{m.ago}</span>
        </button>
        <button className="go" aria-label="채팅방으로 이동" onClick={() => goChat(m)}>
          <IconChat size={20} />
        </button>
      </div>
    );
  };

  const filters: [Filter, string, number][] = [
    ["all", "전체", msgs.length],
    ...GROUPS.map((g) => [g.id, g.label, inGroup(g.id).length] as [Filter, string, number]),
  ];

  const shown = filter === "all" ? GROUPS : GROUPS.filter((g) => g.id === filter);

  return (
    <div className="app">
      <header className="top">
        <button className="brand home-btn" onClick={() => (goHome(), setTab("inbox"))} aria-label="홈으로">
          <span className="brand-mark" style={{ color: "var(--on-brand)" }}>
            <IconShield />
          </span>
          PitchPouch
        </button>
        <span className="caption">
          @{ME.handle} · 팔로워 {ME.followers}
        </span>
      </header>

      {open ? (
        <Detail
          m={open}
          shown={open.category !== "abuse" || revealed.has(open.id)}
          onReveal={() => setRevealed(new Set([...revealed, open.id]))}
          onBack={() => history.back()}
          onChange={() => setSheet(true)}
          onGo={() => goChat(open)}
        />
      ) : tab === "inbox" ? (
        <section className="sec">
          <h1 className="page-title">
            오늘 DM {msgs.length}개,
            <br />
            답장할 건 {needReply}개예요
          </h1>
          <p className="lead">다음에 할 행동으로 나눴어요. 확인하고 바로 채팅방으로 가요.</p>

          <div className="stat-row">
            <div className="stat">
              <b>{needReply}</b>
              <small>답장 필요</small>
            </div>
            <div className="stat hot">
              <b>{urgent}</b>
              <small>급한 것</small>
            </div>
            <div className="stat">
              <b>{withTerms}</b>
              <small>조건 적힘</small>
            </div>
          </div>

          <div className="filters">
            <div className="chips scroll">
              {filters.map(([id, label, n]) => (
                <button key={id} className={`chip ${filter === id ? "on" : ""}`} onClick={() => setFilter(id)}>
                  {label} {n}
                </button>
              ))}
            </div>
          </div>
          <div className="group-row">
            <button className={`switch ${onlyReply ? "on" : ""}`} onClick={() => setOnlyReply(!onlyReply)} aria-label="답장 필요만 보기">
              <i />
            </button>
            답장 필요한 것만 보기
          </div>

          {shown.map((g) => {
            const list = visible(g.id);
            const collapsed = filter === "all" && g.id === "junk" && !junkOpen;
            return (
              <div key={g.id}>
                <div className="title-row">
                  <p className="group-title">
                    {g.label}
                    <span>
                      {list.length} · {g.hint}
                    </span>
                  </p>
                  {filter === "all" && g.id === "junk" && (
                    <button className="link-btn" style={{ marginTop: 18 }} onClick={() => setJunkOpen(!junkOpen)}>
                      {junkOpen ? "접기" : "펼치기"}
                    </button>
                  )}
                </div>
                {!collapsed && (
                  <div className="list">
                    {list.length === 0 ? (
                      <div className="empty">
                        <IconEmpty size={44} />
                        <div>해당하는 DM이 없어요</div>
                      </div>
                    ) : (
                      list.map((m) => <Row key={m.id} m={m} />)
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ) : tab === "rules" ? (
        <Rules />
      ) : (
        <Connect connected={connected} linking={linking} onLink={link} onUnlink={() => setConnected(false)} />
      )}

      <nav className="tabbar">
        {(
          [
            ["inbox", "보관함", <IconInbox key="i" />],
            ["rules", "분류 기준", <IconList key="r" size={22} />],
            ["connect", "인스타 연결", <IconLink key="l" />],
          ] as const
        ).map(([key, label, icon]) => (
          <button
            key={key}
            className={tab === key && !open ? "on" : ""}
            onClick={() => {
              goHome();
              setTab(key);
              window.scrollTo({ top: 0 });
            }}
          >
            {icon}
            {label}
            {key === "inbox" && urgent > 0 && <span className="dot">{urgent}</span>}
          </button>
        ))}
      </nav>

      <div className={`bsheet ${sheet && open ? "open" : ""}`}>
        <div className="bsheet-scrim" onClick={() => setSheet(false)} />
        <div className="bsheet-panel">
          <div className="bsheet-grab" />
          <div className="bsheet-head">
            <h2 className="sec-title">분류 바꾸기</h2>
            <button className="link-btn" onClick={() => setSheet(false)}>
              닫기
            </button>
          </div>
          {GROUPS.map((g) => (
            <div key={g.id}>
              <p className="group-title" style={{ marginTop: 14 }}>
                {g.label}
              </p>
              <div className="sheet-list">
                {CATEGORIES.filter((c) => c.group === g.id).map((c) => {
                  const on = open?.category === c.id;
                  return (
                    <button
                      key={c.id}
                      className={`sheet-opt ${on ? "on" : ""}`}
                      onClick={() => {
                        if (!open) return;
                        setOverrides({ ...overrides, [open.id]: c.id });
                        setSheet(false);
                        showToast(`${c.label}(으)로 바꿨어요`);
                      }}
                    >
                      <span>
                        {c.label}
                        <small className="opt-desc">{c.desc}</small>
                      </span>
                      {on && <IconCheck size={18} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Detail({
  m,
  shown,
  onReveal,
  onBack,
  onChange,
  onGo,
}: {
  m: Msg;
  shown: boolean;
  onReveal: () => void;
  onBack: () => void;
  onChange: () => void;
  onGo: () => void;
}) {
  const c = CAT[m.category];
  return (
    <>
      <section className="sec" style={{ paddingBottom: 8 }}>
        <button className="link-btn" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: -6 }}>
          <IconBack size={18} /> 보관함
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <h1 className="page-title" style={{ flex: 1 }}>
            {m.name}
          </h1>
          <button className={`badge pick ${catClass(m.category)}`} onClick={onChange}>
            {c.label} ▾
          </button>
        </div>
        <p className="caption">
          @{m.handle} · {m.ago}
        </p>
        {shown ? (
          <div className="reply">{m.text}</div>
        ) : (
          <div className="reply">
            상처가 될 수 있는 내용이라 가려 뒀어요.
            <button className="btn ghost sm" style={{ marginTop: 10, display: "flex" }} onClick={onReveal}>
              내용 보기
            </button>
          </div>
        )}
      </section>

      <section className="sec">
        <h2 className="sec-title">이렇게 읽었어요</h2>
        <p className="lead">{m.reason}</p>
        <div className="stat-row">
          <div className="stat">
            <b>{m.reply ? "예" : "아니오"}</b>
            <small>답장 필요</small>
          </div>
          <div className={`stat ${m.urgency === 3 ? "hot" : m.urgency === 2 ? "mid" : ""}`}>
            <b>{m.urgency}</b>
            <small>급한 정도 (0~3)</small>
          </div>
          <div className="stat">
            <b>{m.terms ? "예" : "아니오"}</b>
            <small>금액·조건</small>
          </div>
        </div>
        {m.termsNote && <div className="note" style={{ marginTop: 12 }}>적힌 조건: {m.termsNote}</div>}
      </section>

      <div className="cta">
        <button className="btn ghost" onClick={onChange}>
          분류 바꾸기
        </button>
        <button className="btn" onClick={onGo}>
          <IconChat size={18} /> 채팅방으로 이동
        </button>
      </div>
    </>
  );
}

function Rules() {
  return (
    <>
      <section className="sec">
        <h1 className="page-title">분류 기준</h1>
        <p className="lead">주제가 아니라 내가 다음에 할 행동으로 묶고, 비슷한 것은 정의로 갈라요.</p>
      </section>
      {GROUPS.map((g) => (
        <section className="sec" key={g.id}>
          <h2 className="sec-title">{g.label}</h2>
          <p className="caption">{g.hint}</p>
          <div style={{ marginTop: 8 }}>
            {CATEGORIES.filter((c) => c.group === g.id).map((c) => (
              <div className="pt" key={c.id}>
                <b>{c.label}</b>
                <p>{c.desc}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
      <section className="sec">
        <h2 className="sec-title">함께 읽는 3가지</h2>
        <p className="lead">분류와는 따로 물어요. 급한 정도를 분류에 섞으면 주제 판정이 흐려져요.</p>
        <div style={{ marginTop: 8 }}>
          {AXES.map((a) => (
            <div className="pt" key={a.key}>
              <b>{a.q}</b>
              <p>{a.scale}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Connect({
  connected,
  linking,
  onLink,
  onUnlink,
}: {
  connected: boolean;
  linking: boolean;
  onLink: () => void;
  onUnlink: () => void;
}) {
  return (
    <section className="sec">
      <h1 className="page-title">인스타 연결</h1>
      <p className="lead">Meta 계정을 연결하면 DM이 자동으로 들어와 분류돼요.</p>
      <div className="note warn" style={{ marginTop: 14 }}>
        지금은 목업 화면이에요. 실제 연동은 Meta 앱 심사를 통과한 뒤 열려요.
      </div>
      <div className="link-box">
        <code>{connected ? `@${ME.handle} 연결됨` : "연결된 계정이 없어요"}</code>
        {connected && <span className="badge ok">사용 중</span>}
      </div>
      <div className="pt" style={{ marginTop: 12 }}>
        <b>DM 읽기</b>
        <p>받은 메시지를 읽어 분류하고 답장 필요 여부, 급한 정도, 조건을 뽑아요.</p>
      </div>
      <div className="pt">
        <b>답장은 직접</b>
        <p>자동으로 답장하지 않아요. 채팅방으로 이동해서 직접 보내요.</p>
      </div>
      <div className="pt">
        <b>가려서 보기</b>
        <p>악성 메시지는 기본으로 가려 둬요. 보고 싶을 때만 열어요.</p>
      </div>
      <div style={{ marginTop: 20 }}>
        {connected ? (
          <button className="btn ghost" onClick={onUnlink}>
            연결 해제
          </button>
        ) : (
          <button className="btn" disabled={linking} onClick={onLink}>
            {linking ? "연결하는 중" : "Meta로 연결하기"}
          </button>
        )}
      </div>
    </section>
  );
}
