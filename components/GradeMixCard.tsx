"use client";

import { useState, useMemo, useEffect } from "react";
import type { YearlySummary, GradeStat } from "@/app/api/yearly-summary/route";

const GRADE_COLOR: Record<string, string> = {
  摘果: "oklch(0.65 0.18 25)",
  ASS:  "oklch(0.68 0.18 148)",
  AS:   "oklch(0.74 0.16 68)",
  AM:   "oklch(0.82 0.14 90)",
  B:    "oklch(0.72 0.12 215)",
  C:    "oklch(0.65 0.16 295)",
  D:    "oklch(0.60 0.05 30)",
  S:    "oklch(0.80 0.12 320)",
  M:    "oklch(0.75 0.10 180)",
};

/** 円グラフ専用の彩度高めのパレット(設計案A準拠) */
const DONUT_COLOR: Record<string, { color: string; glow: string }> = {
  AS:   { color: "#f59e0b", glow: "rgba(245,158,11,0.7)" },
  S:    { color: "#e879c9", glow: "rgba(232,121,201,0.7)" },
  AM:   { color: "#fbbf24", glow: "rgba(251,191,36,0.7)" },
  C:    { color: "#a78bfa", glow: "rgba(167,139,250,0.7)" },
  B:    { color: "#22d3ee", glow: "rgba(34,211,238,0.7)" },
  摘果: { color: "#f87171", glow: "rgba(248,113,113,0.7)" },
  ASS:  { color: "#34d399", glow: "rgba(52,211,153,0.7)" },
  D:    { color: "#94a3b8", glow: "rgba(148,163,184,0.7)" },
  M:    { color: "#5eead4", glow: "rgba(94,234,212,0.7)" },
};

type Selection = string;
type View = "bar" | "pie" | "stacked" | "compare";

const VIEW_OPTS: { id: View; label: string }[] = [
  { id: "bar",     label: "棒" },
  { id: "pie",     label: "円" },
  { id: "stacked", label: "帯" },
  { id: "compare", label: "比較" },
];

function formatYm(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

/** "YYYY-Www" → "YYYY年 Wn (M/d〜)" 表示用 */
function formatWeekKey(key: string, summary: YearlySummary): string {
  const m = key.match(/^(\d{4})-W(\d{1,2})$/);
  if (!m) return key;
  const wy = m[1];
  const wn = parseInt(m[2], 10);
  const arr = summary.weeklyByYear?.[wy];
  const wp = arr?.find((p) => p.week === wn);
  if (!wp) return `${wy}年 W${wn}`;
  const [, mm, dd] = wp.startDate.split("-");
  return `${wy}年 W${wn} (${parseInt(mm, 10)}/${parseInt(dd, 10)}〜)`;
}

export function GradeMixCard({ summary }: { summary: YearlySummary | null }) {
  const defaultValue = useMemo<Selection>(() => {
    if (!summary) return "year";
    const thisYm = `${summary.thisYear}-${String(summary.thisMonth).padStart(2, "0")}`;
    if (summary.availableMonths.includes(thisYm)) return `month:${thisYm}`;
    if (summary.thisYearGrades.length > 0) return "year";
    return "all";
  }, [summary]);

  const [selection, setSelection] = useState<Selection>(defaultValue);
  const [view, setView] = useState<View>("bar");
  const [compareYear, setCompareYear] = useState<string | null>(null);

  if (!summary) {
    return <div style={{ ...cardStyle, height: 240, animation: "pulse 1.5s ease-in-out infinite" }} />;
  }

  let grades: GradeStat[] = [];
  let scopeLabel = "";
  if (selection === "year") {
    grades = summary.thisYearGrades;
    scopeLabel = `${summary.thisYear}年 累計`;
  } else if (selection === "all") {
    grades = summary.allTimeGrades;
    scopeLabel = "全期間";
  } else if (selection.startsWith("month:")) {
    const ym = selection.slice("month:".length);
    grades = summary.gradesByMonth[ym] ?? [];
    scopeLabel = formatYm(ym);
  } else if (selection.startsWith("week:")) {
    const wk = selection.slice("week:".length);
    grades = summary.gradesByWeek?.[wk] ?? [];
    scopeLabel = formatWeekKey(wk, summary);
  }

  const totalQty = grades.reduce((s, g) => s + g.quantity, 0);
  const max = grades.reduce((m, g) => Math.max(m, g.quantity), 0);

  // 比較対象（compare ビュー時のみ使用）
  const baseYear =
    selection.startsWith("month:")
      ? selection.slice("month:".length).split("-")[0]
      : selection.startsWith("week:")
        ? selection.slice("week:".length).split("-W")[0]
        : String(summary.thisYear);

  const fallbackCompareYear =
    summary.availableYears.find((y) => String(y) !== baseYear)?.toString()
    ?? summary.lastYear.toString();
  const effectiveCompareYear =
    compareYear && compareYear !== baseYear ? compareYear : fallbackCompareYear;

  let compareGrades: GradeStat[] = [];
  let compareLabel = "";
  if (selection.startsWith("month:")) {
    const ym = selection.slice("month:".length);
    const mo = ym.split("-")[1];
    const otherYm = `${effectiveCompareYear}-${mo}`;
    compareGrades = summary.gradesByMonth[otherYm] ?? [];
    compareLabel = formatYm(otherYm);
  } else if (selection.startsWith("week:")) {
    const wk = selection.slice("week:".length);
    const wn = wk.split("-W")[1];
    const otherKey = `${effectiveCompareYear}-W${wn}`;
    compareGrades = summary.gradesByWeek?.[otherKey] ?? [];
    compareLabel = formatWeekKey(otherKey, summary);
  } else {
    compareGrades = summary.gradesByYear?.[effectiveCompareYear] ?? [];
    compareLabel = `${effectiveCompareYear}年 累計`;
  }

  return (
    <div data-grade-mix-card style={cardStyle}>
      <div className="flex items-center justify-between" data-grade-mix-header style={{ marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "oklch(0.68 0.18 148)" }} />
          等級ミックス
        </div>
        <div className="flex items-center" data-grade-mix-toolbar style={{ gap: 6, flexWrap: "wrap" }}>
          <div className="flex" style={{ background: "var(--surface-hover)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 2, gap: 1 }}>
            {VIEW_OPTS.map((o) => (
              <button
                key={o.id}
                onClick={() => setView(o.id)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 11, fontWeight: 500,
                  padding: "3px 10px", borderRadius: 6,
                  background: view === o.id ? "var(--green)" : "transparent",
                  color: view === o.id ? "#fff" : "var(--text-muted)",
                  transition: "all 0.15s",
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <select
            value={selection}
            onChange={(e) => setSelection(e.target.value as Selection)}
            style={{
              background: "var(--surface-hover)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text)",
              borderRadius: 8,
              padding: "5px 12px",
              fontSize: 12,
              fontFamily: "'Space Grotesk', sans-serif",
              cursor: "pointer",
              outline: "none",
              minWidth: 130,
            }}
          >
            <optgroup label="集計範囲">
              <option value="year">{summary.thisYear}年 累計</option>
              <option value="all">全期間</option>
            </optgroup>
            {summary.availableMonths.length > 0 && (
              <optgroup label="月別">
                {summary.availableMonths.map((ym) => (
                  <option key={ym} value={`month:${ym}`}>
                    {formatYm(ym)}
                  </option>
                ))}
              </optgroup>
            )}
            {summary.availableWeeks && summary.availableWeeks.length > 0 && (
              <optgroup label="週別 (日〜土)">
                {summary.availableWeeks.map((wk) => (
                  <option key={wk} value={`week:${wk}`}>
                    {formatWeekKey(wk, summary)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      {view === "compare" && (
        <div className="flex items-center" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>粒度</span>
          <div className="flex gap-1" style={{ background: "var(--surface-hover)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 2 }}>
            {([
              { id: "year",  label: "年" },
              { id: "month", label: "月" },
              { id: "week",  label: "週" },
            ] as const).map((g) => {
              const current =
                selection.startsWith("week:") ? "week" :
                selection.startsWith("month:") ? "month" :
                selection === "year" ? "year" : null;
              const active = current === g.id;
              const disabled =
                (g.id === "month" && summary.availableMonths.length === 0) ||
                (g.id === "week"  && (summary.availableWeeks?.length ?? 0) === 0);
              return (
                <button
                  key={g.id}
                  disabled={disabled}
                  onClick={() => {
                    if (g.id === "year") setSelection("year");
                    else if (g.id === "month") {
                      const latest = summary.availableMonths[0];
                      if (latest) setSelection(`month:${latest}`);
                    } else {
                      const latest = summary.availableWeeks?.[0];
                      if (latest) setSelection(`week:${latest}`);
                    }
                  }}
                  style={{
                    border: "none",
                    cursor: disabled ? "not-allowed" : "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 11, fontWeight: 500,
                    padding: "3px 10px", borderRadius: 6,
                    background: active ? "var(--green)" : "transparent",
                    color: active ? "#fff" : disabled ? "var(--text-dim)" : "var(--text-muted)",
                    opacity: disabled ? 0.5 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>比較対象</span>
          <select
            value={effectiveCompareYear}
            onChange={(e) => setCompareYear(e.target.value)}
            style={{
              background: "var(--surface-hover)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text)",
              borderRadius: 8,
              padding: "4px 10px",
              fontSize: 12,
              fontFamily: "'Space Grotesk', sans-serif",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {summary.availableYears
              .filter((y) => {
                if (selection === "year") return y !== summary.thisYear;
                if (selection.startsWith("month:")) {
                  const ym = selection.slice("month:".length);
                  return String(y) !== ym.split("-")[0];
                }
                if (selection.startsWith("week:")) {
                  const wk = selection.slice("week:".length);
                  return String(y) !== wk.split("-W")[0];
                }
                return true;
              })
              .map((y) => (
                <option key={y} value={String(y)}>{y}年</option>
              ))}
          </select>
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, fontFamily: "'Space Grotesk', sans-serif" }}>
        {scopeLabel} <span style={{ color: "var(--text-dim)" }}>· 合計 {totalQty.toLocaleString()} 箱</span>
      </div>

      {grades.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-dim)", padding: "20px 0", textAlign: "center" }}>
          この期間の出荷データはまだありません
        </div>
      ) : view === "pie" ? (
        <PieView grades={grades} totalQty={totalQty} />
      ) : view === "stacked" ? (
        <StackedBarView grades={grades} totalQty={totalQty} />
      ) : view === "compare" ? (
        <CompareView
          a={grades} aLabel={scopeLabel}
          b={compareGrades} bLabel={compareLabel}
        />
      ) : (
        <BarView grades={grades} max={max} totalQty={totalQty} />
      )}
    </div>
  );
}

function BarView({ grades, max, totalQty }: { grades: GradeStat[]; max: number; totalQty: number }) {
  const rows = grades.map((g) => {
    const pct = max > 0 ? (g.quantity / max) * 100 : 0;
    const sharePct = totalQty > 0 ? (g.quantity / totalQty) * 100 : 0;
    const color = GRADE_COLOR[g.grade] ?? "var(--text-muted)";
    return { ...g, pct, sharePct, color };
  });

  return (
    <>
      <div data-grade-bar-desktop style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((g) => (
          <div key={g.grade}>
            <div className="flex justify-between" data-grade-row style={{ marginBottom: 4, gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div className="flex items-center" style={{ gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", color: g.color, minWidth: 32 }}>
                  {g.grade}
                </span>
                <span style={{ fontSize: 12, fontFamily: "'Space Grotesk', sans-serif", color: "var(--text)" }}>
                  {g.quantity.toLocaleString()} 箱
                </span>
                <span style={{ fontSize: 11, fontFamily: "'Space Grotesk', sans-serif", color: "var(--text-dim)" }}>
                  ({g.sharePct.toFixed(1)}%)
                </span>
              </div>
              <div className="flex items-center" data-grade-price style={{ gap: 12, fontSize: 11, fontFamily: "'Space Grotesk', sans-serif", color: "var(--text-muted)", flexWrap: "wrap" }}>
                <span>単価 ¥{g.unitPrice != null ? g.unitPrice.toLocaleString() : "—"}</span>
                <span style={{ color: "var(--text-dim)" }}>総額 ¥{g.total.toLocaleString()}</span>
              </div>
            </div>
            <div style={{ height: 8, background: "var(--surface-hover)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                width: `${g.pct}%`,
                height: "100%",
                background: g.color,
                opacity: 0.85,
                transition: "width 0.4s ease",
                borderRadius: 4,
              }} />
            </div>
          </div>
        ))}
      </div>

      <div data-grade-bar-mobile>
        <div data-grade-vertical-chart>
          {rows.map((g) => {
            const barHeight = g.quantity > 0 ? Math.max(g.pct, 4) : 0;
            return (
              <div key={g.grade} data-grade-vertical-item>
                <div data-grade-vertical-percent style={{ color: g.sharePct >= 8 ? g.color : "var(--text-dim)" }}>
                  {g.sharePct >= 3 ? `${g.sharePct.toFixed(0)}%` : ""}
                </div>
                <div data-grade-vertical-track>
                  <div
                    data-grade-vertical-fill
                    style={{
                      height: `${barHeight}%`,
                      background: g.color,
                      boxShadow: g.quantity > 0 ? "0 0 16px rgba(0,0,0,0.22)" : undefined,
                    }}
                    title={`${g.grade}: ${g.quantity.toLocaleString()}箱 (${g.sharePct.toFixed(1)}%)`}
                  />
                </div>
                <div data-grade-vertical-label style={{ color: g.color }}>{g.grade}</div>
              </div>
            );
          })}
        </div>

        <div data-grade-mobile-list>
          {rows
            .slice()
            .sort((a, b) => b.quantity - a.quantity)
            .map((g) => (
              <div key={g.grade} data-grade-mobile-row>
                <div data-grade-mobile-grade style={{ color: g.color }}>
                  <span style={{ background: g.color }} />
                  {g.grade}
                </div>
                <div data-grade-mobile-main>
                  <span>{g.quantity.toLocaleString()}箱</span>
                  <span>{g.sharePct.toFixed(1)}%</span>
                </div>
                <div data-grade-mobile-amount>
                  <span>¥{g.total.toLocaleString()}</span>
                  <span>単価 ¥{g.unitPrice != null ? g.unitPrice.toLocaleString() : "—"}</span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}

type DonutDatum = GradeStat & { share: number; color: string; glow: string };

function donutColor(grade: string): { color: string; glow: string } {
  return DONUT_COLOR[grade] ?? { color: "#94a3b8", glow: "rgba(148,163,184,0.5)" };
}

function pol(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx: number, cy: number, r1: number, r2: number, a1: number, a2: number): string {
  const [sx1, sy1] = pol(cx, cy, r2, a2);
  const [sx2, sy2] = pol(cx, cy, r2, a1);
  const [sx3, sy3] = pol(cx, cy, r1, a1);
  const [sx4, sy4] = pol(cx, cy, r1, a2);
  const large = a2 - a1 > 180 ? 1 : 0;
  return `M ${sx1} ${sy1} A ${r2} ${r2} 0 ${large} 0 ${sx2} ${sy2} L ${sx3} ${sy3} A ${r1} ${r1} 0 ${large} 1 ${sx4} ${sy4} Z`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function PieView({ grades, totalQty }: { grades: GradeStat[]; totalQty: number }) {
  // 構成比降順で扇型を並べる(視認性: 大きいセグメントが上から右回りに)
  const data: DonutDatum[] = grades
    .map((g) => {
      const c = donutColor(g.grade);
      return { ...g, share: totalQty > 0 ? (g.quantity / totalQty) * 100 : 0, ...c };
    })
    .filter((d) => d.share > 0)
    .sort((a, b) => b.share - a.share);

  const { items: segs } = data.reduce(
    (state, d) => {
      const a1 = state.acc * 3.6;
      const nextAcc = state.acc + d.share;
      const a2 = nextAcc * 3.6;
      return {
        acc: nextAcc,
        items: [...state.items, { ...d, a1, a2, mid: (a1 + a2) / 2 }],
      };
    },
    { acc: 0, items: [] as (DonutDatum & { a1: number; a2: number; mid: number })[] },
  );

  const dataSignature = data.map((d) => `${d.grade}:${d.quantity}`).join("|");

  // エントリーアニメーション (0 → 1, ease-out cubic, 720ms)
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const elapsed = (t - start) / 720;
      const p = Math.min(1, elapsed);
      setProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    // 初期値ゼロから始める(マウント直後のみ同期 setState なので無視)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dataSignature]);

  const [active, setActive] = useState<string | null>(null);
  const cx = 200, cy = 200, r1 = 88, r2 = 146;

  const avgPrice = totalQty > 0
    ? Math.round(data.reduce((s, d) => s + (d.unitPrice ?? 0) * d.quantity, 0) / totalQty)
    : 0;

  if (segs.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-dim)", padding: "32px 0", textAlign: "center" }}>
        この期間の出荷データはまだありません
      </div>
    );
  }

  const activeSeg = active ? segs.find((s) => s.grade === active) : null;

  return (
    <div data-donut-wrap style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 上部の合計 / 平均単価 */}
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0.02em" }}>
        合計 <span style={{ color: "rgba(255,255,255,0.95)", fontWeight: 700 }}>{totalQty.toLocaleString()}</span> 箱 ·
        平均単価 <span style={{ color: "rgba(255,255,255,0.95)", fontWeight: 700 }}>¥{avgPrice.toLocaleString()}</span>
      </div>

      {/* SVG ドーナツ */}
      <svg viewBox="-48 -18 496 436" style={{ width: "100%", maxWidth: 460, alignSelf: "center", height: "auto", aspectRatio: "1 / 1", display: "block", overflow: "visible" }}>
        <defs>
          {segs.map((s) => (
            <radialGradient key={s.grade} id={`gA-${slugId(s.grade)}`} cx="0.5" cy="0.5" r="0.7">
              <stop offset="0%" stopColor={s.color} stopOpacity="1" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.7" />
            </radialGradient>
          ))}
          <filter id="glowA" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <radialGradient id="centerHaloA">
            <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* center halo */}
        <circle cx={cx} cy={cy} r={r1 + 6} fill="url(#centerHaloA)" />
        {/* outer + inner ring guides */}
        <circle cx={cx} cy={cy} r={r2 + 8} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={r1 - 6} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

        {/* glow layer */}
        {segs.map((s) => {
          const a2anim = s.a1 + (s.a2 - s.a1) * progress;
          const isActive = active === s.grade;
          if (a2anim - s.a1 < 0.6) return null;
          return (
            <path
              key={`g-${s.grade}`}
              d={arcPath(cx, cy, r1, r2 + (isActive ? 10 : 0), s.a1 + 0.3, a2anim - 0.3)}
              fill={s.color}
              opacity={isActive ? 0.7 : 0.35}
              filter="url(#glowA)"
              style={{ transition: "opacity 0.2s" }}
            />
          );
        })}

        {/* main segments */}
        {segs.map((s) => {
          const a2anim = s.a1 + (s.a2 - s.a1) * progress;
          const isActive = active === s.grade;
          if (a2anim - s.a1 < 0.6) return null;
          return (
            <path
              key={s.grade}
              d={arcPath(cx, cy, r1, r2 + (isActive ? 10 : 0), s.a1 + 0.3, a2anim - 0.3)}
              fill={`url(#gA-${slugId(s.grade)})`}
              stroke="rgba(0,0,0,0.5)"
              strokeWidth="1"
              opacity={!active || isActive ? 1 : 0.4}
              onMouseEnter={() => setActive(s.grade)}
              onMouseLeave={() => setActive(null)}
              style={{ cursor: "pointer", transition: "all 0.25s" }}
            />
          );
        })}

        {/* outer rim highlight */}
        {segs.map((s) => {
          const a2anim = s.a1 + (s.a2 - s.a1) * progress;
          const isActive = active === s.grade;
          if (a2anim - s.a1 < 0.6) return null;
          return (
            <path
              key={`r-${s.grade}`}
              d={arcPath(cx, cy, r2 - 4 + (isActive ? 10 : 0), r2 + (isActive ? 10 : 0), s.a1 + 0.3, a2anim - 0.3)}
              fill={s.color}
              opacity={!active || isActive ? 0.85 : 0.3}
              style={{ pointerEvents: "none", transition: "all 0.25s" }}
            />
          );
        })}

        {/* leader lines + labels (>=8%) */}
        {segs.filter((s) => s.share >= 8).map((s) => {
          const [lx1, ly1] = pol(cx, cy, r2 + 12, s.mid);
          const [lx2, ly2] = pol(cx, cy, r2 + 30, s.mid);
          const right = lx2 > cx;
          const lx3 = clamp(right ? lx2 + 14 : lx2 - 14, 30, 370);
          const textX = lx3 + (right ? 6 : -6);
          const labelOpacity = clamp((progress - 0.55) / 0.35, 0, 1);
          return (
            <g key={`L-${s.grade}`} opacity={labelOpacity} style={{ pointerEvents: "none", transition: "opacity 0.18s ease" }}>
              <line x1={lx1} y1={ly1} x2={lx2} y2={ly2} stroke={s.color} strokeWidth="1.3" opacity="0.7" />
              <line x1={lx2} y1={ly2} x2={lx3} y2={ly2} stroke={s.color} strokeWidth="1.3" opacity="0.7" />
              <circle cx={lx1} cy={ly1} r="2.5" fill={s.color} />
              <text x={textX} y={ly2 - 4} textAnchor={right ? "start" : "end"} fill="#fff" fontSize="13" fontWeight="800" fontFamily="'Noto Sans JP', sans-serif">
                {s.grade}
              </text>
              <text x={textX} y={ly2 + 13} textAnchor={right ? "start" : "end"} fill={s.color} fontSize="12" fontWeight="700" fontFamily="'Space Grotesk', sans-serif">
                {s.share.toFixed(1)}%
              </text>
            </g>
          );
        })}

        {/* center text */}
        {activeSeg ? (
          <g style={{ pointerEvents: "none" }}>
            <text x={cx} y={cy - 22} textAnchor="middle" fill={activeSeg.color} fontSize="20" fontWeight="900" fontFamily="'Noto Sans JP', sans-serif">
              {activeSeg.grade}
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" fill="#fff" fontSize="32" fontWeight="700" fontFamily="'Space Grotesk', sans-serif" letterSpacing="-1">
              {activeSeg.share.toFixed(1)}%
            </text>
            <text x={cx} y={cy + 28} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="11" fontFamily="'Space Grotesk', sans-serif">
              {activeSeg.quantity.toLocaleString()} 箱{activeSeg.unitPrice != null ? ` · ¥${activeSeg.unitPrice.toLocaleString()}` : ""}
            </text>
          </g>
        ) : (
          <g style={{ pointerEvents: "none" }}>
            <text x={cx} y={cy - 18} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="9" fontFamily="'Space Grotesk', sans-serif" letterSpacing="3">
              TOTAL
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" fill="#fff" fontSize="36" fontWeight="700" fontFamily="'Space Grotesk', sans-serif" letterSpacing="-1">
              {totalQty.toLocaleString()}
            </text>
            <text x={cx} y={cy + 32} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="11" fontFamily="'Noto Sans JP', sans-serif">
              箱
            </text>
          </g>
        )}
      </svg>

      {/* 凡例(等級別 内訳) */}
      <div style={{ width: "100%", marginTop: 4 }}>
        <div style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          marginBottom: 6,
          paddingLeft: 4,
          fontFamily: "'Space Grotesk', sans-serif",
        }}>
          等級別 内訳
        </div>
        {segs.map((s) => {
          const isActive = active === s.grade;
          return (
            <div
              key={s.grade}
              onMouseEnter={() => setActive(s.grade)}
              onMouseLeave={() => setActive(null)}
              style={{
                display: "grid",
                gridTemplateColumns: "14px 56px 1fr auto",
                gap: 12,
                alignItems: "center",
                padding: "10px 8px",
                fontSize: 13,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                cursor: "pointer",
                borderRadius: 8,
                background: isActive ? "rgba(255,255,255,0.05)" : "transparent",
                transition: "background 0.15s ease",
              }}
            >
              <div style={{ width: 12, height: 12, borderRadius: 4, background: s.color, boxShadow: `0 0 10px ${s.glow}` }} />
              <div style={{ fontWeight: 700, fontSize: 14, color: s.color }}>{s.grade}</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: "#fff" }}>
                {s.share.toFixed(1)}%
              </div>
              <div style={{
                fontSize: 11, color: "rgba(255,255,255,0.55)",
                fontFamily: "'Space Grotesk', sans-serif",
                textAlign: "right", lineHeight: 1.4,
              }}>
                {s.quantity.toLocaleString()} 箱
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
                  ¥{s.unitPrice != null ? s.unitPrice.toLocaleString() : "—"} / 箱
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function slugId(grade: string): string {
  // 日本語等級(摘果)を id 安全な文字に変換
  return grade.replace(/[^A-Za-z0-9]/g, (c) => `_${c.charCodeAt(0).toString(16)}`);
}

function StackedBarView({ grades, totalQty }: { grades: GradeStat[]; totalQty: number }) {
  const [active, setActive] = useState<string | null>(null);

  const data = grades.map((g) => ({
    ...g,
    share: totalQty > 0 ? (g.quantity / totalQty) * 100 : 0,
    color: GRADE_COLOR[g.grade] ?? "var(--text-muted)",
  }));

  // 上下ラベルの中央位置を事前計算
  const positioned = data.reduce<(typeof data[number] & { center: number; end: number })[]>((items, d) => {
    const start = items.at(-1)?.end ?? 0;
    const end = start + d.share;
    items.push({ ...d, center: start + d.share / 2, end });
    return items;
  }, []);

  const activeData = active ? positioned.find((d) => d.grade === active) ?? null : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 案D: ミニマル・スレッド */}
      <div>
        {/* top: 等級ラベル(>=4% のみ) */}
        <div style={{ position: "relative", height: 28 }}>
          {positioned.map((d) => {
            if (d.share < 4) return null;
            const isActive = active === d.grade;
            const dimmed = active && !isActive;
            return (
              <div
                key={d.grade}
                style={{
                  position: "absolute",
                  left: `${d.center}%`,
                  transform: "translateX(-50%)",
                  bottom: 4,
                  fontSize: d.share >= 50 ? 14 : 11,
                  fontWeight: 900,
                  color: d.color,
                  whiteSpace: "nowrap",
                  fontFamily: "'Noto Sans JP', sans-serif",
                  opacity: dimmed ? 0.4 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {d.grade}
              </div>
            );
          })}
        </div>

        {/* the bar (薄い帯) */}
        <div
          style={{
            height: 14,
            display: "flex",
            borderRadius: 7,
            overflow: "hidden",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          {positioned.map((d) => {
            const isActive = active === d.grade;
            const dimmed = active && !isActive;
            return (
              <div
                key={d.grade}
                onMouseEnter={() => setActive(d.grade)}
                onMouseLeave={() => setActive(null)}
                onClick={() => setActive((cur) => (cur === d.grade ? null : d.grade))}
                title={`${d.grade}: ${d.share.toFixed(1)}%`}
                style={{
                  width: `${d.share}%`,
                  background: d.color,
                  borderRight: "1px solid rgba(0,0,0,0.5)",
                  opacity: dimmed ? 0.25 : 1,
                  transform: isActive ? "scaleY(1.6)" : "scaleY(1)",
                  transformOrigin: "center",
                  transition: "all 0.2s",
                  cursor: "pointer",
                  minWidth: 0,
                }}
              />
            );
          })}
        </div>

        {/* bottom: 構成比(>=4% のみ) */}
        <div style={{ position: "relative", height: 26, marginTop: 6 }}>
          {positioned.map((d) => {
            if (d.share < 4) return null;
            const isActive = active === d.grade;
            const dimmed = active && !isActive;
            return (
              <div
                key={d.grade}
                style={{
                  position: "absolute",
                  left: `${d.center}%`,
                  transform: "translateX(-50%)",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  fontFamily: "'Space Grotesk', sans-serif",
                  opacity: dimmed ? 0.4 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {d.share.toFixed(1)}%
              </div>
            );
          })}
        </div>

        {/* active 詳細パネル */}
        {activeData && (
          <div
            style={{
              marginTop: 8,
              padding: "10px 14px",
              borderLeft: `3px solid ${activeData.color}`,
              background: `linear-gradient(90deg, ${activeData.color}26, transparent)`,
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: activeData.color,
                fontFamily: "'Noto Sans JP', sans-serif",
              }}
            >
              {activeData.grade}
            </div>
            <div style={{ flex: 1, fontSize: 11, color: "var(--text-muted)", minWidth: 0 }}>
              <span
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--text)",
                }}
              >
                {activeData.share.toFixed(1)}%
              </span>
              <span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>
              {activeData.quantity.toLocaleString()} 箱
              <span style={{ margin: "0 8px", opacity: 0.4 }}>·</span>
              ¥{activeData.unitPrice != null ? activeData.unitPrice.toLocaleString() : "—"}/箱
            </div>
          </div>
        )}
      </div>

      {/* 凡例 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
        {data.map((d) => {
          const isActive = active === d.grade;
          const dimmed = active && !isActive;
          return (
            <div
              key={d.grade}
              className="flex items-center justify-between"
              onMouseEnter={() => setActive(d.grade)}
              onMouseLeave={() => setActive(null)}
              style={{
                gap: 8,
                minWidth: 0,
                padding: "4px 6px",
                borderRadius: 6,
                background: isActive ? "rgba(255,255,255,0.04)" : "transparent",
                opacity: dimmed ? 0.5 : 1,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flexShrink: 0, boxShadow: `0 0 8px ${d.color}88` }} />
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: d.color }}>
                  {d.grade}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: "var(--text)" }}>
                  {d.share.toFixed(1)}%
                </span>
              </div>
              <span style={{ fontSize: 10, fontFamily: "'Space Grotesk', sans-serif", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {d.quantity.toLocaleString()}箱
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompareView({ a, aLabel, b, bLabel }: {
  a: GradeStat[]; aLabel: string;
  b: GradeStat[]; bLabel: string;
}) {
  const aTotal = a.reduce((s, g) => s + g.quantity, 0);
  const bTotal = b.reduce((s, g) => s + g.quantity, 0);

  const grades = Array.from(new Set([...a.map((g) => g.grade), ...b.map((g) => g.grade)]));
  // 順序保持: GRADE_COLOR の登場順を優先
  const order = Object.keys(GRADE_COLOR);
  grades.sort((x, y) => order.indexOf(x) - order.indexOf(y));

  const aMap = new Map(a.map((g) => [g.grade, g]));
  const bMap = new Map(b.map((g) => [g.grade, g]));

  const rows = grades.map((g) => {
    const av = aMap.get(g);
    const bv = bMap.get(g);
    const aQty = av?.quantity ?? 0;
    const bQty = bv?.quantity ?? 0;
    const aShare = aTotal > 0 ? (aQty / aTotal) * 100 : 0;
    const bShare = bTotal > 0 ? (bQty / bTotal) * 100 : 0;
    return {
      grade: g,
      color: GRADE_COLOR[g] ?? "var(--text-muted)",
      aQty, bQty, aShare, bShare,
      shareDelta: aShare - bShare,
      qtyDelta: aQty - bQty,
    };
  });
  const visibleRows = rows.filter((r) => r.aQty > 0 || r.bQty > 0);
  const changedRows = visibleRows
    .filter((r) => Math.abs(r.shareDelta) >= 0.05)
    .sort((x, y) => Math.abs(y.shareDelta) - Math.abs(x.shareDelta));
  const upRows = changedRows.filter((r) => r.shareDelta > 0).slice(0, 2);
  const downRows = changedRows.filter((r) => r.shareDelta < 0).slice(0, 2);
  const mainChange = changedRows[0];
  const summaryText = mainChange
    ? `${mainChange.grade} が ${mainChange.shareDelta > 0 ? "増えています" : "少なめです"}。全体量は ${aTotal >= bTotal ? "比較対象より多め" : "比較対象より少なめ"} です。`
    : `等級の割合は ${bLabel} とほぼ同じです。全体量は ${aTotal >= bTotal ? "比較対象より多め" : "比較対象より少なめ"} です。`;

  if (aTotal === 0 && bTotal === 0) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-dim)", padding: "20px 0", textAlign: "center" }}>
        比較できるデータがありません
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div data-compare-detail-panel style={{
        border: "1px solid var(--border-subtle)",
        borderRadius: 14,
        padding: 14,
        background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.018))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
      }}>
        <div data-compare-detail-head style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 700 }}>
              等級ごとの変化
            </div>
            <div style={{ marginTop: 3, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
              {summaryText}
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end", minWidth: 160 }}>
            {upRows.map((r) => <CompareDeltaChip key={`up-${r.grade}`} row={r} />)}
            {downRows.map((r) => <CompareDeltaChip key={`down-${r.grade}`} row={r} />)}
            {upRows.length === 0 && downRows.length === 0 && (
              <span style={{
                padding: "5px 8px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.055)",
                color: "var(--text-muted)",
                fontSize: 11,
                fontWeight: 700,
              }}>
                ほぼ同じ
              </span>
            )}
          </div>
        </div>

        <div data-compare-card-list style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {visibleRows.map((r) => (
            <CompareGradeCard key={r.grade} row={r} aLabel={aLabel} bLabel={bLabel} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CompareDeltaChip({ row }: {
  row: {
    grade: string;
    color: string;
    shareDelta: number;
  };
}) {
  const isUp = row.shareDelta > 0;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "5px 8px",
      borderRadius: 999,
      border: `1px solid ${isUp ? "rgba(34,197,94,0.28)" : "rgba(239,68,68,0.28)"}`,
      background: isUp ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
      color: isUp ? "var(--green-bright)" : "var(--red, oklch(0.65 0.18 25))",
      fontSize: 11,
      fontWeight: 800,
      fontFamily: "'Space Grotesk', sans-serif",
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 2, background: row.color, boxShadow: `0 0 8px ${row.color}` }} />
      {row.grade} {isUp ? "+" : ""}{row.shareDelta.toFixed(1)}pt
    </span>
  );
}

function CompareGradeCard({ row, aLabel, bLabel }: {
  row: {
    grade: string;
    color: string;
    aQty: number;
    bQty: number;
    aShare: number;
    bShare: number;
    shareDelta: number;
    qtyDelta: number;
  };
  aLabel: string;
  bLabel: string;
}) {
  const isFlat = Math.abs(row.shareDelta) < 0.05;
  const isUp = row.shareDelta > 0;
  const deltaColor = isFlat
    ? "var(--text-muted)"
    : isUp ? "var(--green-bright)" : "var(--red, oklch(0.65 0.18 25))";
  const sign = row.shareDelta >= 0 ? "+" : "";
  return (
    <div data-compare-grade-card style={{
      position: "relative",
      overflow: "hidden",
      border: "1px solid var(--border-subtle)",
      borderRadius: 12,
      padding: "12px 12px 11px",
      background: `linear-gradient(135deg, ${row.color}16, rgba(255,255,255,0.026) 38%, rgba(255,255,255,0.014))`,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.045)",
      minWidth: 0,
    }}>
      <div style={{
        position: "absolute",
        inset: "0 auto 0 0",
        width: 3,
        background: row.color,
        boxShadow: `0 0 18px ${row.color}`,
      }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: row.color, boxShadow: `0 0 12px ${row.color}` }} />
          <span style={{ color: row.color, fontWeight: 900, fontSize: 18, fontFamily: "'Space Grotesk', sans-serif" }}>
            {row.grade}
          </span>
        </div>
        <div style={{
          padding: "4px 7px",
          borderRadius: 999,
          background: isFlat ? "rgba(255,255,255,0.055)" : isUp ? "rgba(34,197,94,0.11)" : "rgba(239,68,68,0.11)",
          color: deltaColor,
          fontSize: 12,
          lineHeight: 1,
          fontWeight: 900,
          fontFamily: "'Space Grotesk', sans-serif",
          whiteSpace: "nowrap",
        }}>
          {sign}{row.shareDelta.toFixed(1)}pt
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <CompareMeter label={aLabel} qty={row.aQty} share={row.aShare} color={row.color} active />
        <CompareMeter label={bLabel} qty={row.bQty} share={row.bShare} color="rgba(232,240,234,0.45)" />
      </div>
      <div style={{
        marginTop: 9,
        color: "var(--text-dim)",
        fontSize: 10,
        fontFamily: "'Space Grotesk', sans-serif",
        textAlign: "right",
      }}>
        {row.qtyDelta >= 0 ? "+" : ""}{row.qtyDelta.toLocaleString()} 箱
      </div>
    </div>
  );
}

function CompareMeter({ label, qty, share, color, active = false }: {
  label: string;
  qty: number;
  share: number;
  color: string;
  active?: boolean;
}) {
  const width = share <= 0 ? 0 : Math.max(3, share);
  return (
    <div data-compare-meter style={{ display: "grid", gridTemplateColumns: "82px minmax(0, 1fr) 68px", gap: 8, alignItems: "center", minWidth: 0 }}>
      <div style={{
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        color: active ? "var(--text)" : "var(--text-muted)",
        fontSize: 10,
        fontWeight: active ? 700 : 500,
      }}>
        {label}
      </div>
      <div style={{ height: active ? 12 : 8, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{
          width: `${width}%`,
          height: "100%",
          borderRadius: 999,
          background: color,
          opacity: share <= 0 ? 0 : 1,
          boxShadow: active ? `0 0 14px ${color}` : "none",
        }} />
      </div>
      <div style={{
        color: active ? "var(--text)" : "var(--text-muted)",
        fontSize: 11,
        fontWeight: active ? 800 : 500,
        textAlign: "right",
        whiteSpace: "nowrap",
        fontFamily: "'Space Grotesk', sans-serif",
      }}>
        {share.toFixed(1)}%
        <span style={{ color: "var(--text-dim)", fontSize: 9 }}> / {qty.toLocaleString()}</span>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 14,
  padding: "20px 22px",
};
