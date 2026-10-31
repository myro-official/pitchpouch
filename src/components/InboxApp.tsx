"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  type ClassifyResponse,
  type ClassifyUsage,
  DEMO,
  type GroupId,
  GROUPS,
  type Msg,
} from "@/lib/inbox";
import { IconBack, IconChat, IconCheck, IconEmpty, IconInbox, IconSettings, IconShield } from "./icons";

type Tab = "inbox" | "settings";
type Filter = "all" | GroupId;

// 인스타를 연결하면 Meta에서 받아올 프로필. 사진이 없으면 이름의 첫 글자를 보여 준다.
const ME = { name: "뷰티민", handle: "beauty.min", followers: "7.2만", picture: "/profile.jpg" };

type Sort = "urgent" | "latest";
type Status = "all" | "unread";
type Preset = "all" | "today" | "7d" | "30d" | "custom";
type Range = { preset: Preset; from: string; to: string };

const PRESETS: Record<Exclude<Preset, "custom">, string> = { all: "전체 기간", today: "오늘", "7d": "최근 7일", "30d": "최근 30일" };
const SORTS: Record<Sort, string> = { urgent: "급한 순", latest: "최신순" };
const DAY = 86_400_000;

// 서버에서 만든 화면과 브라우저의 첫 화면이 같아야 해서, 서버는 고정 시각을 쓰고 브라우저는 마운트 뒤 실제 시각으로 바뀐다.
const DEMO_BASE = Date.parse("2026-11-01T09:00:00+09:00");
let clientNow = 0;
const useNow = () =>
  useSyncExternalStore(
    () => () => {},
    () => (clientNow ||= Date.now()),
    () => DEMO_BASE,
  );

function ago(min: number, now: number) {
  if (min < 60) return min < 2 ? "방금" : `${min}분 전`;
  if (min < 1440) return `${Math.floor(min / 60)}시간 전`;
  if (min < 2880) return "어제";
  const d = new Date(now - min * 60_000);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function inRange(m: Msg, r: Range, now: number) {
  const ts = now - m.minutesAgo * 60_000;
  if (r.preset === "all") return true;
  if (r.preset === "today") return ts >= new Date(now).setHours(0, 0, 0, 0);
  if (r.preset === "7d") return ts >= now - 7 * DAY;
  if (r.preset === "30d") return ts >= now - 30 * DAY;
  const from = r.from ? new Date(`${r.from}T00:00:00`).getTime() : -Infinity;
  const to = r.to ? new Date(`${r.to}T23:59:59.999`).getTime() : Infinity;
  return ts >= from && ts <= to;
}

const ymd = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const short = (d: string) => (d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : "");
const rangeLabel = (r: Range) =>
  r.preset === "custom" ? `${short(r.from) || "처음"} ~ ${short(r.to) || "오늘"}` : PRESETS[r.preset];

const URGENCY = ["여유", "며칠 안에", "이번 주", "오늘 안에"];
const GROUP_LINE: Record<GroupId, string> = {
  gain: "조건을 보고 수락 여부를 정하는 제안이에요.",
  rel: "사람과 이어지는 연락이에요.",
  todo: "직접 확인하고 답해 줘야 하는 일이에요.",
  junk: "답하지 않아도 되는 메시지예요.",
};

// 개발자 모드: 분류 근거, 사용량 안내, DM 직접 분류 도구를 보여 준다. 저장이 막힌 브라우저에서도 이번 방문 동안은 동작한다.
const DEV_KEY = "pitchpouch_dev";
const DEV_EVENT = "pitchpouch-dev";
let devMemory: boolean | null = null;
function readDev() {
  if (devMemory !== null) return devMemory;
  try {
    return localStorage.getItem(DEV_KEY) === "1";
  } catch {
    return false;
  }
}
function setDev(on: boolean) {
  devMemory = on;
  try {
    localStorage.setItem(DEV_KEY, on ? "1" : "0");
  } catch {}
  window.dispatchEvent(new Event(DEV_EVENT));
}
function subscribeDev(cb: () => void) {
  window.addEventListener(DEV_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(DEV_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
const useDev = () => useSyncExternalStore(subscribeDev, readDev, () => false);

const groupClass = (id: GroupId) => `c-${GROUPS.find((g) => g.id === id)?.tone || "none"}`;

// 급한 순은 같은 급함 안에서 최신순, 최신순은 받은 시각만 본다
const sorter = (sort: Sort) => (a: Msg, b: Msg) =>
  sort === "latest" ? a.minutesAgo - b.minutesAgo : b.urgency - a.urgency || a.minutesAgo - b.minutesAgo;

function Pills({ m }: { m: Msg }) {
  return (
    <div className="pills">
      {m.reply && <i>답장 필요</i>}
      {m.urgency >= 2 && <i className="warn">{m.urgency === 3 ? "오늘 안에" : "이번 주"}</i>}
      {m.terms && <i>조건 있음</i>}
    </div>
  );
}

// 0에서(값이 바뀌면 지금 값에서) 목표까지 빠르게 올라가는 숫자. 서버와 첫 화면을 맞추려고 0부터 시작한다.
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    let id = 0;
    if (start === value || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = value;
      id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      const v = Math.round(start + (value - start) * (1 - Math.pow(1 - p, 3)));
      from.current = v;
      setShown(v);
      if (p < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [value]);
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{shown}</span>;
}

export function InboxApp() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [filter, setFilter] = useState<Filter>("all");
  const [junkOpen, setJunkOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, GroupId>>({});
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState(false);
  const [panel, setPanel] = useState<"range" | "sort" | null>(null);
  const [settingsView, setSettingsView] = useState<"main" | "paste">("main");
  const dev = useDev();
  const [sort, setSort] = useState<Sort>("urgent");
  const [status, setStatus] = useState<Status>("all");
  const [range, setRange] = useState<Range>({ preset: "all", from: "", to: "" });
  const [draft, setDraft] = useState({ from: "", to: "" });
  const [readSet, setReadSet] = useState<Set<string>>(new Set());
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [connected, setConnected] = useState(true);
  const [linking, setLinking] = useState(false);
  const [toast, setToast] = useState("");
  const [extra, setExtra] = useState<Msg[]>([]);
  const [usage, setUsage] = useState<ClassifyUsage | null>(null);

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

  const now = useNow();
  const msgs = useMemo<Msg[]>(
    () =>
      [...live, ...extra, ...DEMO].map((m) => ({
        ...m,
        group: overrides[m.id] ?? m.group,
        read: m.read || readSet.has(m.id),
      })),
    [live, extra, overrides, readSet],
  );
  const open = msgs.find((m) => m.id === openId) ?? null;

  const goHome = useCallback(() => {
    setOpenId(null);
    setSheet(false);
    setPanel(null);
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
    setReadSet((r) => new Set(r).add(id));
    setOpenId(id);
    if (!history.state?.pp) history.pushState({ pp: 1 }, "");
    window.scrollTo({ top: 0 });
  };
  // 목업이라 이동은 안내만 한다. 연동 후에는 해당 대화방 링크로 바꾼다.
  const goChat = (m: Msg) => showToast(m.pasted ? "연동하면 이 DM의 채팅방으로 이동해요" : `@${m.handle} 채팅방으로 이동해요`);
  const addPasted = (added: Msg[], u: ClassifyUsage) => {
    setExtra([...added, ...extra]);
    setUsage(u);
    setSettingsView("main");
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

  const today = ymd(now);
  const inPeriod = msgs.filter((m) => inRange(m, range, now));
  const unreadN = inPeriod.filter((m) => !m.read).length;
  const needReply = inPeriod.filter((m) => m.reply).length;
  const urgent = inPeriod.filter((m) => m.urgency >= 2).length;
  const withTerms = inPeriod.filter((m) => m.terms).length;
  const unreadAll = msgs.filter((m) => !m.read).length;
  const scoped = inPeriod.filter((m) => (status === "unread" ? !m.read : true));
  const inGroup = (g: GroupId) => scoped.filter((m) => m.group === g);
  const visible = (g: GroupId) => inGroup(g).sort(sorter(sort));

  const Row = ({ m }: { m: Msg }) => {
    const hidden = m.group === "junk" && !revealed.has(m.id);
    return (
      <div className={`item ${m.read ? "" : "unread"}`}>
        <button className="row-main" onClick={() => openMsg(m.id)}>
          <span className="tile">{m.name.slice(0, 1)}</span>
          <span className="tx">
            <b>
              {!m.read && <i className="udot" aria-label="안 읽음" />}
              {m.name}
            </b>
            <small>{hidden ? "걸러낸 메시지라 가려 뒀어요" : m.text}</small>
            <Pills m={m} />
          </span>
          <span className="caption">{ago(m.minutesAgo, now)}</span>
        </button>
        <button className="go" aria-label="채팅방으로 이동" onClick={() => goChat(m)}>
          <IconChat size={20} />
        </button>
      </div>
    );
  };

  const filters: [Filter, string, number][] = [
    ["all", "전체", scoped.length],
    ...GROUPS.map((g) => [g.id, g.label, inGroup(g.id).length] as [Filter, string, number]),
  ];
  const statuses: [Status, string][] = [
    ["all", "전체"],
    ["unread", `안 읽음 ${unreadN}`],
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
      </header>

      {open ? (
        <Detail
          m={open}
          shown={open.group !== "junk" || revealed.has(open.id)}
          onReveal={() => setRevealed(new Set([...revealed, open.id]))}
          now={now}
          dev={dev}
          onBack={() => history.back()}
          onChange={() => setSheet(true)}
          onGo={() => goChat(open)}
        />
      ) : tab === "inbox" ? (
        <section className="sec">
          {connected ? (
            <>
              <div className="profile">
                {ME.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="avatar" src={ME.picture} alt="" />
                ) : (
                  <span className="avatar">{ME.name.slice(0, 1)}</span>
                )}
                <div>
                  <b>{ME.name}</b>
                  <small>
                    @{ME.handle} · 팔로워 {ME.followers}
                  </small>
                </div>
              </div>
              <p className="counts">
                DM <CountUp value={inPeriod.length} />개 · 안 읽은 건 <CountUp value={unreadN} />개
              </p>
            </>
          ) : (
            <h1 className="page-title">
              DM <CountUp value={inPeriod.length} />개,
              <br />
              안 읽은 건 <CountUp value={unreadN} />개예요
            </h1>
          )}
          {dev && usage && (
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
              <small>답장할 것</small>
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

          <div className="seg" style={{ marginTop: 14, ["--n" as string]: 2, ["--i" as string]: statuses.findIndex(([k]) => k === status) }}>
            <div className="thumb" />
            {statuses.map(([k, label]) => (
              <button key={k} className={status === k ? "on" : ""} onClick={() => setStatus(k)}>
                {label}
              </button>
            ))}
          </div>

          <div className="title-row" style={{ marginTop: 10 }}>
            <button className="sort-btn" onClick={() => setPanel("range")}>
              기간 · {rangeLabel(range)} ▾
            </button>
            <button className="sort-btn" onClick={() => setPanel("sort")}>
              {SORTS[sort]} ▾
            </button>
          </div>

          {shown.map((g) => {
            const list = visible(g.id);
            const collapsed = filter === "all" && g.id === "junk" && !junkOpen;
            const lim = limits[g.id] ?? (filter === "all" ? 8 : 30);
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
                      list.slice(0, lim).map((m) => <Row key={m.id} m={m} />)
                    )}
                    {list.length > lim && (
                      <button className="btn ghost sm more" onClick={() => setLimits({ ...limits, [g.id]: lim + 30 })}>
                        {list.length - lim}개 더 보기
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ) : settingsView === "paste" ? (
        <>
          <section className="sec" style={{ paddingBottom: 0 }}>
            <button className="link-btn" onClick={() => setSettingsView("main")} style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: -6 }}>
              <IconBack size={18} /> 설정
            </button>
          </section>
          <Paste onDone={addPasted} />
        </>
      ) : (
        <Settings
          connected={connected}
          linking={linking}
          onLink={link}
          onUnlink={() => setConnected(false)}
          dev={dev}
          onDev={setDev}
          onPaste={() => setSettingsView("paste")}
        />
      )}

      <nav className="tabbar">
        {(
          [
            ["inbox", "보관함", <IconInbox key="i" />],
            ["settings", "설정", <IconSettings key="s" />],
          ] as const
        ).map(([key, label, icon]) => (
          <button
            key={key}
            className={tab === key && !open ? "on" : ""}
            onClick={() => {
              goHome();
              setSettingsView("main");
              setTab(key);
              window.scrollTo({ top: 0 });
            }}
          >
            {icon}
            {label}
            {key === "inbox" && unreadAll > 0 && <span className="dot">{unreadAll > 99 ? "99+" : unreadAll}</span>}
          </button>
        ))}
      </nav>

      <Sheet open={sheet && !!open} title="분류 바꾸기" onClose={() => setSheet(false)}>
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
      </Sheet>

      <Sheet open={panel === "sort"} title="정렬" onClose={() => setPanel(null)}>
        <div className="sheet-list">
          {(Object.keys(SORTS) as Sort[]).map((k) => (
            <button
              key={k}
              className={`sheet-opt ${sort === k ? "on" : ""}`}
              onClick={() => {
                setSort(k);
                setPanel(null);
              }}
            >
              <span>
                {SORTS[k]}
                <small className="opt-desc">{k === "urgent" ? "급한 정도가 높은 순, 같으면 최신순" : "받은 시각이 가까운 순"}</small>
              </span>
              {sort === k && <IconCheck size={18} />}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={panel === "range"} title="기간" onClose={() => setPanel(null)}>
        <div className="sheet-list">
          {(Object.keys(PRESETS) as Exclude<Preset, "custom">[]).map((k) => (
            <button
              key={k}
              className={`sheet-opt ${range.preset === k ? "on" : ""}`}
              onClick={() => {
                setRange({ preset: k, from: "", to: "" });
                setPanel(null);
              }}
            >
              {PRESETS[k]}
              {range.preset === k && <IconCheck size={18} />}
            </button>
          ))}
        </div>
        <p className="group-title">직접 설정</p>
        <div className="field row2" style={{ marginTop: 8 }}>
          <div>
            <label className="label">시작일</label>
            <input
              className="input date"
              type="date"
              value={draft.from}
              max={draft.to && draft.to < today ? draft.to : today}
              onChange={(e) => {
                const max = draft.to && draft.to < today ? draft.to : today;
                setDraft({ ...draft, from: e.target.value > max ? max : e.target.value });
              }}
            />
          </div>
          <div>
            <label className="label">종료일</label>
            <input
              className="input date"
              type="date"
              value={draft.to}
              min={draft.from || undefined}
              max={today}
              onChange={(e) => {
                const v = e.target.value;
                setDraft({ ...draft, to: v > today ? today : draft.from && v && v < draft.from ? draft.from : v });
              }}
            />
          </div>
        </div>
        <button
          className="btn"
          style={{ marginTop: 16 }}
          disabled={!draft.from && !draft.to}
          onClick={() => {
            const [from, to] = draft.from && draft.to && draft.from > draft.to ? [draft.to, draft.from] : [draft.from, draft.to];
            setRange({ preset: "custom", from, to });
            setPanel(null);
          }}
        >
          이 기간으로 보기
        </button>
      </Sheet>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Detail({
  m,
  shown,
  onReveal,
  now,
  dev,
  onBack,
  onChange,
  onGo,
}: {
  m: Msg;
  shown: boolean;
  onReveal: () => void;
  now: number;
  dev: boolean;
  onBack: () => void;
  onChange: () => void;
  onGo: () => void;
}) {
  const g = GROUPS.find((x) => x.id === m.group)!;
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
          <button className={`badge pick ${groupClass(m.group)}`} onClick={onChange}>
            {g.label} ▾
          </button>
        </div>
        <p className="caption">
          {m.pasted ? "붙여넣은 DM" : `@${m.handle}`} · {ago(m.minutesAgo, now)}
          {m.minutesAgo >= 1440 && ` · ${new Date(now - m.minutesAgo * 60_000).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
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
        <h2 className="sec-title">한눈에 보기</h2>
        <p className="lead">{GROUP_LINE[m.group]}</p>
        <div className="stat-row">
          <div className="stat">
            <b>{m.reply ? "필요" : "불필요"}</b>
            <small>답장</small>
          </div>
          <div className={`stat ${m.urgency === 3 ? "hot" : m.urgency === 2 ? "mid" : ""}`}>
            <b>{URGENCY[m.urgency]}</b>
            <small>급한 정도</small>
          </div>
          <div className="stat">
            <b>{m.terms ? "있음" : "없음"}</b>
            <small>금액·조건</small>
          </div>
        </div>
        {m.termsNote && <div className="note" style={{ marginTop: 12 }}>적힌 조건: {m.termsNote}</div>}
        {dev && (
          <details className="dev">
            <summary>분류 근거 보기</summary>
            <p>{m.reason}</p>
            {m.source && (
              <p>{m.source === "jev" ? "Jev가 분류했어요" : m.source === "ai" ? "Claude가 분류했어요" : "AI를 쓰지 못해 키워드 규칙으로 분류했어요"}</p>
            )}
            {m.jev && (
              <p>
                Jev 판정: {m.jev.group === "unclear" ? "애매함" : GROUPS.find((x) => x.id === m.jev!.group)?.label} · 신뢰도 {Math.round(m.jev.confidence * 100)}%
                {m.jev.accepted
                  ? " (기준 이상, Jev 판정 사용)"
                  : m.jev.why === "unclear"
                    ? " (애매함으로 판정, Claude가 다시 분류)"
                    : m.jev.why === "risk" || m.jev.why === "veto"
                      ? " (사기 신호 감지, Claude가 다시 분류)"
                      : " (기준 미만, Claude가 다시 분류)"}
              </p>
            )}
          </details>
        )}
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

function Settings({
  connected,
  linking,
  onLink,
  onUnlink,
  dev,
  onDev,
  onPaste,
}: {
  connected: boolean;
  linking: boolean;
  onLink: () => void;
  onUnlink: () => void;
  dev: boolean;
  onDev: (on: boolean) => void;
  onPaste: () => void;
}) {
  return (
    <>
      <section className="sec" style={{ paddingBottom: 0 }}>
        <h1 className="page-title">설정</h1>
      </section>
      <Connect connected={connected} linking={linking} onLink={onLink} onUnlink={onUnlink} />
      <section className="sec">
        <h2 className="sec-title">개발자 모드</h2>
        <p className="lead">DM이 어떻게 분류되는지 확인하는 도구를 켜요.</p>
        <div className="group-row">
          <button className={`switch ${dev ? "on" : ""}`} onClick={() => onDev(!dev)} aria-label="개발자 모드">
            <i />
          </button>
          {dev ? "켜짐" : "꺼짐"}
        </div>
        {dev && (
          <>
            <button className="btn ghost" style={{ marginTop: 16 }} onClick={onPaste}>
              DM 직접 분류해 보기
            </button>
            <div className="pt" style={{ marginTop: 12 }}>
              <b>켜면 달라지는 것</b>
              <p>DM 상세 화면에 분류 근거(Jev 판정, 신뢰도, 판정 경로)가 보이고, 직접 분류한 뒤에는 사용량과 비용 안내가 떠요.</p>
            </div>
          </>
        )}
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
      <h2 className="sec-title">인스타 연결</h2>
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
          minutesAgo: 0,
          read: false,
          done: false,
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

function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className={`bsheet ${open ? "open" : ""}`}>
      <div className="bsheet-scrim" onClick={onClose} />
      <div className="bsheet-panel">
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
