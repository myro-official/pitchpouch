"use client";

import { useState } from "react";
import { IconBack } from "./icons";

const pad = (n: number) => String(n).padStart(2, "0");
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

// 시작일과 종료일을 차례로 눌러 고르는 달력. 날짜는 모두 yyyy-mm-dd 문자열이라 크기 비교가 곧 날짜 비교다.
export function RangeCalendar({
  today,
  from,
  to,
  onChange,
}: {
  today: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const [view, setView] = useState(() => {
    const d = from || today;
    return { y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) - 1 };
  });
  const lead = new Date(view.y, view.m, 1).getDay();
  const count = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [...Array.from({ length: lead }, () => 0), ...Array.from({ length: count }, (_, i) => i + 1)];
  const viewIdx = view.y * 12 + view.m;
  const todayIdx = Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 1;
  const move = (d: number) =>
    setView(({ y, m }) => {
      const t = y * 12 + m + d;
      return { y: Math.floor(t / 12), m: t % 12 };
    });

  // 처음 누르거나 범위가 이미 정해졌으면 새 시작일. 그다음 누른 날과의 사이를 순서와 상관없이 범위로 잡는다.
  // 같은 날을 두 번 누르면 선택을 취소한다.
  const pick = (k: string) => {
    if (k > today) return;
    if (!from || to) onChange(k, "");
    else if (k === from) onChange("", "");
    else onChange(k < from ? k : from, k < from ? from : k);
  };

  return (
    <div className="cal">
      <div className="cal-head">
        <button aria-label="이전 달" onClick={() => move(-1)}>
          <IconBack size={18} />
        </button>
        <b>
          {view.y}년 {view.m + 1}월
        </b>
        <button aria-label="다음 달" disabled={viewIdx >= todayIdx} onClick={() => move(1)}>
          <span style={{ display: "grid", transform: "rotate(180deg)" }}>
            <IconBack size={18} />
          </span>
        </button>
      </div>
      <div className="cal-grid">
        {DOW.map((d) => (
          <span key={d} className="cal-dow">
            {d}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const k = `${view.y}-${pad(view.m + 1)}-${pad(d)}`;
          const off = k > today;
          const edge = k === from || k === to;
          const inside = Boolean(from && to && k > from && k < to);
          // 시작·끝 칸은 띠를 반쪽만 그려 사이 날짜의 띠와 이어지게 한다. 줄 첫 칸·끝 칸에서는 띠를 둥글게 닫는다.
          const span = Boolean(from && to && from !== to);
          const col = (lead + d - 1) % 7;
          const cls = [
            "cal-day",
            off && "off",
            edge && "edge",
            inside && "in",
            span && k === from && "start",
            span && k === to && "end",
            col === 0 && "row-first",
            col === 6 && "row-last",
            k === today && "today",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button key={k} className={cls} disabled={off} aria-pressed={edge} onClick={() => pick(k)}>
              <span className="cal-num">{d}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
