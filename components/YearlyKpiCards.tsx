"use client";

import type { YearlySummary } from "@/app/api/yearly-summary/route";

type Props = {
  summary: YearlySummary | null;
};

function pct(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function Kpi({
  label,
  value,
  unit,
  prev,
  prevLabel,
  diffPct,
  accent,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  prev: string;
  prevLabel: string;
  diffPct: number | null;
  accent: string;
  icon: string;
}) {
  const positive = diffPct != null && diffPct >= 0;
  const arrow = diffPct == null ? "" : positive ? "▲" : "▼";
  const trendColor = diffPct == null ? "var(--text-dim)" : positive ? "var(--green-bright)" : "var(--red, #f87171)";

  return (
    <div style={cardStyle}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent, opacity: 0.7 }} />
      <div style={{ position: "absolute", width: 80, height: 80, borderRadius: "50%", background: accent, opacity: 0.06, bottom: -20, right: -10, filter: "blur(20px)" }} />

      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {label}
        </div>
        <div className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 8, background: `${accent}22`, fontSize: 16 }}>
          {icon}
        </div>
      </div>

      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 36, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.1, color: "#fff" }}>
        {value}
        {unit && <span style={{ fontSize: 14, fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>{unit}</span>}
      </div>

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {prevLabel} <span style={{ fontFamily: "'Space Grotesk', sans-serif", color: "var(--text)" }}>{prev}</span>
        </div>
        <div className="flex items-center gap-1" style={{ fontSize: 12, fontFamily: "'Space Grotesk', sans-serif", color: trendColor, fontWeight: 600 }}>
          <span>{arrow}</span>
          <span>{fmtPct(diffPct)}</span>
        </div>
      </div>
    </div>
  );
}

export function YearlyKpiCards({ summary }: Props) {
  if (!summary) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ ...cardStyle, height: 160, animation: "pulse 1.5s ease-in-out infinite" }} />
        ))}
      </div>
    );
  }

  const monthLabel = `${summary.thisMonth}月`;
  const greenAccent = "oklch(0.68 0.18 148)";
  const goldAccent  = "oklch(0.82 0.14 90)";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
      <Kpi
        label={`今月の出荷 (${monthLabel})`}
        value={summary.thisMonthQty.toLocaleString()}
        unit="箱"
        prev={`${summary.prevYearSameMonthQty.toLocaleString()} 箱`}
        prevLabel={`昨年${monthLabel}`}
        diffPct={pct(summary.thisMonthQty, summary.prevYearSameMonthQty)}
        accent={greenAccent}
        icon="📦"
      />
      <Kpi
        label={`今月の売上 (${monthLabel})`}
        value={`¥${summary.thisMonthSales.toLocaleString()}`}
        prev={`¥${summary.prevYearSameMonthSales.toLocaleString()}`}
        prevLabel={`昨年${monthLabel}`}
        diffPct={pct(summary.thisMonthSales, summary.prevYearSameMonthSales)}
        accent={goldAccent}
        icon="💴"
      />
      <Kpi
        label={`今年累計の出荷 (${summary.thisYear})`}
        value={summary.ytdQty.toLocaleString()}
        unit="箱"
        prev={`${summary.prevYearYtdQty.toLocaleString()} 箱`}
        prevLabel={`昨年同期`}
        diffPct={pct(summary.ytdQty, summary.prevYearYtdQty)}
        accent={greenAccent}
        icon="📊"
      />
      <Kpi
        label={`今年累計の売上 (${summary.thisYear})`}
        value={`¥${summary.ytdSales.toLocaleString()}`}
        prev={`¥${summary.prevYearYtdSales.toLocaleString()}`}
        prevLabel={`昨年同期`}
        diffPct={pct(summary.ytdSales, summary.prevYearYtdSales)}
        accent={goldAccent}
        icon="💰"
      />
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 14,
  padding: "20px 22px",
  position: "relative",
  overflow: "hidden",
};
