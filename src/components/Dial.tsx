"use client";

import { useEffect, useRef, useState } from "react";

export type DialItem = { key: string; label: string; count: number; on: boolean; act: () => void };

// HairPass 스피드 다이얼: 누르면 소분류 버튼이 위로 펼쳐진다.
export function Dial({ items, title }: { items: DialItem[]; title: string }) {
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
  const active = items.some((i) => i.on && i.key !== "all");
  return (
    <div className={`dial ${open ? "open" : ""}`}>
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
            <span className="dc num">{it.count}</span>
          </button>
        ))}
      </div>
      <button ref={btn} className="dial-btn" aria-expanded={open} aria-label={open ? "닫기" : `${title} 분류 열기`} onClick={() => setOpen(!open)}>
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
