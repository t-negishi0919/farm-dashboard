"use client";

import type { CombinedRow } from "@/lib/googleSheets";

type KpiProps = {
  label: string;
  value: string | number | null;
  unit?: string;
  icon: string;
  accent: string;
  trend?: "up" | "down" | null;
  sub?: string;
  delay: number;
};

function KpiCard({ label, value, unit, icon, accent, trend, sub, delay }: KpiProps) {
  return (
    <div
      className={`anim anim-${delay}`}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 0,
        padding: "20px 22px",
        position: "relative",
        overflow: "hidden",
        cursor: "default",
        transition: "border-color 0.2s, transform 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-strong)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-subtle)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      {/* top accent line */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent, opacity: 0.7 }} />
      {/* glow */}
      <div style={{ position: "absolute", width: 80, height: 80, borderRadius: "50%", background: accent, opacity: 0.07, bottom: -20, right: -10, filter: "blur(20px)" }} />

      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {label}
        </div>
        <div
          className="flex items-center justify-center text-base"
          style={{ width: 32, height: 32, borderRadius: 8, background: `${accent}22` }}
        >
          {icon}
        </div>
      </div>

      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 40, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, color: "#ffffff", textShadow: "0 0 40px rgba(255,255,255,0.08)" }}>
        {value != null ? (
          <>
            {value}
            {unit && <span style={{ fontSize: 15, fontWeight: 400, color: "var(--text-muted)", marginLeft: 3, letterSpacing: 0 }}>{unit}</span>}
          </>
        ) : (
          <span style={{ color: "var(--text-dim)" }}>—</span>
        )}
      </div>

      {sub && (
        <div className="flex items-center gap-1" style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
          {trend === "up" && <span style={{ color: "var(--green-bright)" }}>▲</span>}
          {trend === "down" && <span style={{ color: "var(--red)" }}>▼</span>}
          <span>{sub}</span>
        </div>
      )}
    </div>
  );
}

type Props = {
  latest: CombinedRow | null;
  prev: CombinedRow | null;
  totalShipments: number;
  avgShipments: number;
  avgSunshine: string;
  avgHumidity: number;
};

export function SummaryCards({ latest, prev, totalShipments, avgShipments, avgSunshine, avgHumidity }: Props) {
  const tDiff = (latest && prev && latest.tempMax != null && prev.tempMax != null)
    ? latest.tempMax - prev.tempMax : null;

  return (
    <div className="space-y-3.5">
      {/* Row 1: Weather KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KpiCard
          label="天気" value={latest?.weather || null} icon="🌤"
          accent="oklch(0.72 0.12 215)" delay={1} sub="最新データ"
        />
        <KpiCard
          label="最高気温"
          value={latest?.tempMax != null ? latest.tempMax.toFixed(1) : null}
          unit="℃" icon="🌡" accent="oklch(0.65 0.18 25)" delay={2}
          trend={tDiff != null ? (tDiff >= 0 ? "up" : "down") : null}
          sub={tDiff != null ? `前日比 ${tDiff >= 0 ? "+" : ""}${tDiff.toFixed(1)}℃` : undefined}
        />
        <KpiCard
          label="湿度"
          value={latest?.humidity != null ? Math.round(latest.humidity) : null}
          unit="%" icon="💧" accent="oklch(0.72 0.12 215)" delay={3}
          sub={`平均 ${avgHumidity}%`}
        />
        <KpiCard
          label="日照時間"
          value={latest?.sunshine != null ? latest.sunshine.toFixed(1) : null}
          unit="h" icon="☀️" accent="oklch(0.82 0.14 90)" delay={4}
          sub={`平均 ${avgSunshine}h`}
        />
      </div>

      {/* Row 2: Shipment KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <KpiCard
          label="本日出荷数"
          value={latest?.totalQuantity != null ? latest.totalQuantity : null}
          unit="箱" icon="📦" accent="oklch(0.68 0.18 148)" delay={1}
          trend={latest?.totalQuantity != null && prev?.totalQuantity != null
            ? (latest.totalQuantity >= prev.totalQuantity ? "up" : "down") : null}
          sub={latest?.totalQuantity != null && prev?.totalQuantity != null
            ? `前日比 ${latest.totalQuantity >= prev.totalQuantity ? "+" : ""}${latest.totalQuantity - (prev.totalQuantity ?? 0)}箱`
            : undefined}
        />
        <KpiCard
          label="期間合計出荷"
          value={totalShipments > 0 ? totalShipments.toLocaleString() : null}
          unit="箱" icon="📊" accent="oklch(0.68 0.18 148)" delay={2}
          sub={`日平均 ${avgShipments}箱`}
        />
        <KpiCard
          label="気温帯"
          value={latest?.tempMin != null && latest?.tempMax != null
            ? `${Math.round(latest.tempMin)}〜${Math.round(latest.tempMax)}`
            : null}
          unit="℃" icon="🌡" accent="oklch(0.74 0.16 68)" delay={3}
          sub={latest?.tempAvg != null ? `平均 ${latest.tempAvg.toFixed(1)}℃` : undefined}
        />
      </div>
    </div>
  );
}
