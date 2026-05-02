"use client";

import { useState, useEffect } from "react";
import { ScatterChart } from "@/components/ScatterChart";
import { ShippingTempChart } from "@/components/ShippingTempChart";
import { SunshineChart } from "@/components/SunshineChart";
import { TempTrendChart } from "@/components/TempTrendChart";
import type { CombinedRow } from "@/lib/googleSheets";

type Days = "7" | "30" | "90" | "all";

const TIME_OPTS: { id: Days; label: string }[] = [
  { id: "7",   label: "7日" },
  { id: "30",  label: "30日" },
  { id: "90",  label: "90日" },
  { id: "all", label: "全期間" },
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

function ChartCard({ title, dotColor, tag, children, fullWidth }: {
  title: string; dotColor: string; tag?: string; children: React.ReactNode; fullWidth?: boolean;
}) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 14,
      padding: "20px 22px",
      gridColumn: fullWidth ? "1 / -1" : undefined,
    }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <div className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor }} />
          {title}
        </div>
        {tag && (
          <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--surface-hover)", border: "1px solid var(--border-subtle)", padding: "3px 8px", borderRadius: 20 }}>
            {tag}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export default function AnalysisPage() {
  const [days, setDays] = useState<Days>("30");
  const [data, setData] = useState<CombinedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    fetch(`/api/combined?days=${days}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d); })
      .catch((e) => setError(String(e)));
  }, [days]);

  const shipArr = data?.map((r) => r.totalQuantity).filter((v): v is number => v != null) ?? [];
  const tempArr = data?.map((r) => r.tempMax).filter((v): v is number => v != null) ?? [];
  const sunArr  = data?.map((r) => r.sunshine).filter((v): v is number => v != null) ?? [];
  const rTemp = shipArr.length > 1 ? pearson(shipArr, tempArr.slice(-shipArr.length)) : 0;
  const rSun  = shipArr.length > 1 ? pearson(shipArr, sunArr.slice(-shipArr.length)) : 0;

  return (
    <div className="flex flex-col" style={{ height: "100vh", overflow: "hidden" }}>
      {/* Topbar */}
      <div className="flex items-center justify-between shrink-0" style={{ height: 60, padding: "0 28px", background: "var(--bg2)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>
          相関分析
        </div>
        <div className="flex gap-1" style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 3 }}>
          {TIME_OPTS.map((o) => (
            <button
              key={o.id}
              onClick={() => setDays(o.id)}
              style={{
                border: "none",
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 12, fontWeight: 500,
                padding: "5px 12px", borderRadius: 7,
                background: days === o.id ? "var(--green)" : "transparent",
                color: days === o.id ? "#fff" : "var(--text-muted)",
                transition: "all 0.15s",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
        {error && (
          <div style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#fca5a5" }}>
            ⚠️ データの取得に失敗しました: {error}
          </div>
        )}

        {/* 散布図 */}
        <ChartCard title="気象指標 × 出荷数量 散布図" dotColor="var(--cyan, oklch(0.72 0.12 215))">
          {!data && !error ? (
            <div style={{ height: 360, background: "var(--surface-hover)", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
          ) : data ? (
            <ScatterChart data={data} />
          ) : null}
          <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
            <span><span style={{ color: "var(--green-bright)", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>|r| ≥ 0.7</span> 強い相関</span>
            <span><span style={{ color: "var(--amber)", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>|r| ≥ 0.4</span> 中程度の相関</span>
            <span><span style={{ color: "var(--text-muted)", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>|r| &lt; 0.4</span> 弱い相関</span>
          </div>
        </ChartCard>

        {/* 出荷×気温・出荷×日照（時系列） */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <ChartCard title="出荷数量 × 最高気温" dotColor="oklch(0.65 0.18 25)" tag={data ? `r = ${rTemp.toFixed(2)}` : ""}>
            {!data && !error ? (
              <div style={{ height: 200, background: "var(--surface-hover)", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
            ) : data ? (
              <ShippingTempChart data={data} />
            ) : null}
          </ChartCard>

          <ChartCard title="出荷数量 × 日照時間" dotColor="oklch(0.82 0.14 90)" tag={data ? `r = ${rSun.toFixed(2)}` : ""}>
            {!data && !error ? (
              <div style={{ height: 200, background: "var(--surface-hover)", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
            ) : data ? (
              <SunshineChart data={data} />
            ) : null}
          </ChartCard>
        </div>

        {/* 気温推移 */}
        <ChartCard title="気温推移（最低・平均・最高）" dotColor="oklch(0.65 0.18 25)">
          {!data && !error ? (
            <div style={{ height: 200, background: "var(--surface-hover)", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
          ) : data ? (
            <TempTrendChart data={data} />
          ) : null}
          <div className="flex gap-4" style={{ marginTop: 12 }}>
            {[
              { label: "最高気温", color: "oklch(0.65 0.18 25)" },
              { label: "平均気温", color: "oklch(0.74 0.16 68)" },
              { label: "最低気温", color: "oklch(0.72 0.12 215)" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                <div style={{ width: 18, height: 2, borderRadius: 1, background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
