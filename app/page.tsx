"use client";

import { useState, useEffect } from "react";
import { YearlyKpiCards } from "@/components/YearlyKpiCards";
import { MonthlyTrendChart } from "@/components/MonthlyTrendChart";
import { GradeMixCard } from "@/components/GradeMixCard";
import { WeatherTodayCard } from "@/components/WeatherTodayCard";
import type { YearlySummary } from "./api/yearly-summary/route";
import type { TodayWeather } from "./api/today-weather/route";

type Mode = "quantity" | "sales";
const MODE_OPTS: { id: Mode; label: string }[] = [
  { id: "quantity", label: "出荷数" },
  { id: "sales",    label: "売上" },
];

type Scope = "yoy" | "all";
const SCOPE_OPTS: { id: Scope; label: string }[] = [
  { id: "yoy", label: "今年 vs 昨年" },
  { id: "all", label: "全期間" },
];

export default function DashboardPage() {
  const [summary, setSummary] = useState<YearlySummary | null>(null);
  const [weather, setWeather] = useState<TodayWeather | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("quantity");
  const [scope, setScope] = useState<Scope>("yoy");
  const [compareYear, setCompareYear] = useState<number | "none" | null>(null);

  useEffect(() => {
    fetch("/api/yearly-summary")
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setSummary(d); })
      .catch((e) => setError(String(e)));

    fetch("/api/today-weather")
      .then((r) => r.json())
      .then((d) => { if (d.error) return; setWeather(d); })
      .catch(() => { /* 天気は失敗しても致命的ではない */ });
  }, []);

  return (
    <div className="flex flex-col" style={{ height: "100vh", overflow: "hidden" }}>
      {/* Topbar */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{ height: 60, padding: "0 28px", background: "var(--bg2)", borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2.5" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>
          ダッシュボード
          {summary && (
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400, letterSpacing: "0.04em" }}>
              {summary.thisYear}年 {summary.thisMonth}月
            </span>
          )}
        </div>
        <a
          href="/analysis"
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            textDecoration: "none",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "5px 12px",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--text)";
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border-strong)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)";
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border-subtle)";
          }}
        >
          分析を見る →
        </a>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
        {error && (
          <div style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#fca5a5" }}>
            ⚠️ データの取得に失敗しました: {error}
          </div>
        )}

        {/* KPI 4枚 */}
        <YearlyKpiCards summary={summary} />

        {/* 月別推移 */}
        <div style={chartCardStyle}>
          <div className="flex items-center justify-between" style={{ marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
            <div className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "oklch(0.68 0.18 148)" }} />
              月別推移
              {summary && scope === "yoy" && (
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4, fontFamily: "'Space Grotesk', sans-serif" }}>
                  {summary.thisYear}年（棒） vs {effectiveCompare(compareYear, summary)} （線）
                </span>
              )}
              {scope === "all" && (
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4, fontFamily: "'Space Grotesk', sans-serif" }}>
                  全期間（年月）
                </span>
              )}
            </div>
            <div className="flex flex-wrap" style={{ gap: 6, alignItems: "center" }}>
              <div className="flex gap-1" style={{ background: "var(--surface-hover)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 3 }}>
                {SCOPE_OPTS.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setScope(o.id)}
                    style={toggleBtnStyle(scope === o.id)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {scope === "yoy" && summary && (
                <select
                  value={String(compareYear ?? summary.lastYear)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCompareYear(v === "none" ? "none" : parseInt(v, 10));
                  }}
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
                  }}
                  title="比較する年"
                >
                  <optgroup label="比較年">
                    {summary.availableYears
                      .filter((y) => y !== summary.thisYear)
                      .map((y) => (
                        <option key={y} value={String(y)}>{y}年</option>
                      ))}
                    <option value="none">比較なし</option>
                  </optgroup>
                </select>
              )}
              <div className="flex gap-1" style={{ background: "var(--surface-hover)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 3 }}>
                {MODE_OPTS.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setMode(o.id)}
                    style={toggleBtnStyle(mode === o.id)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <MonthlyTrendChart
            summary={summary}
            mode={mode}
            scope={scope}
            compareYear={compareYear ?? (summary ? summary.lastYear : undefined)}
          />
        </div>

        {/* 等級ミックス + 天気 (2カラム) */}
        <div data-grid-2col style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)", gap: 14 }}>
          <GradeMixCard summary={summary} />
          <WeatherTodayCard data={weather} />
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          [data-grid-2col] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

const chartCardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 14,
  padding: "20px 22px",
};

function effectiveCompare(compareYear: number | "none" | null, summary: YearlySummary): string {
  if (compareYear === "none") return "比較なし";
  const y = compareYear ?? summary.lastYear;
  return `${y}年`;
}

function toggleBtnStyle(active: boolean): React.CSSProperties {
  return {
    border: "none",
    cursor: "pointer",
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 12, fontWeight: 500,
    padding: "4px 12px",
    borderRadius: 6,
    background: active ? "var(--green)" : "transparent",
    color: active ? "#fff" : "var(--text-muted)",
    transition: "all 0.15s",
  };
}
