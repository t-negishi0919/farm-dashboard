"use client";

import { useState } from "react";
import Image from "next/image";
import type { GrowthRow } from "@/lib/googleSheets";

const STATUS_STYLE: Record<string, { bg: string; border: string; dot: string }> = {
  良好:  { bg: "rgba(72,199,116,0.08)",  border: "rgba(72,199,116,0.2)",  dot: "oklch(0.68 0.18 148)" },
  要注意: { bg: "rgba(255,195,80,0.08)",  border: "rgba(255,195,80,0.2)",  dot: "oklch(0.74 0.16 68)" },
  異常:  { bg: "rgba(220,80,60,0.1)",    border: "rgba(220,80,60,0.25)",  dot: "oklch(0.65 0.18 25)" },
};

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDow(y: number, m: number) { return new Date(y, m, 1).getDay(); }

export function GrowthCalendar({ data }: { data: GrowthRow[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<GrowthRow[] | null>(null);

  const byDate = new Map<string, GrowthRow[]>();
  for (const row of data) {
    if (!byDate.has(row.date)) byDate.set(row.date, []);
    byDate.get(row.date)!.push(row);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDow(year, month);

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
        <button
          onClick={prevMonth}
          style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-hover)", border: "1px solid var(--border-subtle)", borderRadius: 6, color: "var(--text-muted)", cursor: "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.15s" }}
        >
          ‹
        </button>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--text)", minWidth: 90, textAlign: "center" }}>
          {year}年{month + 1}月
        </span>
        <button
          onClick={nextMonth}
          style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-hover)", border: "1px solid var(--border-subtle)", borderRadius: 6, color: "var(--text-muted)", cursor: "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.15s" }}
        >
          ›
        </button>
      </div>

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {["日","月","火","水","木","金","土"].map((d, i) => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 500, padding: "4px 0", color: i === 0 ? "oklch(0.65 0.18 25)" : i === 6 ? "oklch(0.72 0.12 215)" : "var(--text-dim)", letterSpacing: "0.05em" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const rows = byDate.get(dateStr) || [];
          const status = rows[0]?.status || "";
          const style = STATUS_STYLE[status];
          const thumb = rows[0]?.photoUrl;

          return (
            <div
              key={idx}
              onClick={() => rows.length > 0 && setSelected(rows)}
              style={{
                minHeight: 64, borderRadius: 6,
                border: `1px solid ${style?.border || "var(--border-subtle)"}`,
                background: style?.bg || "var(--surface)",
                padding: 6, cursor: rows.length > 0 ? "pointer" : "default",
                transition: "border-color 0.15s, transform 0.15s",
                position: "relative",
              }}
              onMouseEnter={(e) => { if (rows.length > 0) (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }}>
                  {day}
                </span>
                {style && <span style={{ width: 5, height: 5, borderRadius: "50%", background: style.dot, display: "inline-block" }} />}
              </div>
              {thumb && (
                <div style={{ position: "relative", width: "100%", aspectRatio: "1", borderRadius: 4, overflow: "hidden" }}>
                  <Image src={thumb} alt={dateStr} fill sizes="72px" className="object-cover" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{ background: "var(--bg2)", border: "1px solid var(--border-strong)", borderRadius: 14, maxWidth: 440, width: "100%", maxHeight: "80vh", overflowY: "auto", padding: 24, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center" style={{ marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--green-bright)" }}>
                {selected[0].date}
              </h3>
              <button
                onClick={() => setSelected(null)}
                style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-hover)", border: "1px solid var(--border-subtle)", borderRadius: 6, color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {selected.map((row, i) => (
                <div key={i}>
                  {i > 0 && <hr style={{ borderColor: "var(--border-subtle)", marginBottom: 20 }} />}
                  <p style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "'Space Grotesk', sans-serif", marginBottom: 10 }}>{row.time}</p>
                  {row.photoUrl && (
                    <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-subtle)", marginBottom: 12 }}>
                      <Image src={row.photoUrl} alt="生育写真" fill sizes="400px" className="object-cover" />
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                    <p style={{ color: "var(--text)" }}>
                      <span style={{ color: "var(--green-bright)", fontWeight: 500 }}>AI判定: </span>
                      {row.aiSummary}
                    </p>
                    {row.comment && (
                      <p style={{ color: "var(--text-muted)" }}>
                        <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>コメント: </span>
                        {row.comment}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
