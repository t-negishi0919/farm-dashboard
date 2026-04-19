"use client";

import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { CombinedRow } from "@/lib/googleSheets";

const TOOLTIP_STYLE = {
  backgroundColor: "rgba(14,22,18,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#e8f0ea",
};

export function TempTrendChart({ data }: { data: CombinedRow[] }) {
  const chartData = data.map((r) => ({
    date: r.date.slice(5),
    最高気温: r.tempMax != null ? +r.tempMax.toFixed(1) : null,
    平均気温: r.tempAvg != null ? +r.tempAvg.toFixed(1) : null,
    最低気温: r.tempMin != null ? +r.tempMin.toFixed(1) : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(232,240,234,0.35)", fontFamily: "'Space Grotesk', sans-serif" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: "rgba(232,240,234,0.35)" }} axisLine={false} tickLine={false} unit="°" />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "rgba(232,240,234,0.7)", fontFamily: "'Space Grotesk', sans-serif", fontSize: 11 }} />
        <Line type="monotone" dataKey="最高気温" stroke="oklch(0.65 0.18 25)" strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="平均気温" stroke="oklch(0.74 0.16 68)" strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls />
        <Line type="monotone" dataKey="最低気温" stroke="oklch(0.72 0.12 215)" strokeWidth={2} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
