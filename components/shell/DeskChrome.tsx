"use client";

import type { ReactNode } from "react";

export type DeskId = "trends" | "footprint" | "research" | "watchlist" | "insights" | "ai-agents";

const DESKS: { id: DeskId; href: string; label: string; blurb: string }[] = [
  { id: "trends", href: "/", label: "AI Agents", blurb: "LLM & Agent Intelligence" },
  { id: "watchlist", href: "/watchlist", label: "Compare", blurb: "Side-by-side analysis" },
  { id: "footprint", href: "/footprint", label: "Calculator", blurb: "Cost estimation" },
  { id: "insights", href: "/insights", label: "Insights", blurb: "Deep dive & trends" },
  { id: "research", href: "/research", label: "Research", blurb: "Market analysis" },
];

export function goHome() {
  window.location.assign("/");
}

export function HomeMark() {
  return (
    <a
      href="/"
      aria-label="hawkxai home"
      className="group flex shrink-0 items-center gap-2.5"
      onClick={(e) => {
        e.preventDefault();
        goHome();
      }}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/12 bg-white/[0.03] text-white/90 transition-colors duration-150 group-hover:border-white/25 group-hover:text-white">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
          <polygon
            points="8,1.5 14.5,5 14.5,11 8,14.5 1.5,11 1.5,5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
        </svg>
      </span>
      <span className="flex items-center gap-2">
        <span className="text-[18px] font-medium tracking-[-0.02em] text-white">hawkxai</span>
        <span className="signal-live" aria-label="Live" />
      </span>
    </a>
  );
}

function DeskLabel({ label, blurb }: { label: string; blurb: string }) {
  return (
    <>
      <span className="desk-nav__label">{label}</span>
      <span className="desk-nav__blurb">{blurb}</span>
    </>
  );
}

export function DeskNav({ active }: { active: DeskId }) {
  return (
    <nav className="desk-nav" aria-label="Desks">
      {DESKS.map((desk) => {
        const isActive = desk.id === active;
        const title = `${desk.label}: ${desk.blurb}`;
        if (isActive) {
          return (
            <span
              key={desk.id}
              className="desk-nav__item desk-nav__item--active"
              aria-current="page"
              title={title}
            >
              <DeskLabel label={desk.label} blurb={desk.blurb} />
            </span>
          );
        }
        return (
          <a
            key={desk.id}
            href={desk.href}
            className="desk-nav__item"
            title={title}
            onClick={
              desk.id === "trends"
                ? (e) => {
                    e.preventDefault();
                    goHome();
                  }
                : undefined
            }
          >
            <DeskLabel label={desk.label} blurb={desk.blurb} />
          </a>
        );
      })}
    </nav>
  );
}

export function StatusChip({ children }: { children: ReactNode }) {
  return <span className="status-chip">{children}</span>;
}

export function SegmentControl({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string; hint?: string; blurb?: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="segment" role="tablist">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          aria-label={opt.blurb ? `${opt.label}: ${opt.blurb}` : opt.label}
          title={opt.blurb ? `${opt.label}: ${opt.blurb}` : opt.label}
          onClick={() => onChange(opt.id)}
          className={`segment__item ${value === opt.id ? "segment__item--active" : ""}`}
        >
          <span className="segment__copy">
            <span className="segment__label">
              {opt.label}
              {opt.hint ? <kbd className="segment__kbd">{opt.hint}</kbd> : null}
            </span>
            {opt.blurb ? <span className="segment__blurb">{opt.blurb}</span> : null}
          </span>
        </button>
      ))}
    </div>
  );
}

export function DeskFrame({
  children,
  toolbar,
  context,
}: {
  children: ReactNode;
  toolbar?: ReactNode;
  context?: ReactNode;
}) {
  return (
    <header className="desk-chrome no-print">
      <div className="desk-chrome__bar">{children}</div>
      {toolbar ? <div className="desk-chrome__toolbar">{toolbar}</div> : null}
      {context ? <div className="desk-chrome__context">{context}</div> : null}
    </header>
  );
}

export function DeskShell({ children }: { children: ReactNode }) {
  return <main className="desk-shell">{children}</main>;
}

export function PrimaryButton({
  children,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} disabled={disabled} className="btn-primary">
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  disabled,
  onClick,
  type = "button",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} className="btn-ghost">
      {children}
    </button>
  );
}

export function FieldSelect({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field-select">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className="field-select__control"
      >
        {children}
      </select>
    </label>
  );
}
