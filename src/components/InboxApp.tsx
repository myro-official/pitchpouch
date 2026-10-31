"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { type GroupId, GROUPS, type Msg } from "@/lib/inbox";
import { RangeCalendar } from "./RangeCalendar";
import { createClient } from "@/lib/supabase/client";
import { IconBack, IconCalendar, IconCheck, IconClose, IconEmpty, IconLogo, IconSearch, IconSettings, IconSort } from "./icons";

type Tab = "inbox" | "settings";
type Filter = "all" | GroupId;

// 연결된 인스타 계정의 프로필(/api/profile). 사진이 없으면 이름의 첫 글자를 보여 준다.
type Profile = { name: string; handle: string; picture: string; followers: number };
const fmtFollowers = (n: number) => (n >= 10_000 ? `${(n / 10_000).toFixed(1).replace(/\.0$/, "")}만` : n.toLocaleString("ko-KR"));

type Sort = "urgent" | "latest";
type Status = "all" | "unread" | "read";
type Preset = "all" | "today" | "7d" | "30d" | "custom";
type Range = { preset: Preset; from: string; to: string };

const PRESETS: Record<Exclude<Preset, "custom">, string> = { all: "전체 기간", today: "오늘", "7d": "최근 7일", "30d": "최근 30일" };
const SORTS: Record<Sort, string> = { urgent: "급한 순", latest: "최신순" };
const PAGE = 10;
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

// 24시간 안은 지난 시간으로(방금 전, n분 전, n시간 전), 그 뒤는 달력 날짜로 센다: n일 전(6일까지), n주일 전(3주일까지), n달 전
function ago(min: number, now: number) {
  if (min < 1) return "방금 전";
  if (min < 60) return `${Math.floor(min)}분 전`;
  if (min < 1440) return `${Math.floor(min / 60)}시간 전`;
  const startOf = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const days = Math.round((startOf(now) - startOf(now - min * 60_000)) / DAY);
  if (days < 7) return `${days}일 전`;
  if (days < 28) return `${Math.floor(days / 7)}주일 전`;
  return `${Math.max(1, Math.floor(days / 30))}달 전`;
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


const groupClass = (id: GroupId) => `c-${GROUPS.find((g) => g.id === id)?.tone || "none"}`;

// 급한 순은 같은 급함 안에서 최신순, 최신순은 같은 시각 안에서 급한 순
const sorter = (sort: Sort) => (a: Msg, b: Msg) =>
  sort === "latest"
    ? a.minutesAgo - b.minutesAgo || b.urgency - a.urgency
    : b.urgency - a.urgency || a.minutesAgo - b.minutesAgo;


export function InboxApp() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [filter, setFilter] = useState<Filter>("all");
  // 전체 보기에서 접어 둔 그룹. 스팸은 처음부터 접혀 있다.
  const [folded, setFolded] = useState<Set<GroupId>>(() => new Set<GroupId>(["junk"]));
  const [openId, setOpenId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, GroupId>>({});
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState(false);
  const [panel, setPanel] = useState<"range" | null>(null);
  const [sort, setSort] = useState<Sort>("latest");
  const [status, setStatus] = useState<Status>("all");
  const [range, setRange] = useState<Range>({ preset: "all", from: "", to: "" });
  const [draft, setDraft] = useState({ from: "", to: "" });
  const [readSet, setReadSet] = useState<Set<string>>(new Set());
  const [paged, setPaged] = useState({ key: "", n: 1 });
  const [toast, setToast] = useState("");

  const [live, setLive] = useState<Msg[]>([]);
  const [authed, setAuthed] = useState<boolean | null>(null); // null: 아직 모름
  // 웹훅이 저장한 실제 인스타 DM을 5초마다 가져온다. 로그인 전이면 401이라 로그인 화면을 띄운다.
  const loadLive = useCallback(
    () =>
      fetch("/api/dms", { cache: "no-store" })
        .then((r) => {
          setAuthed(r.status !== 401);
          return r.ok ? r.json() : { dms: [] };
        })
        .then((j) => {
          const next: Msg[] = j.dms ?? [];
          // 내용이 같으면 기존 배열을 그대로 둬서 5초마다 화면 전체를 다시 그리지 않는다
          setLive((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
        })
        .catch(() => {}),
    [],
  );
  useEffect(() => {
    loadLive();
    const t = setInterval(loadLive, 5000);
    return () => clearInterval(t);
  }, [loadLive]);
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    if (!authed) return;
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setProfile(j.profile ?? null))
      .catch(() => {});
  }, [authed]);
  const logout = async () => {
    await createClient().auth.signOut();
    setLive([]);
    setProfile(null);
    setAuthed(false);
    setTab("inbox");
  };

  const now = useNow();
  const msgs = useMemo<Msg[]>(
    () =>
      live.map((m) => ({
        ...m,
        group: overrides[m.id] ?? m.group,
        read: m.read || readSet.has(m.id),
      })),
    [live, overrides, readSet],
  );
  const open = msgs.find((m) => m.id === openId) ?? null;

  const goHome = useCallback(() => {
    setOpenId(null);
    setSheet(false);
    setPanel(null);
    setTab("inbox");
    setFilter("all");
  }, []);
  useEffect(() => {
    // 돌아온 기록이 분류 화면이면 그 분류를 다시 연다
    const onPop = (e: PopStateEvent) => {
      goHome();
      if (e.state?.group) setFilter(e.state.group);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [goHome]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  };
  const openSettings = () => {
    if (tab === "settings" && !openId) return goHome();
    setOpenId(null);
    setSheet(false);
    setPanel(null);
    setTab("settings");
    if (!history.state?.pp) history.pushState({ pp: 1 }, "");
    window.scrollTo({ top: 0 });
  };
  // 결과는 토스트로 알리고 보냈는지만 돌려준다. 못 보내면 입력한 글을 남긴다.
  const sendReply = async (m: Msg, text: string) => {
    if (!m.senderId) {
      showToast("시연용 DM이라 보낼 수 없어요");
      return false;
    }
    const res = await fetch(`/api/dms/${encodeURIComponent(m.id)}/reply`, { method: "POST", body: JSON.stringify({ text }) });
    showToast(res.ok ? "메시지를 보냈어요" : (((await res.json().catch(() => ({}))) as { error?: string }).error ?? "보내지 못했어요."));
    return res.ok;
  };
  const openMsg = (id: string) => {
    setReadSet((r) => new Set(r).add(id));
    setOpenId(id);
    if (!history.state?.detail) history.pushState({ ...history.state, pp: 1, detail: 1 }, "");
    window.scrollTo({ top: 0 });
  };
  // 분류 화면은 기록을 하나 쌓아서 뒤로 가기로 보관함에 돌아온다. 분류끼리 옮길 때는 기록을 바꿔치기한다.
  const openGroup = (g: Filter) => {
    if (g === "all") return history.state?.group ? history.back() : setFilter("all");
    setFilter(g);
    if (history.state?.group) history.replaceState({ pp: 1, group: g }, "");
    else history.pushState({ pp: 1, group: g }, "");
    window.scrollTo({ top: 0 });
  };

  const today = ymd(now);
  const inPeriod = msgs.filter((m) => inRange(m, range, now));
  const scoped = inPeriod.filter((m) => (status === "all" ? true : status === "read" ? m.read : !m.read));
  const inGroup = (g: GroupId) => scoped.filter((m) => m.group === g);
  const visible = (g: GroupId) => inGroup(g).sort(sorter(sort));
  // 분류·정렬·읽음 상태·기간이 바뀌면 1쪽부터 보여 준다. DM을 열었다 돌아오면 보던 쪽을 유지한다.
  const pageKey = `${filter}|${sort}|${status}|${range.preset}|${range.from}|${range.to}`;
  const page = paged.key === pageKey ? paged.n : 1;
  const goPage = (n: number) => {
    setPaged({ key: pageKey, n });
    window.scrollTo({ top: 0 });
  };

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
            {!hidden && <small>{m.text}</small>}
          </span>
          <span className="caption">{ago(m.minutesAgo, now)}</span>
        </button>
      </div>
    );
  };

  const filters: [Filter, string, number][] = [
    ["all", "전체", scoped.length],
    ...GROUPS.map((g) => [g.id, g.label, inGroup(g.id).length] as [Filter, string, number]),
  ];
  const statuses: [Status, string][] = [
    ["all", "모든 DM"],
    ["unread", "안 읽음"],
    ["read", "읽음"],
  ];

  const shown = filter === "all" ? GROUPS : GROUPS.filter((g) => g.id === filter);
  // 보관함에서는 툴바에, 분류 화면에서는 분류 제목 줄에 놓는다
  const statusMenu = <Menu label="읽음 상태" value={status} options={statuses} onChange={setStatus} />;
  const rangeSort = (
    <>
      <button
        className={`tool-icon ${range.preset !== "all" ? "on" : ""}`}
        aria-label={`기간, 지금은 ${rangeLabel(range)}`}
        title={rangeLabel(range)}
        onClick={() => {
          setDraft(range.preset === "custom" ? { from: range.from, to: range.to } : { from: "", to: "" });
          setPanel("range");
        }}
      >
        <IconCalendar />
      </button>
      <Menu label="정렬" value={sort} options={(Object.keys(SORTS) as Sort[]).map((k) => [k, SORTS[k]])} onChange={setSort} icon={<IconSort />} />
    </>
  );

  return (
    <div className="app">
      <header className="top">
        <button
          className="brand home-btn"
          onClick={() => {
            goHome();
            if (history.state?.group) history.replaceState({ ...history.state, group: undefined }, "");
          }}
          aria-label="홈으로"
        >
          <span className="brand-mark" style={{ color: "var(--on-brand)" }}>
            <IconLogo />
          </span>
          PitchPouch
        </button>
        {!open && (tab === "settings" || filter !== "all") ? (
          <button
            className="link-btn"
            style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 15, height: 40 }}
            onClick={() => (tab === "settings" ? history.back() : openGroup("all"))}
          >
            <IconBack size={18} /> 보관함
          </button>
        ) : (
          <button className="icon-btn" onClick={openSettings} aria-label="설정">
            <IconSettings size={22} />
          </button>
        )}
      </header>

      {open ? (
        <Detail
          m={open}
          shown={open.group !== "junk" || revealed.has(open.id)}
          onReveal={() => setRevealed(new Set([...revealed, open.id]))}
          now={now}
          onBack={() => history.back()}
          onChange={() => setSheet(true)}
          onSend={(text) => sendReply(open, text)}
        />
      ) : tab === "inbox" && authed === false ? (
        <Login onDone={loadLive} onError={showToast} />
      ) : tab === "inbox" ? (
        <section className={filter === "all" ? "sec" : "sec sec-group"}>
          {filter !== "all" ? null : profile ? (
            <div className="profile">
              {profile.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="avatar" src={profile.picture} alt="" />
              ) : (
                <span className="avatar">{profile.name.slice(0, 1)}</span>
              )}
              <div>
                <b>{profile.name}</b>
                <small>
                  @{profile.handle} · 팔로워 {fmtFollowers(profile.followers)}
                </small>
              </div>
            </div>
          ) : (
            <h1 className="page-title">보관함</h1>
          )}
          {/* 분류를 옮기면 key가 바뀌어 검색어가 비워진다 */}
          <Search
            key={filter}
            pool={(filter === "all" ? scoped : inGroup(filter)).sort(sorter(sort))}
            revealed={revealed}
            showGroup={filter === "all"}
            onOpen={openMsg}
          />
          {filter === "all" && (
            <div className="toolbar">
              <Menu label="분류" value={filter} options={filters.map(([id, label]) => [id, label])} onChange={openGroup} />
              {statusMenu}
              <span style={{ flex: 1 }} />
              {rangeSort}
            </div>
          )}

          {shown.map((g) => {
            const list = visible(g.id);
            const collapsed = filter === "all" && folded.has(g.id);
            const pages = Math.ceil(list.length / PAGE);
            const cur = Math.min(page, Math.max(1, pages));
            const rows = filter === "all" ? list.slice(0, 5) : list.slice((cur - 1) * PAGE, cur * PAGE);
            return (
              <div key={g.id} className="group-block">
                <div className="title-row">
                  <p className="group-title">
                    {filter === "all" ? (
                      <button className="group-btn" onClick={() => openGroup(g.id)}>
                        {g.label}
                        <span>{list.length}</span>
                      </button>
                    ) : (
                      <>
                        {g.label}
                        <span>{list.length}</span>
                      </>
                    )}
                  </p>
                  {filter !== "all" ? (
                    <div className="toolbar">
                      {statusMenu}
                      {rangeSort}
                    </div>
                  ) : (
                    <button
                      className="link-btn"
                      style={{ marginTop: 18 }}
                      aria-expanded={!collapsed}
                      onClick={() =>
                        setFolded((f) => {
                          const next = new Set(f);
                          if (!next.delete(g.id)) next.add(g.id);
                          return next;
                        })
                      }
                    >
                      {collapsed ? "펼치기" : "접기"}
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
                      rows.map((m) => <Row key={m.id} m={m} />)
                    )}
                    {filter !== "all" ? (
                      <Pager page={cur} pages={pages} onPage={goPage} />
                    ) : (
                      list.length > rows.length && (
                        <button className="link-btn more" onClick={() => openGroup(g.id)}>
                          더보기
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ) : (
        <Settings onLogout={authed ? logout : undefined} />
      )}

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
                <span>{g.label}</span>
                {on && <IconCheck size={18} />}
              </button>
            );
          })}
        </div>
      </Sheet>

      <Sheet open={panel === "range"} title="기간" onClose={() => setPanel(null)}>
        <div className="cal-wrap">
          <div className="presets">
            {(Object.keys(PRESETS) as Exclude<Preset, "custom">[]).map((k) => (
              <button
                key={k}
                // 날짜를 직접 고르는 중이면 위쪽 선택 표시는 풀어 둔다
                className={!draft.from && range.preset === k ? "on" : ""}
                onClick={() => {
                  setRange({ preset: k, from: "", to: "" });
                  setPanel(null);
                }}
              >
                {PRESETS[k]}
              </button>
            ))}
          </div>
          {panel === "range" && <RangeCalendar today={today} from={draft.from} to={draft.to} onChange={(from, to) => setDraft({ from, to })} />}
          <div className="cal-foot">
            <span className="caption">{draft.from ? `${short(draft.from)}${draft.to ? ` ~ ${short(draft.to)}` : " 하루"}` : ""}</span>
            <button
              className="btn"
              disabled={!draft.from}
              onClick={() => {
                setRange({ preset: "custom", from: draft.from, to: draft.to || draft.from });
                setPanel(null);
              }}
            >
              선택
            </button>
          </div>
        </div>
      </Sheet>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function Detail({
  m,
  shown,
  onReveal,
  now,
  onBack,
  onChange,
  onSend,
}: {
  m: Msg;
  shown: boolean;
  onReveal: () => void;
  now: number;
  onBack: () => void;
  onChange: () => void;
  onSend?: (text: string) => Promise<boolean>;
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
          <button className={`badge pick ${groupClass(m.group)}`} onClick={onChange} aria-label={`분류 바꾸기, 지금은 ${g.label}`}>
            {g.label} <span className="caret" aria-hidden="true">▾</span>
          </button>
        </div>
        <p className="caption">
          @{m.handle} · {ago(m.minutesAgo, now)}
          {m.minutesAgo >= 1440 && ` · ${new Date(now - m.minutesAgo * 60_000).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
        </p>
        {shown ? (
          <div className="reply">{m.text}</div>
        ) : (
          <div className="reply">
            <button className="btn ghost sm" style={{ display: "flex" }} onClick={onReveal}>
              내용 보기
            </button>
          </div>
        )}
        {onSend && <Reply key={m.id} onSend={onSend} />}
      </section>
    </>
  );
}

function Settings({ onLogout }: { onLogout?: () => void }) {
  return (
    <section className="sec">
      <h1 className="page-title">설정</h1>
      {onLogout && (
        <button className="btn ghost" style={{ marginTop: 24 }} onClick={onLogout}>
          로그아웃
        </button>
      )}
    </section>
  );
}

const Chevron = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

// 검색어와 처음 같은 글자를 강조한다. 잘라 낸 문자열만 넣어서 HTML로 해석되지 않는다.
function highlight(text: string, needle: string) {
  const at = text.toLowerCase().indexOf(needle);
  if (!needle || at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  );
}

// 근로고래 검색창처럼 치는 동안 아래에 맞는 DM을 띄우고, 누르면 상세를 연다. 찾는 범위는 지금 화면의 필터를 따른다.
function Search({
  pool,
  revealed,
  showGroup,
  onOpen,
}: {
  pool: Msg[];
  revealed: Set<string>;
  showGroup: boolean;
  onOpen: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const needle = q.trim().replace(/^@/, "").toLowerCase();
  const hits = needle ? pool.filter((m) => [m.name, m.handle, m.text].some((s) => s?.toLowerCase().includes(needle))).slice(0, 8) : [];
  const pick = (id: string) => {
    setQ("");
    setOpen(false);
    onOpen(id);
  };

  return (
    <div className="search" ref={ref}>
      <IconSearch />
      <input
        // type="search"는 크롬에서 Esc를 누르면 검색어까지 지워서 text로 두고 키보드에만 검색 키를 띄운다
        type="text"
        enterKeyHint="search"
        className="search-input"
        aria-label="DM 검색"
        placeholder="이름, 아이디, 내용 검색"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && hits[0]) pick(hits[0].id);
        }}
      />
      {q && (
        <button
          className="search-clear"
          aria-label="검색어 지우기"
          onClick={() => {
            setQ("");
            setOpen(false);
          }}
        >
          <IconClose size={16} />
        </button>
      )}
      {open && needle && (
        <ul className="search-list" aria-label="검색 결과">
          {hits.length === 0 ? (
            <li className="search-none">검색 결과가 없어요</li>
          ) : (
            hits.map((m) => {
              // 스팸은 목록처럼 '내용 보기'를 누르기 전까지 내용을 가린다
              const hidden = m.group === "junk" && !revealed.has(m.id);
              // 일치한 곳이 뒤쪽이면 그 앞까지 잘라서 한 줄 안에 보이게 한다
              const at = m.text.toLowerCase().indexOf(needle);
              const text = at > 12 ? `…${m.text.slice(at - 8)}` : m.text;
              return (
                <li key={m.id}>
                  <button onClick={() => pick(m.id)}>
                    <span className="tx">
                      <b>
                        {highlight(m.name, needle)}
                        {m.handle && m.handle !== m.name && <span className="caption"> @{highlight(m.handle, needle)}</span>}
                      </b>
                      {!hidden && <small>{highlight(text, needle)}</small>}
                    </span>
                    {showGroup && <span className="caption">{GROUPS.find((g) => g.id === m.group)?.label}</span>}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

// 브라우저 기본 select 대신 앱 스타일로 그린 작은 선택 메뉴. 바깥을 누르거나 Esc로 닫힌다.
function Menu<T extends string>({
  label,
  value,
  options,
  onChange,
  icon,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  icon?: ReactNode; // 있으면 글자 대신 아이콘 버튼으로 열고, 목록은 버튼 오른쪽 끝에 맞춘다
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="menu" ref={ref}>
      {icon ? (
        <button
          className="tool-icon"
          aria-label={`${label}, 지금은 ${options.find(([k]) => k === value)?.[1]}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {icon}
        </button>
      ) : (
      <button className="menu-btn" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        {/* 모든 항목을 겹쳐 두고 선택된 것만 보여서, 버튼 폭이 가장 긴 항목에 맞고 목록 폭과 같아진다 */}
        <span className="menu-label">
          {options.map(([k, text]) => (
            <span key={k} className={k === value ? "" : "ghost"} aria-hidden={k !== value}>
              {text}
            </span>
          ))}
        </span>
        <Chevron />
      </button>
      )}
      {open && (
        <ul className={`menu-list${icon ? " pop" : ""}`} role="listbox" aria-label={label}>
          {options.map(([k, text]) => (
            <li key={k}>
              <button
                role="option"
                aria-selected={k === value}
                className={k === value ? "on" : ""}
                onClick={() => {
                  onChange(k);
                  setOpen(false);
                }}
              >
                {text}
                {k === value && <IconCheck size={16} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 쪽 번호는 지금 쪽을 가운데 두고 최대 5개까지 보여 주고, 양쪽 화살표는 첫 쪽과 마지막 쪽으로 간다
function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (n: number) => void }) {
  if (pages <= 1) return null;
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  return (
    <nav className="pager" aria-label="쪽 이동">
      <button disabled={page === 1} onClick={() => onPage(1)} aria-label="첫 쪽">
        ‹
      </button>
      {nums.map((n) => (
        <button key={n} className={n === page ? "on" : ""} aria-current={n === page ? "page" : undefined} onClick={() => onPage(n)}>
          {n}
        </button>
      ))}
      <button disabled={page === pages} onClick={() => onPage(pages)} aria-label="마지막 쪽">
        ›
      </button>
    </nav>
  );
}

function Reply({ onSend }: { onSend: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    const sent = await onSend(text.trim());
    setBusy(false);
    if (sent) setText("");
  };

  return (
    <div style={{ marginTop: 28 }}>
      <h2 className="sec-title">답장</h2>
      <textarea
        className="textarea"
        rows={3}
        maxLength={1000}
        aria-label="보낼 메시지"
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ marginTop: 12, minHeight: 96 }}
      />
      <button className="btn" style={{ marginTop: 12 }} disabled={busy || !text.trim()} onClick={send}>
        {busy ? "보내는 중" : "보내기"}
      </button>
    </div>
  );
}

function Login({ onDone, onError }: { onDone: () => void; onError: (msg: string) => void }) {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // 가입은 서버가 계정을 만든 뒤(/api/signup) 같은 이메일과 비밀번호로 바로 로그인한다.
  // Supabase는 이메일로만 로그인해서, @ 없이 친 아이디(demo1234)는 앱 도메인 주소로 바꾼다.
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const id = email.trim().toLowerCase();
    const mail = id.includes("@") ? id : `${id}@pitchpouch.app`;
    setBusy(true);
    if (signup) {
      const res = await fetch("/api/signup", { method: "POST", body: JSON.stringify({ email: mail, password }) });
      if (!res.ok) {
        setBusy(false);
        return onError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "가입하지 못했어요.");
      }
    }
    const { error } = await createClient().auth.signInWithPassword({ email: mail, password });
    setBusy(false);
    if (error) return onError("아이디나 비밀번호가 맞지 않아요.");
    onDone();
  };

  return (
    <section className="sec">
      <h1 className="page-title">{signup ? "회원가입" : "로그인"}</h1>
      <form onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="login-email">
            아이디
          </label>
          <input id="login-email" className="input" type="text" autoComplete="username" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="login-password">
            비밀번호
          </label>
          <input
            id="login-password"
            className="input"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            placeholder={signup ? "8자 이상" : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="btn" style={{ marginTop: 20, opacity: busy ? 1 : undefined }} disabled={busy || !email.trim() || password.length < (signup ? 8 : 1)}>
          {busy ? (signup ? "가입하는 중" : "로그인 중") : signup ? "가입하기" : "로그인"}
        </button>
      </form>
      <button
        className="link-btn"
        style={{ marginTop: 16 }}
        onClick={() => setSignup(!signup)}
      >
        {signup ? "로그인" : "회원가입"}
      </button>
    </section>
  );
}

// 화면 가운데에 띄우는 창. 바깥을 누르거나 Esc로 닫힌다.
function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <div className={`bsheet ${open ? "open" : ""}`}>
      <div className="bsheet-scrim" onClick={onClose} />
      <div className="bsheet-panel" role="dialog" aria-modal="true" aria-label={title}>
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
