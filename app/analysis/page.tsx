"use client";

import { useState, useEffect } from "react";
import { ScatterChart } from "@/components/ScatterChart";
import type { CombinedRow } from "@/lib/googleSheets";

export default function AnalysisPage() {
  const [data, setData] = useState<CombinedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/combined?days=all")
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d); })
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="flex flex-col" style={{ height: "100vh", overflow: "hidden" }}>
      {/* Topbar */}
      <div className="flex items-center shrink-0" style={{ height: 60, padding: "0 28px", background: "var(--bg2)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>
          相関分析
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
        {error && (
          <div style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#fca5a5" }}>
            ⚠️ データの取得に失敗しました: {error}
          </div>
        )}

        <div
          style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 14, padding: "20px 22px", transition: "border-color 0.2s" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-strong)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-subtle)")}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--cyan)" }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>気象指標 × 出荷数量 散布図</span>
          </div>
          {!data && !error ? (
            <div style={{ height: 300, background: "var(--surface-hover)", borderRadius: 6 }} />
          ) : data ? (
            <ScatterChart data={data} />
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-muted)" }}>
          <span style={{ color: "var(--green-bright)", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>|r| ≥ 0.7</span> 強い相関
          <span style={{ color: "var(--amber)", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>|r| ≥ 0.4</span> 中程度の相関
          <span style={{ color: "var(--text-muted)", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>|r| &lt; 0.4</span> 弱い相関
        </div>
      </div>
    </div>
  );
}
