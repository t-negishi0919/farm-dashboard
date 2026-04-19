"use client";

import { useState, useEffect } from "react";
import { SummaryCards } from "@/components/SummaryCards";
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

function ChartCard({
  title,
  dotColor,
  tag,
  children,
  fullWidth,
  delay,
}: {
  title: string;
  dotColor: string;
  tag?: string;
  children: React.ReactNode;
  fullWidth?: boolean;
  delay: number;
}) {
  return (
    <div
      className={`anim anim-${delay}`}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 14,
        padding: "20px 22px",
        position: "relative",
        overflow: "hidden",
        transition: "border-color 0.2s",
        gridColumn: fullWidth ? "1 / -1" : undefined,
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-strong)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-subtle)")}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <div className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", letterSpacing: "0.01em" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
          {title}
        </div>
        {tag && (
          <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--surface-hover)", border: "1px solid var(--border-subtle)", padding: "3px 8px", borderRadius: 20, letterSpacing: "0.04em" }}>
            {tag}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div style={{ height, background: "var(--surface-hover)", borderRadius: 6, animation: "pulse 1.5s ease-in-out infinite" }} />
  );
}

function CorrBadge({ r }: { r: number }) {
  const abs = Math.abs(r);
  const isStrong = abs > 0.4;
  return (
    <span style={{
      fontFamily: "'Space Grotesk', sans-serif",
      fontSize: 13, fontWeight: 600,
      padding: "3px 10px", borderRadius: 6,
      letterSpacing: "-0.01em",
      background: isStrong ? "rgba(72,199,116,0.12)" : "rgba(255,195,80,0.12)",
      color: isStrong ? "var(--green-bright)" : "var(--amber)",
      border: `1px solid ${isStrong ? "rgba(72,199,116,0.2)" : "rgba(255,195,80,0.2)"}`,
    }}>
      r = {r.toFixed(2)}
    </span>
  );
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0));
  return den === 0 ? 0 : num / den;
}

export default function DashboardPage() {
  const [days, setDays] = useState<Days>(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("farm_time") as Days) || "30";
    return "30";
  });
  const [data, setData] = useState<CombinedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("farm_time", days);
    setData(null);
    setError(null);
    fetch(`/api/combined?days=${days}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d); })
      .catch((e) => setError(String(e)));
  }, [days]);

  const latest = data && data.length > 0 ? data[data.length - 1] : null;
  const prev = data && data.length > 1 ? data[data.length - 2] : null;
  const validShip = data?.filter((r) => r.totalQuantity != null) ?? [];
  const totalShipments = validShip.reduce((s, r) => s + (r.totalQuantity ?? 0), 0);
  const avgShipments = validShip.length > 0 ? Math.round(totalShipments / validShip.length) : 0;
  const validSun = data?.filter((r) => r.sunshine != null) ?? [];
  const avgSunshine = validSun.length > 0 ? (validSun.reduce((s, r) => s + (r.sunshine ?? 0), 0) / validSun.length).toFixed(1) : "—";
  const validHum = data?.filter((r) => r.humidity != null) ?? [];
  const avgHumidity = validHum.length > 0 ? Math.round(validHum.reduce((s, r) => s + (r.humidity ?? 0), 0) / validHum.length) : 0;

  const shipArr = data?.map((r) => r.totalQuantity).filter((v): v is number => v != null) ?? [];
  const tempArr = data?.map((r) => r.tempMax).filter((v): v is number => v != null) ?? [];
  const sunArr  = data?.map((r) => r.sunshine).filter((v): v is number => v != null) ?? [];
  const rTemp = shipArr.length > 1 ? pearson(shipArr, tempArr.slice(-shipArr.length)) : 0;
  const rSun  = shipArr.length > 1 ? pearson(shipArr, sunArr.slice(-shipArr.length)) : 0;

  return (
    <div className="flex flex-col" style={{ height: "100vh", overflow: "hidden" }}>
      {/* Topbar */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{ height: 60, padding: "0 28px", background: "var(--bg2)", borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2.5" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>
          ダッシュボード
          <span style={{ fontSize: 10, background: "rgba(72,199,116,0.15)", color: "var(--green-bright)", border: "1px solid rgba(72,199,116,0.25)", borderRadius: 20, padding: "2px 8px", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Live
          </span>
        </div>
        <div
          className="flex gap-1"
          style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 3 }}
        >
          {TIME_OPTS.map((o) => (
            <button
              key={o.id}
              onClick={() => setDays(o.id)}
              style={{
                background: days === o.id ? "var(--green)" : "none",
                border: "none",
                color: days === o.id ? "#fff" : "var(--text-muted)",
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 12, fontWeight: 500,
                padding: "5px 12px", borderRadius: 7,
                cursor: "pointer", transition: "all 0.15s",
                letterSpacing: "0.01em",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div
        style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}
      >
        {error && (
          <div style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#fca5a5" }}>
            ⚠️ データの取得に失敗しました: {error}
          </div>
        )}

        {!data && !error ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{ height: 120, background: "var(--surface)", border: "1px solid var(--border-subtle)" }} />
            ))}
          </div>
        ) : (
          <SummaryCards
            latest={latest}
            prev={prev}
            totalShipments={totalShipments}
            avgShipments={avgShipments}
            avgSunshine={avgSunshine}
            avgHumidity={avgHumidity}
          />
        )}

        {/* Charts 2-column */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <ChartCard title="出荷数量 × 最高気温" dotColor="var(--green)" tag={data ? `r = ${rTemp.toFixed(2)}` : ""} delay={2}>
            {!data && !error ? <ChartSkeleton /> : data ? <ShippingTempChart data={data} /> : null}
            <div className="flex gap-4" style={{ marginTop: 12 }}>
              <div className="flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(72,199,116,0.7)" }} />
                出荷数量(箱)
              </div>
              <div className="flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                <div style={{ width: 18, height: 2, borderRadius: 1, background: "oklch(0.74 0.16 68)" }} />
                最高気温(℃)
              </div>
            </div>
          </ChartCard>

          <ChartCard title="出荷数量 × 日照時間" dotColor="var(--gold)" tag={data ? `r = ${rSun.toFixed(2)}` : ""} delay={3}>
            {!data && !error ? <ChartSkeleton /> : data ? <SunshineChart data={data} /> : null}
            <div className="flex gap-4" style={{ marginTop: 12 }}>
              <div className="flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(72,199,116,0.7)" }} />
                出荷数量(箱)
              </div>
              <div className="flex items-center gap-1.5" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                <div style={{ width: 18, height: 2, borderRadius: 1, background: "oklch(0.82 0.14 90)" }} />
                日照時間(h)
              </div>
            </div>
          </ChartCard>

          {/* Full width temp trend */}
          <ChartCard title="気温推移（最低・平均・最高）" dotColor="oklch(0.65 0.18 25)" tag="℃" fullWidth delay={4}>
            {!data && !error ? <ChartSkeleton height={180} /> : data ? <TempTrendChart data={data} /> : null}
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
    </div>
  );
}
