"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type ClassifyResponse,
  type ClassifyUsage,
  DEMO,
  type GroupId,
  GROUPS,
  type Msg,
} from "@/lib/inbox";
import { IconBack, IconChat, IconCheck, IconEmpty, IconInbox, IconLink, IconPaste, IconShield } from "./icons";

type Tab = "inbox" | "paste" | "connect";
type Filter = "all" | GroupId;

const ME = { handle: "beauty.min", followers: "7.2만" };

const groupClass = (id: GroupId) => `c-${GROUPS.find((g) => g.id === id)?.tone || "none"}`;

// 급한 순, 같으면 받은 순
const byUrgency = (a: Msg, b: Msg) => b.urgency - a.urgency;

function Pills({ m }: { m: Msg }) {
  return (
    <div className="pills">
      {m.reply && <i>답장 필요</i>}
      {m.urgency >= 2 && <i className="warn">급함 {m.urgency}</i>}
      {m.terms && <i>조건 있음</i>}
    </div>
  );
}

export function InboxApp() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [filter, setFilter] = useState<Filter>("all");
  const [junkOpen, setJunkOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, GroupId>>({});
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState(false);
  const [connected, setConnected] = useState(true);
  const [linking, setLinking] = useState(false);
  const [toast, setToast] = useState("");
  const [extra, setExtra] = useState<Msg[]>([]);
  const [usage, setUsage] = useState<ClassifyUsage | null>(null);

  const msgs = useMemo<Msg[]>(
    () => [...extra, ...DEMO].map((m) => ({ ...m, group: overrides[m.id] ?? m.group })),
    [extra, overrides],
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
  const goChat = (m: Msg) => showToast(m.pasted ? "연동하면 이 DM의 채팅방으로 이동해요" : `@${m.handle} 채팅방으로 이동해요`);
  const addPasted = (added: Msg[], u: ClassifyUsage) => {
    setExtra([...added, ...extra]);
    setUsage(u);
    setTab("inbox");
    setFilter("all");
    showToast(`${added.length}개를 분류했어요`);
  };
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
  const inGroup = (g: GroupId) => msgs.filter((m) => m.group === g);
  const visible = (g: GroupId) => inGroup(g).sort(byUrgency);

  const Row = ({ m }: { m: Msg }) => {
    const hidden = m.group === "junk" && !revealed.has(m.id);
    return (
      <div className="item">
        <button className="row-main" onClick={() => openMsg(m.id)}>
          <span className="tile">{m.name.slice(0, 1)}</span>
          <span className="tx">
            <b>{m.name}</b>
            <small>{hidden ? "걸러낸 메시지라 가려 뒀어요" : m.text}</small>
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
          shown={open.group !== "junk" || revealed.has(open.id)}
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
          {usage && (
            <div className="note" style={{ marginTop: 14 }}>
              방금 Jev {usage.jev}개 · {usage.model.replace("claude-", "")} {usage.ai}개 · 규칙 {usage.rules}개 (Jev 신뢰도 {Math.round(usage.threshold * 100)}% 이상만 Jev 판정)
              {usage.jevInputTokens > 0 && ` · Jev 입력 ${usage.jevInputTokens.toLocaleString()}토큰(약 $${usage.jevCostUsd.toFixed(5)})`}
              {usage.ai > 0 && ` · Claude 입력 ${usage.inputTokens.toLocaleString()}, 출력 ${usage.outputTokens.toLocaleString()}토큰`}
              {usage.costUsd !== null && usage.ai > 0 && ` · 약 $${usage.costUsd.toFixed(5)}`}
            </div>
          )}

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
      ) : tab === "paste" ? (
        <Paste onDone={addPasted} />
      ) : (
        <Connect connected={connected} linking={linking} onLink={link} onUnlink={() => setConnected(false)} />
      )}

      <nav className="tabbar">
        {(
          [
            ["inbox", "받은함", <IconInbox key="i" />],
            ["paste", "붙여넣기", <IconPaste key="p" />],
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
          <div className="sheet-list">
            {GROUPS.map((g) => {
              const on = open?.group === g.id;
              return (
                <button
                  key={g.id}
                  className={`sheet-opt ${on ? "on" : ""}`}
                  onClick={() => {
                    if (!open) return;
                    setOverrides({ ...overrides, [open.id]: g.id });
                    setSheet(false);
                    showToast(`${g.label}(으)로 바꿨어요`);
                  }}
                >
                  <span>
                    {g.label}
                    <small className="opt-desc">{g.desc}</small>
                  </span>
                  {on && <IconCheck size={18} />}
                </button>
              );
            })}
          </div>
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
  const g = GROUPS.find((x) => x.id === m.group)!;
  return (
    <>
      <section className="sec" style={{ paddingBottom: 8 }}>
        <button className="link-btn" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: -6 }}>
          <IconBack size={18} /> 받은함
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <h1 className="page-title" style={{ flex: 1 }}>
            {m.name}
          </h1>
          <button className={`badge pick ${groupClass(m.group)}`} onClick={onChange}>
            {g.label} ▾
          </button>
        </div>
        <p className="caption">
          {m.pasted ? "붙여넣은 DM" : `@${m.handle}`} · {m.ago}
        </p>
        {shown ? (
          <div className="reply">{m.text}</div>
        ) : (
          <div className="reply">
            걸러낸 메시지라 가려 뒀어요.
            <button className="btn ghost sm" style={{ marginTop: 10, display: "flex" }} onClick={onReveal}>
              내용 보기
            </button>
          </div>
        )}
      </section>

      <section className="sec">
        <h2 className="sec-title">이렇게 읽었어요</h2>
        <p className="lead">{m.reason}</p>
        {m.source && (
          <p className="caption">
            {m.source === "jev" ? "Jev가 분류했어요" : m.source === "ai" ? "Claude가 분류했어요" : "AI를 쓰지 못해 키워드 규칙으로 분류했어요"}
          </p>
        )}
        {m.jev && (
          <p className="caption">
            Jev 판정: {GROUPS.find((x) => x.id === m.jev!.group)?.label} · 신뢰도 {Math.round(m.jev.confidence * 100)}%
            {m.jev.accepted ? " (기준 이상, Jev 판정 사용)" : " (기준 미만, Claude가 다시 분류)"}
          </p>
        )}
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

const SAMPLE = [
  "안녕하세요 에이블랩입니다! 신제품 토너 릴스 1건에 광고비 80만원 제안드려요. 11/18까지 회신 부탁드립니다.",
  "언니 영상 보고 루틴 따라 했는데 피부결이 달라졌어요 ㅠㅠ 응원해요!",
  "[당첨 안내] 협찬 이벤트 당첨! 배송비 3,900원만 먼저 결제해 주시면 정품을 보내드려요 bit.ly/abcd",
  "어제 공구로 주문한 세트 아직 배송이 안 왔어요. 언제 받을 수 있나요?",
].join("\n\n");

function Paste({ onDone }: { onDone: (added: Msg[], usage: ClassifyUsage) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const items = text.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean);

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      const stamp = Date.now();
      const res = await fetch("/api/classify", {
        method: "POST",
        body: JSON.stringify({ messages: items.map((t, i) => ({ id: `p${stamp}-${i}`, text: t })) }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "분류하지 못했어요");
      const data = (await res.json()) as ClassifyResponse;
      onDone(
        data.results.map((r, i) => ({
          id: r.id,
          name: `붙여넣은 DM ${i + 1}`,
          handle: "",
          ago: "방금",
          text: items[i],
          group: r.group,
          reply: r.reply,
          urgency: r.urgency,
          terms: r.terms,
          termsNote: r.termsNote || undefined,
          reason: r.reason,
          pasted: true,
          source: r.source,
          jev: r.jev,
        })),
        data.usage,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "분류하지 못했어요");
    }
    setBusy(false);
  };

  if (busy)
    return (
      <section className="sec">
        <div className="loading">
          <div className="bar">
            <i />
          </div>
          DM을 하나씩 읽고 있어요
        </div>
      </section>
    );

  return (
    <>
      <section className="sec">
        <h1 className="page-title">DM 붙여넣기</h1>
        <p className="lead">DM 사이에 빈 줄을 하나 넣어 주세요. 한 번에 20개까지 분류해요.</p>
        <div className="field">
          <textarea
            className="textarea"
            placeholder={"받은 DM을 붙여넣어 주세요.\n\n빈 줄로 DM을 나눠요."}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <button className="link-btn" style={{ marginTop: 6 }} onClick={() => setText(SAMPLE)}>
          샘플 DM 4개 넣기
        </button>
        {items.length > 0 && <p className="caption">DM {items.length}개로 읽었어요</p>}
        {err && <p className="err">{err}</p>}
      </section>
      <div className="cta">
        <button className="btn" disabled={items.length === 0 || items.length > 20} onClick={submit}>
          분류하기
        </button>
      </div>
    </>
  );
}
