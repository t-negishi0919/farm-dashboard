"use client";

import { useState, useEffect } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { ShippingRow } from "@/lib/googleSheets";

const MAIN_GRADES = ["ASS", "AS", "AM", "B", "C", "S", "M"] as const;
const GRADE_COLORS: Record<string, string> = {
  ASS: "oklch(0.68 0.18 148)",
  AS:  "oklch(0.74 0.16 68)",
  AM:  "oklch(0.82 0.14 90)",
  B:   "oklch(0.72 0.12 215)",
  C:   "oklch(0.65 0.18 25)",
  S:   "oklch(0.80 0.12 300)",
  M:   "oklch(0.75 0.10 180)",
};

function fmt(v: number | null, unit = ""): string {
  if (v === null) return "—";
  return `${v.toLocaleString()}${unit}`;
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "16px 20px", flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600, color, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

type Period = "all" | "thisMonth" | "lastMonth";
const PERIOD_OPTS: { id: Period; label: string }[] = [
  { id: "all",       label: "全期間" },
  { id: "thisMonth", label: "今月" },
  { id: "lastMonth", label: "先月" },
];

function filterByPeriod(data: ShippingRow[], period: Period): ShippingRow[] {
  if (period === "all") return data;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const [fy, fm] = period === "thisMonth" ? [y, m] : m === 0 ? [y - 1, 11] : [y, m - 1];
  const prefix = `${fy}-${String(fm + 1).padStart(2, "0")}`;
  return data.filter((r) => r.shippingDate.startsWith(prefix));
}

export default function ShippingPage() {
  const [data, setData]     = useState<ShippingRow[] | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("all");

  useEffect(() => {
    fetch("/api/shipping")
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d); })
      .catch((e) => setError(String(e)));
  }, []);

  const filtered = data ? filterByPeriod([...data].reverse(), period) : [];

  const totalQty     = filtered.reduce((s, r) => s + (r.totalQuantity ?? 0), 0);
  const totalPayment = filtered.reduce((s, r) => s + (r.payment ?? 0), 0);
  const topGrade     = MAIN_GRADES.reduce((best, g) =>
    (filtered.reduce((s, r) => s + (r.grades[g]?.quantity ?? 0), 0) >
     filtered.reduce((s, r) => s + (r.grades[best]?.quantity ?? 0), 0)) ? g : best,
    MAIN_GRADES[0]
  );
  const topGradeQty = filtered.reduce((s, r) => s + (r.grades[topGrade]?.quantity ?? 0), 0);

  return (
    <div className="flex flex-col" data-page-shell style={{ height: "100vh", overflow: "hidden" }}>
      {/* Topbar */}
      <div className="flex items-center justify-between shrink-0" data-page-topbar style={{ height: 60, padding: "0 28px", background: "var(--bg2)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div data-page-title style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>
          出荷記録
        </div>
        <div className="flex gap-1" style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 3 }}>
          {PERIOD_OPTS.map((o) => (
            <button
              key={o.id}
              onClick={() => setPeriod(o.id)}
              style={{
                border: "none", cursor: "pointer", transition: "all 0.15s",
                fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 500,
                padding: "5px 12px", borderRadius: 7, letterSpacing: "0.01em",
                background: period === o.id ? "var(--green)" : "transparent",
                color: period === o.id ? "#fff" : "var(--text-muted)",
              }}
            >
              {o.label}
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

        {/* Summary cards */}
        {!data && !error ? (
          <div className="flex items-center justify-center" style={{ height: "calc(100vh - 120px)" }}>
            <div className="animate-spin" style={{ width: 56, height: 56, border: "4px solid var(--border-subtle)", borderTopColor: "var(--green-bright)", borderRadius: "50%" }} />
          </div>
        ) : (
          <>
            <div className="flex gap-4" data-summary-row>
              <SummaryCard label="出荷合計" value={fmt(totalQty, " 箱")} sub={`${filtered.length} 件`} color="var(--green-bright)" />
              <SummaryCard label="支払合計" value={`¥${totalPayment.toLocaleString()}`} sub={filtered.length > 0 ? `平均 ¥${Math.round(totalPayment / filtered.length).toLocaleString()} / 回` : undefined} color="oklch(0.82 0.14 90)" />
              <SummaryCard label="主力等級" value={topGrade} sub={`${topGradeQty} 箱`} color={GRADE_COLORS[topGrade] ?? "var(--text)"} />
            </div>

            {/* Grade quantity bar */}
            {filtered.length > 0 && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 12, padding: "16px 20px" }}>
                <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>等級別出荷数量</div>
                <div className="flex gap-3 items-end" style={{ height: 60 }}>
                  {MAIN_GRADES.map((g) => {
                    const qty = filtered.reduce((s, r) => s + (r.grades[g]?.quantity ?? 0), 0);
                    const max = Math.max(...MAIN_GRADES.map((gg) => filtered.reduce((s, r) => s + (r.grades[gg]?.quantity ?? 0), 0)));
                    const pct = max > 0 ? (qty / max) * 100 : 0;
                    return (
                      <div key={g} className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontFamily: "'Space Grotesk', sans-serif", color: GRADE_COLORS[g], fontWeight: 600 }}>{qty || "—"}</div>
                        <div style={{ width: "100%", height: Math.max(pct * 0.4, pct > 0 ? 4 : 0), background: GRADE_COLORS[g], borderRadius: 3, opacity: 0.8, transition: "height 0.3s" }} />
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{g}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Table */}
            <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "auto" }}>
              <Table>
                <TableHeader>
                  <TableRow style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--surface)" }}>
                    <TableHead style={{ ...thStyle }}>出荷日</TableHead>
                    {MAIN_GRADES.map((g) => (
                      <TableHead key={g} style={{ ...thStyle, color: GRADE_COLORS[g] }}>{g}</TableHead>
                    ))}
                    <TableHead style={{ ...thStyle }}>合計(箱)</TableHead>
                    <TableHead style={{ ...thStyle }}>小計</TableHead>
                    <TableHead style={{ ...thStyle }}>消費税</TableHead>
                    <TableHead style={{ ...thStyle }}>手数料+運賃</TableHead>
                    <TableHead style={{ ...thStyle, color: "oklch(0.82 0.14 90)" }}>支払額</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r, i) => {
                    const fees = (r.marketFee ?? 0) + (r.jaFee ?? 0) + (r.shippingFee ?? 0);
                    return (
                      <TableRow
                        key={`${r.shippingDate}-${i}`}
                        style={{ borderBottom: "1px solid var(--border-subtle)", transition: "background 0.1s" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "var(--surface-hover)")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
                      >
                        <TableCell style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 500, color: "var(--green-bright)", padding: "8px 12px", whiteSpace: "nowrap" }}>
                          {r.shippingDate}
                        </TableCell>
                        {MAIN_GRADES.map((g) => (
                          <TableCell key={g} style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, textAlign: "right", padding: "8px 12px", color: r.grades[g]?.quantity ? GRADE_COLORS[g] : "var(--text-dim)" }}>
                            {r.grades[g]?.quantity ?? "—"}
                          </TableCell>
                        ))}
                        <TableCell style={{ ...tdNumStyle }}>{fmt(r.totalQuantity)}</TableCell>
                        <TableCell style={{ ...tdNumStyle }}>¥{fmt(r.subtotal)}</TableCell>
                        <TableCell style={{ ...tdNumStyle }}>¥{fmt(r.tax)}</TableCell>
                        <TableCell style={{ ...tdNumStyle }}>¥{fees > 0 ? fees.toLocaleString() : "—"}</TableCell>
                        <TableCell style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, textAlign: "right", padding: "8px 12px", fontWeight: 600, color: "oklch(0.82 0.14 90)" }}>
                          ¥{fmt(r.payment)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 500, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "var(--text-muted)",
  padding: "10px 12px", whiteSpace: "nowrap",
};

const tdNumStyle: React.CSSProperties = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: 12, textAlign: "right",
  padding: "8px 12px", color: "var(--text-muted)",
};
