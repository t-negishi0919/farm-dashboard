"use client";

import { useState, useEffect } from "react";
import { GrowthCalendar } from "@/components/GrowthCalendar";
import { TroubleList } from "@/components/TroubleList";
import type { GrowthRow, TroubleRow } from "@/lib/googleSheets";

type Tab = "shitate" | "trouble";

const TABS: { id: Tab; label: string; dot: string }[] = [
  { id: "shitate", label: "仕立て診断", dot: "oklch(0.68 0.18 148)" },
  { id: "trouble", label: "不調相談",   dot: "oklch(0.65 0.18 25)" },
];

export default function GrowthPage() {
  const [tab, setTab] = useState<Tab>("shitate");
  const [growthData, setGrowthData] = useState<GrowthRow[] | null>(null);
  const [troubleData, setTroubleData] = useState<TroubleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/growth")
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setGrowthData(d); })
      .catch((e) => setError(String(e)));

    fetch("/api/trouble")
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setTroubleData(d); })
      .catch((e) => setError(String(e)));
  }, []);

  const loading = tab === "shitate" ? growthData === null : troubleData === null;

  return (
    <div className="flex flex-col" data-page-shell style={{ height: "100vh", overflow: "hidden" }}>
      {/* Topbar */}
      <div className="flex items-center justify-between shrink-0" data-page-topbar style={{ height: 60, padding: "0 28px", background: "var(--bg2)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div data-page-title style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>
          生育記録
        </div>

        {/* Tabs */}
        <div className="flex gap-1" style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 3 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                border: "none", cursor: "pointer", transition: "all 0.15s",
                fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 500,
                padding: "5px 14px", borderRadius: 7, letterSpacing: "0.01em",
                background: tab === t.id ? "var(--surface-hover)" : "transparent",
                color: tab === t.id ? "var(--text)" : "var(--text-muted)",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.dot, display: "inline-block", flexShrink: 0 }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div data-page-content style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
        {error && (
          <div style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#fca5a5" }}>
            ⚠️ データの取得に失敗しました: {error}
          </div>
        )}

        <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "20px 22px" }}>
          {loading && !error ? (
            <div className="flex items-center justify-center" style={{ height: "calc(100vh - 160px)" }}>
              <div className="animate-spin" style={{ width: 56, height: 56, border: "4px solid var(--border-subtle)", borderTopColor: "var(--green-bright)", borderRadius: "50%" }} />
            </div>
          ) : tab === "shitate" && growthData ? (
            <GrowthCalendar data={growthData} />
          ) : tab === "trouble" && troubleData ? (
            <TroubleList data={troubleData} />
          ) : null}
        </div>

        {tab === "shitate" && (
          <div className="flex gap-5" style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {[
              { label: "良好",  color: "oklch(0.68 0.18 148)" },
              { label: "要注意", color: "oklch(0.74 0.16 68)" },
              { label: "異常",  color: "oklch(0.65 0.18 25)" },
            ].map((s) => (
              <span key={s.label} className="flex items-center gap-1.5">
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        )}

        {tab === "trouble" && (
          <div className="flex gap-5" style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {[
              { label: "緊急（高）", color: "oklch(0.65 0.18 25)" },
              { label: "注意（中）", color: "oklch(0.74 0.16 68)" },
              { label: "軽微（低）", color: "oklch(0.68 0.18 148)" },
            ].map((s) => (
              <span key={s.label} className="flex items-center gap-1.5">
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
