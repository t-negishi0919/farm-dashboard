"use client";

import { useState } from "react";
import Image from "next/image";
import type { TroubleRow } from "@/lib/googleSheets";

const URGENCY_STYLE: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  高: { bg: "rgba(220,80,60,0.1)",   border: "rgba(220,80,60,0.25)",  dot: "oklch(0.65 0.18 25)", label: "🆘 緊急" },
  中: { bg: "rgba(255,195,80,0.08)", border: "rgba(255,195,80,0.2)",  dot: "oklch(0.74 0.16 68)", label: "⚠️ 注意" },
  低: { bg: "rgba(72,199,116,0.08)", border: "rgba(72,199,116,0.2)",  dot: "oklch(0.68 0.18 148)", label: "ℹ️ 軽微" },
};

const STATUS_STYLE: Record<string, { bg: string; border: string; dot: string }> = {
  緊急:  { bg: "rgba(220,80,60,0.1)",   border: "rgba(220,80,60,0.25)",  dot: "oklch(0.65 0.18 25)" },
  要注意: { bg: "rgba(255,195,80,0.08)", border: "rgba(255,195,80,0.2)",  dot: "oklch(0.74 0.16 68)" },
  良好:  { bg: "rgba(72,199,116,0.08)", border: "rgba(72,199,116,0.2)",  dot: "oklch(0.68 0.18 148)" },
};

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10, color: "var(--text-dim)", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{value}</span>
    </div>
  );
}

export function TroubleList({ data }: { data: TroubleRow[] }) {
  const [selected, setSelected] = useState<TroubleRow | null>(null);

  const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: 200, color: "var(--text-muted)", fontSize: 13 }}>
        不調相談の記録はありません
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sorted.map((row, i) => {
        const urgStyle = URGENCY_STYLE[row.urgency] || URGENCY_STYLE["低"];
        const stStyle = STATUS_STYLE[row.status] || STATUS_STYLE["要注意"];

        return (
          <div
            key={i}
            onClick={() => setSelected(row)}
            style={{
              background: stStyle.bg,
              border: `1px solid ${stStyle.border}`,
              borderRadius: 10,
              padding: "14px 16px",
              cursor: "pointer",
              transition: "border-color 0.15s, transform 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <div className="flex items-center gap-2">
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: stStyle.dot, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                  {row.date}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{row.time}</span>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                background: urgStyle.bg, border: `1px solid ${urgStyle.border}`, color: urgStyle.dot,
              }}>
                {urgStyle.label}
              </span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>
              {row.diagnosis || "診断結果なし"}
            </p>
            {row.cause && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.cause}
              </p>
            )}
          </div>
        );
      })}

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{ background: "var(--bg2)", border: "1px solid var(--border-strong)", borderRadius: 14, maxWidth: 460, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: 24, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center" style={{ marginBottom: 20 }}>
              <div>
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--green-bright)" }}>
                  {selected.date}
                </h3>
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{selected.time}</span>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-hover)", border: "1px solid var(--border-subtle)", borderRadius: 6, color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}
              >
                ✕
              </button>
            </div>

            {selected.photoUrl && (
              <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-subtle)", marginBottom: 20 }}>
                <Image src={selected.photoUrl} alt="不調写真" fill sizes="420px" className="object-cover" />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {selected.urgency && (
                <div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                    background: (URGENCY_STYLE[selected.urgency] || URGENCY_STYLE["低"]).bg,
                    border: `1px solid ${(URGENCY_STYLE[selected.urgency] || URGENCY_STYLE["低"]).border}`,
                    color: (URGENCY_STYLE[selected.urgency] || URGENCY_STYLE["低"]).dot,
                  }}>
                    {(URGENCY_STYLE[selected.urgency] || URGENCY_STYLE["低"]).label}
                  </span>
                </div>
              )}
              <Field label="診断結果" value={selected.diagnosis} />
              <Field label="原因" value={selected.cause} />
              <Field label="今すぐやること" value={selected.action} />
              <Field label="予防策" value={selected.prevention} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
