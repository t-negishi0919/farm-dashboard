"use client";

import { useState } from "react";
import {
  ScatterChart as ReScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { CombinedRow } from "@/lib/googleSheets";

type XKey = keyof CombinedRow;

const X_OPTIONS: { key: XKey; label: string }[] = [
  { key: "tempMax",    label: "最高気温" },
  { key: "tempMin",    label: "最低気温" },
  { key: "tempAvg",    label: "平均気温" },
  { key: "humidity",   label: "湿度" },
  { key: "sunshine",   label: "日照時間" },
  { key: "precipitation", label: "降水量" },
  { key: "et0",        label: "蒸発散量" },
];

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0));
  return den === 0 ? 0 : num / den;
}

const TOOLTIP_STYLE = {
  backgroundColor: "rgba(14,22,18,0.95)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#e8f0ea",
};

export function ScatterChart({ data }: { data: CombinedRow[] }) {
  const [xKey, setXKey] = useState<XKey>("tempMax");

  const points = data
    .filter((r) => r[xKey] != null && r.totalQuantity != null)
    .map((r) => ({ x: r[xKey] as number, y: r.totalQuantity as number }));

  const r = pearson(points.map((p) => p.x), points.map((p) => p.y));
  const abs = Math.abs(r);
  const isStrong = abs > 0.4;
  const xLabel = X_OPTIONS.find((o) => o.key === xKey)?.label || "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {X_OPTIONS.map((o) => (
            <button
              key={o.key as string}
              onClick={() => setXKey(o.key)}
              style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                transition: "all 0.15s", fontFamily: "'Noto Sans JP', sans-serif",
                background: xKey === o.key ? "rgba(72,199,116,0.15)" : "var(--surface)",
                border: `1px solid ${xKey === o.key ? "var(--green)" : "var(--border-subtle)"}`,
                color: xKey === o.key ? "var(--green-bright)" : "var(--text-muted)",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 13, fontWeight: 600,
            padding: "3px 10px", borderRadius: 6,
            background: isStrong ? "rgba(72,199,116,0.12)" : "rgba(255,195,80,0.12)",
            color: isStrong ? "var(--green-bright)" : "var(--amber)",
            border: `1px solid ${isStrong ? "rgba(72,199,116,0.2)" : "rgba(255,195,80,0.2)"}`,
          }}
        >
          r = {r.toFixed(2)}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ReScatterChart margin={{ top: 4, right: 8, left: -8, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis type="number" dataKey="x" name={xLabel} tick={{ fontSize: 10, fill: "rgba(232,240,234,0.35)", fontFamily: "'Space Grotesk', sans-serif" }} axisLine={false} tickLine={false} label={{ value: xLabel, position: "insideBottom", offset: -10, fontSize: 10, fill: "rgba(232,240,234,0.45)" }} />
          <YAxis type="number" dataKey="y" name="出荷数量" tick={{ fontSize: 10, fill: "rgba(232,240,234,0.35)" }} axisLine={false} tickLine={false} label={{ value: "出荷数量", angle: -90, position: "insideLeft", fontSize: 10, fill: "rgba(232,240,234,0.45)" }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "rgba(232,240,234,0.7)" }} cursor={{ stroke: "var(--green)", strokeDasharray: "3 3" }} />
          <Scatter data={points} fill="rgba(72,199,116,0.7)" />
        </ReScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
