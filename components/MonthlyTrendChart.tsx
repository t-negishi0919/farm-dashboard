"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LabelList,
} from "recharts";
import type { YearlySummary } from "@/app/api/yearly-summary/route";

type Mode = "quantity" | "sales";
type Scope = "yoy" | "all";
type Unit = "month" | "week";
type CompareYear = number | "none";

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "rgba(14,22,18,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#e8f0ea",
  fontSize: 12,
};

const HIGHLIGHT_PCT = 5; // ±5% で強調

function badgeColor(pct: number | null): string {
  if (pct == null) return "rgba(232,240,234,0.4)";
  if (pct >= HIGHLIGHT_PCT) return "var(--green-bright, #4cc471)";
  if (pct <= -HIGHLIGHT_PCT) return "#f87171";
  return "rgba(232,240,234,0.55)";
}

function formatPct(v: number | null): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(0)}%`;
}

type YoYDatum = {
  month: string;
  monthIdx: number;
  current: number;
  prev: number;
  yoyPct: number | null;
  isCurrentMonth: boolean;
  forecastPct: number | null;
};

function buildYoYData(summary: YearlySummary, mode: Mode, compareYear: CompareYear): YoYDatum[] {
  // 比較対象の年別 monthly。"none" のときは 0 埋めで線は描かない（コンポーネント側で省く）
  const compareArr =
    compareYear !== "none" && summary.monthlyByYear[String(compareYear)]
      ? summary.monthlyByYear[String(compareYear)]
      : null;

  return Array.from({ length: 12 }, (_, i) => {
    const cur = summary.monthly[i];
    const monthIdx = i + 1;
    const isCurrentMonth = monthIdx === summary.thisMonth;
    const current = mode === "quantity" ? cur.quantity : cur.sales;
    const cmp = compareArr ? (mode === "quantity" ? compareArr[i].quantity : compareArr[i].sales) : 0;
    const yoyPct = compareArr && cmp > 0 ? ((current - cmp) / cmp) * 100 : null;

    let forecastPct: number | null = null;
    if (isCurrentMonth && compareArr) {
      const projected = mode === "quantity" ? summary.forecast.projectedQty : summary.forecast.projectedSales;
      forecastPct = cmp > 0 ? ((projected - cmp) / cmp) * 100 : null;
    }

    return {
      month: `${monthIdx}月`,
      monthIdx,
      current,
      prev: cmp,
      yoyPct,
      isCurrentMonth,
      forecastPct,
    };
  });
}

export function MonthlyTrendChart({
  summary, mode = "quantity", scope = "yoy", unit = "month", compareYear,
}: {
  summary: YearlySummary | null;
  mode?: Mode;
  scope?: Scope;
  unit?: Unit;
  compareYear?: CompareYear;
}) {
  if (!summary) {
    return (
      <div style={{ height: 240, background: "var(--surface-hover)", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
    );
  }

  const formatter = (v: number) => {
    if (mode === "sales") return `¥${v.toLocaleString()}`;
    return `${v.toLocaleString()} 箱`;
  };

  const tickFormatter = (v: number) =>
    mode === "sales"
      ? (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))
      : v.toLocaleString();

  if (scope === "all") {
    const data = summary.allTimeMonthly.map((p) => ({
      label: `${p.year}/${String(p.month).padStart(2, "0")}`,
      value: mode === "quantity" ? p.quantity : p.sales,
    }));

    return (
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "rgba(232,240,234,0.45)", fontFamily: "'Space Grotesk', sans-serif" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "rgba(232,240,234,0.35)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={tickFormatter}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "rgba(232,240,234,0.7)", fontFamily: "'Space Grotesk', sans-serif" }}
            formatter={(value) => formatter(Number(value) || 0)}
          />
          <Bar
            dataKey="value"
            name={mode === "quantity" ? "出荷数" : "売上"}
            fill="rgba(72,199,116,0.55)"
            stroke="rgba(72,199,116,0.9)"
            strokeWidth={1}
            radius={[4, 4, 0, 0]}
          />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  // YoY モード
  const cmp: CompareYear = compareYear ?? summary.lastYear;

  if (unit === "week") {
    const curWeeks = summary.weeklyByYear?.[String(summary.thisYear)] ?? [];
    const cmpWeeks = cmp !== "none" ? (summary.weeklyByYear?.[String(cmp)] ?? []) : [];
    const cmpMap = new Map(cmpWeeks.map((w) => [w.week, w]));
    const lastWeek = curWeeks.length > 0 ? curWeeks[curWeeks.length - 1].week : 0;
    const maxWeek = Math.max(lastWeek, ...cmpWeeks.map((w) => w.week));

    const weekData = Array.from({ length: maxWeek }, (_, i) => {
      const wn = i + 1;
      const c = curWeeks.find((w) => w.week === wn);
      const p = cmpMap.get(wn);
      const current = c ? (mode === "quantity" ? c.quantity : c.sales) : 0;
      const prev = p ? (mode === "quantity" ? p.quantity : p.sales) : 0;
      return {
        label: `W${wn}`,
        week: wn,
        startDate: c?.startDate ?? p?.startDate ?? "",
        current, prev,
      };
    });

    const hasCmp = cmp !== "none" && cmpWeeks.length > 0;

    return (
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={weekData} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "rgba(232,240,234,0.45)", fontFamily: "'Space Grotesk', sans-serif" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "rgba(232,240,234,0.35)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={tickFormatter}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "rgba(232,240,234,0.7)", fontFamily: "'Space Grotesk', sans-serif" }}
            labelFormatter={(label, payload) => {
              const d = payload?.[0]?.payload;
              if (!d) return label;
              const sd = d.startDate ? d.startDate.slice(5).replace("-", "/") : "";
              return sd ? `${label} (${sd}〜)` : label;
            }}
            formatter={(value, name) => {
              const num = Number(value) || 0;
              if (name === "current") return [formatter(num), `${summary.thisYear}年`];
              if (name === "prev")    return [formatter(num), `${cmp}年`];
              return [formatter(num), name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }}
            iconType="circle"
            formatter={(value) => {
              if (value === "current") return `${summary.thisYear}年`;
              if (value === "prev")    return `${cmp}年`;
              return value;
            }}
          />
          <Bar
            dataKey="current"
            name="current"
            fill="rgba(72,199,116,0.55)"
            stroke="rgba(72,199,116,0.9)"
            strokeWidth={1}
            radius={[3, 3, 0, 0]}
          />
          {hasCmp && (
            <Line
              type="monotone"
              dataKey="prev"
              name="prev"
              stroke="oklch(0.74 0.16 68)"
              strokeWidth={2}
              dot={{ r: 2, fill: "oklch(0.74 0.16 68)" }}
              connectNulls
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  const data = buildYoYData(summary, mode, cmp);
  const hasCompareLine = cmp !== "none" && Boolean(summary.monthlyByYear[String(cmp)]);

  // 各月の前年比%バッジを描く
  const renderYoYBadge = (props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    index?: number;
  }) => {
    const { x, y, width, index } = props;
    if (index == null) return <g />;
    const d = data[index];
    if (d == null) return <g />;
    if (d.current === 0) return <g />;
    if (d.yoyPct == null) return <g />;

    const cx = (Number(x) || 0) + (Number(width) || 0) / 2;
    const cy = (Number(y) || 0) - 6;
    const color = badgeColor(d.yoyPct);
    const bold = Math.abs(d.yoyPct) >= HIGHLIGHT_PCT;
    return (
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        fill={color}
        fontSize={bold ? 11 : 10}
        fontWeight={bold ? 700 : 500}
        fontFamily="'Space Grotesk', sans-serif"
      >
        {formatPct(d.yoyPct)}
      </text>
    );
  };

  // 当月のペース予測バッジ（棒の下、月ラベルの上）
  const renderPaceBadge = (props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
    index?: number;
  }) => {
    const { x, y, width, height, index } = props;
    if (index == null) return <g />;
    const d = data[index];
    if (d == null || !d.isCurrentMonth || d.forecastPct == null) return <g />;

    const cx = (Number(x) || 0) + (Number(width) || 0) / 2;
    const cy = (Number(y) || 0) + (Number(height) || 0) - 6;
    const color = badgeColor(d.forecastPct);
    return (
      <g>
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          fill={color}
          fontSize={9}
          fontWeight={700}
          fontFamily="'Space Grotesk', sans-serif"
        >
          見込み {formatPct(d.forecastPct)}
        </text>
      </g>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 24, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "rgba(232,240,234,0.45)", fontFamily: "'Space Grotesk', sans-serif" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "rgba(232,240,234,0.35)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={tickFormatter}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: "rgba(232,240,234,0.7)", fontFamily: "'Space Grotesk', sans-serif" }}
          formatter={(value, name) => {
            const num = Number(value) || 0;
            if (name === "current") return [formatter(num), `${summary.thisYear}年`];
            if (name === "prev")    return [formatter(num), `${cmp}年`];
            return [formatter(num), name];
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }}
          iconType="circle"
          formatter={(value) => {
            if (value === "current") return `${summary.thisYear}年`;
            if (value === "prev")    return `${cmp}年`;
            return value;
          }}
        />
        <Bar
          dataKey="current"
          name="current"
          fill="rgba(72,199,116,0.55)"
          stroke="rgba(72,199,116,0.9)"
          strokeWidth={1}
          radius={[4, 4, 0, 0]}
        >
          <LabelList content={renderYoYBadge} />
          <LabelList content={renderPaceBadge} />
        </Bar>
        {hasCompareLine && (
          <Line
            type="monotone"
            dataKey="prev"
            name="prev"
            stroke="oklch(0.74 0.16 68)"
            strokeWidth={2}
            dot={{ r: 3, fill: "oklch(0.74 0.16 68)" }}
            connectNulls
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
