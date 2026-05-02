"use client";

import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
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

type Selection = string;
type View = "bar" | "pie" | "stacked";

const VIEW_OPTS: { id: View; label: string }[] = [
  { id: "bar",     label: "棒" },
  { id: "pie",     label: "円" },
  { id: "stacked", label: "帯" },
];

function formatYm(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}年${parseInt(m, 10)}月`;
}

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "rgba(14,22,18,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#e8f0ea",
  fontSize: 12,
  padding: "8px 12px",
};

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
  }

  const totalQty = grades.reduce((s, g) => s + g.quantity, 0);
  const max = grades.reduce((m, g) => Math.max(m, g.quantity), 0);

  return (
    <div style={cardStyle}>
      <div className="flex items-center justify-between" style={{ marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "oklch(0.68 0.18 148)" }} />
          等級ミックス
        </div>
        <div className="flex items-center" style={{ gap: 6, flexWrap: "wrap" }}>
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
          </select>
        </div>
      </div>

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
      ) : (
        <BarView grades={grades} max={max} totalQty={totalQty} />
      )}
    </div>
  );
}

function BarView({ grades, max, totalQty }: { grades: GradeStat[]; max: number; totalQty: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {grades.map((g) => {
        const pct = max > 0 ? (g.quantity / max) * 100 : 0;
        const sharePct = totalQty > 0 ? (g.quantity / totalQty) * 100 : 0;
        const color = GRADE_COLOR[g.grade] ?? "var(--text-muted)";
        return (
          <div key={g.grade}>
            <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", color, minWidth: 32 }}>
                  {g.grade}
                </span>
                <span style={{ fontSize: 12, fontFamily: "'Space Grotesk', sans-serif", color: "var(--text)" }}>
                  {g.quantity.toLocaleString()} 箱
                </span>
                <span style={{ fontSize: 11, fontFamily: "'Space Grotesk', sans-serif", color: "var(--text-dim)" }}>
                  ({sharePct.toFixed(1)}%)
                </span>
              </div>
              <div className="flex items-center gap-3" style={{ fontSize: 11, fontFamily: "'Space Grotesk', sans-serif", color: "var(--text-muted)" }}>
                <span>単価 ¥{g.unitPrice != null ? g.unitPrice.toLocaleString() : "—"}</span>
                <span style={{ color: "var(--text-dim)" }}>総額 ¥{g.total.toLocaleString()}</span>
              </div>
            </div>
            <div style={{ height: 8, background: "var(--surface-hover)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                width: `${pct}%`,
                height: "100%",
                background: color,
                opacity: 0.85,
                transition: "width 0.4s ease",
                borderRadius: 4,
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

type PieDatum = GradeStat & { share: number; color: string };

function PieView({ grades, totalQty }: { grades: GradeStat[]; totalQty: number }) {
  const data: PieDatum[] = grades.map((g) => ({
    ...g,
    share: totalQty > 0 ? (g.quantity / totalQty) * 100 : 0,
    color: GRADE_COLOR[g.grade] ?? "var(--text-muted)",
  }));

  // 大スライス（>=8%）は内側に白文字、中スライス（>=3%）は外側カラー文字、小スライス（<3%）は省略
  const renderLabel = (props: {
    cx?: number; cy?: number;
    midAngle?: number;
    innerRadius?: number; outerRadius?: number;
    index?: number;
  }) => {
    const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, index } = props;
    if (index == null) return null;
    const d = data[index];
    if (d.share < 3) return null;
    const RADIAN = Math.PI / 180;

    if (d.share >= 8) {
      // 内側の太字白
      const r = innerRadius + (outerRadius - innerRadius) * 0.55;
      const x = cx + r * Math.cos(-midAngle * RADIAN);
      const y = cy + r * Math.sin(-midAngle * RADIAN);
      return (
        <g>
          <text
            x={x}
            y={y - 7}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#0e1610"
            fontSize={13}
            fontWeight={800}
            fontFamily="'Space Grotesk', sans-serif"
            style={{ paintOrder: "stroke", stroke: "rgba(255,255,255,0.4)", strokeWidth: 0 }}
          >
            {d.grade}
          </text>
          <text
            x={x}
            y={y + 9}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#0e1610"
            fontSize={14}
            fontWeight={800}
            fontFamily="'Space Grotesk', sans-serif"
          >
            {d.share.toFixed(1)}%
          </text>
        </g>
      );
    }

    // 外側のカラー文字
    const r = outerRadius + 18;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fill={d.color}
        fontSize={12}
        fontWeight={700}
        fontFamily="'Space Grotesk', sans-serif"
      >
        {d.grade} {d.share.toFixed(1)}%
      </text>
    );
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)", gap: 16, alignItems: "center" }}>
      <div style={{ minWidth: 0 }}>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="quantity"
              nameKey="grade"
              cx="50%"
              cy="50%"
              innerRadius={0}
              outerRadius={100}
              stroke="rgba(14,22,18,0.7)"
              strokeWidth={1.5}
              labelLine={false}
              label={renderLabel}
              isAnimationActive={false}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: "rgba(232,240,234,0.7)", fontFamily: "'Space Grotesk', sans-serif" }}
              formatter={(_value, _name, item: { payload?: PieDatum }) => {
                const d = item.payload;
                if (!d) return null;
                return [
                  `${d.quantity.toLocaleString()}箱 (${d.share.toFixed(1)}%)`,
                  d.grade,
                ];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        {data.map((d) => (
          <div key={d.grade} className="flex items-center justify-between" style={{ gap: 8, minWidth: 0 }}>
            <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: d.color, minWidth: 32 }}>
                {d.grade}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: "var(--text)" }}>
                {d.share.toFixed(1)}%
              </span>
            </div>
            <div style={{ fontSize: 10, fontFamily: "'Space Grotesk', sans-serif", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {d.quantity.toLocaleString()}箱 / ¥{d.unitPrice != null ? d.unitPrice.toLocaleString() : "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StackedBarView({ grades, totalQty }: { grades: GradeStat[]; totalQty: number }) {
  const data = grades.map((g) => ({
    ...g,
    share: totalQty > 0 ? (g.quantity / totalQty) * 100 : 0,
    color: GRADE_COLOR[g.grade] ?? "var(--text-muted)",
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 100% 帯 */}
      <div style={{ height: 36, display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
        {data.map((d) => (
          <div
            key={d.grade}
            title={`${d.grade}: ${d.share.toFixed(1)}%`}
            style={{
              width: `${d.share}%`,
              background: d.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 0,
            }}
          >
            {d.share >= 6 && (
              <span style={{
                color: "#0e1610",
                fontSize: 12,
                fontWeight: 800,
                fontFamily: "'Space Grotesk', sans-serif",
                whiteSpace: "nowrap",
                padding: "0 4px",
              }}>
                {d.grade} {d.share.toFixed(1)}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 凡例 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
        {data.map((d) => (
          <div key={d.grade} className="flex items-center justify-between" style={{ gap: 8, minWidth: 0 }}>
            <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color, flexShrink: 0 }} />
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
        ))}
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
