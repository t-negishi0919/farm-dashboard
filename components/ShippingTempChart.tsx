"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { CombinedRow } from "@/lib/googleSheets";

const TOOLTIP_STYLE = {
  backgroundColor: "rgba(14,22,18,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#e8f0ea",
};

export function ShippingTempChart({ data }: { data: CombinedRow[] }) {
  const chartData = data.map((r) => ({
    date: r.date.slice(5),
    数量: r.totalQuantity,
    最高気温: r.tempMax != null ? +r.tempMax.toFixed(1) : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(232,240,234,0.35)", fontFamily: "'Space Grotesk', sans-serif" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "rgba(232,240,234,0.35)" }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "rgba(232,240,234,0.35)" }} axisLine={false} tickLine={false} unit="°" />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "rgba(232,240,234,0.7)", fontFamily: "'Space Grotesk', sans-serif", fontSize: 11 }} />
        <Bar yAxisId="left" dataKey="数量" fill="rgba(72,199,116,0.25)" stroke="rgba(72,199,116,0.7)" strokeWidth={1.5} radius={[4, 4, 0, 0]} name="出荷数量" />
        <Line yAxisId="right" type="monotone" dataKey="最高気温" stroke="oklch(0.74 0.16 68)" strokeWidth={2} dot={false} name="最高気温" connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
