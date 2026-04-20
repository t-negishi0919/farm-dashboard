"use client";

import { useState, useEffect } from "react";
import { GrowthCalendar } from "@/components/GrowthCalendar";
import type { GrowthRow } from "@/lib/googleSheets";

export default function GrowthPage() {
  const [data, setData] = useState<GrowthRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/growth")
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d); })
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="flex flex-col" style={{ height: "100vh", overflow: "hidden" }}>
      {/* Topbar */}
      <div className="flex items-center shrink-0" style={{ height: 60, padding: "0 28px", background: "var(--bg2)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>
          生育カレンダー
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
        {error && (
          <div style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#fca5a5" }}>
            ⚠️ データの取得に失敗しました: {error}
          </div>
        )}

        <div
          style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "20px 22px" }}
        >
          {!data && !error ? (
            <div className="flex items-center justify-center" style={{ height: "calc(100vh - 160px)" }}>
              <div className="animate-spin" style={{ width: 56, height: 56, border: "4px solid var(--border-subtle)", borderTopColor: "var(--green-bright)", borderRadius: "50%" }} />
            </div>
          ) : data ? (
            <GrowthCalendar data={data} />
          ) : null}
        </div>

        <div className="flex gap-5" style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {[
            { label: "良好", color: "oklch(0.68 0.18 148)" },
            { label: "要注意", color: "oklch(0.74 0.16 68)" },
            { label: "異常", color: "oklch(0.65 0.18 25)" },
          ].map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
