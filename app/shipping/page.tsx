"use client";

import { useState, useEffect, useMemo } from "react";
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

type SortKey =
  | "date"
  | "ASS" | "AS" | "AM" | "B" | "C" | "S" | "M"
  | "totalQuantity" | "subtotal" | "tax" | "fees" | "payment";
type SortDir = "asc" | "desc";
type SortState = { key: SortKey; dir: SortDir } | null;

function rowValue(r: ShippingRow, key: SortKey): number | string | null {
  switch (key) {
    case "date":          return r.shippingDate;
    case "totalQuantity": return r.totalQuantity;
    case "subtotal":      return r.subtotal;
    case "tax":           return r.tax;
    case "fees":          return (r.marketFee ?? 0) + (r.jaFee ?? 0) + (r.shippingFee ?? 0) || null;
    case "payment":       return r.payment;
    default:              return r.grades[key]?.quantity ?? null;
  }
}

function compareRows(a: ShippingRow, b: ShippingRow, key: SortKey, dir: SortDir): number {
  const va = rowValue(a, key);
  const vb = rowValue(b, key);
  // null は常に末尾
  if (va === null && vb === null) return 0;
  if (va === null) return 1;
  if (vb === null) return -1;
  let cmp: number;
  if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
  else cmp = String(va).localeCompare(String(vb));
  return dir === "asc" ? cmp : -cmp;
}

type Period = "all" | "thisMonth" | "lastMonth";
const PERIOD_OPTS: { id: Period; label: string }[] = [
  { id: "all",       label: "全期間" },
  { id: "thisMonth", label: "今月" },
  { id: "lastMonth", label: "先月" },
];

type YearFilter = "all" | string; // "all" | "2026" | "2025" ...

function filterByPeriod(data: ShippingRow[], period: Period): ShippingRow[] {
  if (period === "all") return data;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const [fy, fm] = period === "thisMonth" ? [y, m] : m === 0 ? [y - 1, 11] : [y, m - 1];
  const prefix = `${fy}-${String(fm + 1).padStart(2, "0")}`;
  return data.filter((r) => r.shippingDate.startsWith(prefix));
}

function filterByYear(data: ShippingRow[], year: YearFilter): ShippingRow[] {
  if (year === "all") return data;
  return data.filter((r) => r.shippingDate.startsWith(`${year}-`));
}

export default function ShippingPage() {
  const [data, setData]     = useState<ShippingRow[] | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("all");
  const [year, setYear]     = useState<YearFilter>("all");
  const [sort, setSort]     = useState<SortState>(null);

  function toggleSort(key: SortKey) {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: "asc" };
      if (cur.dir === "asc") return { key, dir: "desc" };
      return null; // 3 度目で解除
    });
  }

  useEffect(() => {
    fetch("/api/shipping")
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d); })
      .catch((e) => setError(String(e)));
  }, []);

  const availableYears = data
    ? Array.from(new Set(data.map((r) => r.shippingDate.slice(0, 4)).filter(Boolean))).sort((a, b) => b.localeCompare(a))
    : [];

  // 年別を選んだとき、当年以外で「今月/先月」は意味が無いので自動的に「全期間」に戻す
  const effectivePeriod: Period =
    year !== "all" && year !== String(new Date().getFullYear()) && period !== "all"
      ? "all"
      : period;

  const filtered = useMemo(
    () => (data ? filterByPeriod(filterByYear([...data].reverse(), year), effectivePeriod) : []),
    [data, year, effectivePeriod],
  );

  const sortedRows = useMemo(() => {
    if (!sort) return filtered;
    return [...filtered].sort((a, b) => compareRows(a, b, sort.key, sort.dir));
  }, [filtered, sort]);

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
        <div className="flex" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value as YearFilter)}
            style={{
              background: "var(--surface-hover)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text)",
              borderRadius: 8,
              padding: "5px 12px",
              fontSize: 12,
              fontFamily: "'Space Grotesk', sans-serif",
              cursor: "pointer",
              outline: "none",
              minWidth: 92,
            }}
            title="年度フィルター"
          >
            <option value="all">全年度</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <div className="flex gap-1" style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 3 }}>
            {PERIOD_OPTS.map((o) => {
              const disabled =
                year !== "all" && year !== String(new Date().getFullYear()) && o.id !== "all";
              return (
                <button
                  key={o.id}
                  onClick={() => setPeriod(o.id)}
                  disabled={disabled}
                  style={{
                    border: "none",
                    cursor: disabled ? "not-allowed" : "pointer",
                    transition: "all 0.15s",
                    fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 500,
                    padding: "5px 12px", borderRadius: 7, letterSpacing: "0.01em",
                    background: effectivePeriod === o.id ? "var(--green)" : "transparent",
                    color: effectivePeriod === o.id ? "#fff" : disabled ? "var(--text-dim)" : "var(--text-muted)",
                    opacity: disabled ? 0.5 : 1,
                  }}
                  title={disabled ? "今年以外は今月/先月フィルター無効" : undefined}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
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
                    <SortableHead label="出荷日"         sortKey="date"          sort={sort} onToggle={toggleSort} />
                    {MAIN_GRADES.map((g) => (
                      <SortableHead key={g} label={g}    sortKey={g}             sort={sort} onToggle={toggleSort} color={GRADE_COLORS[g]} />
                    ))}
                    <SortableHead label="合計(箱)"       sortKey="totalQuantity" sort={sort} onToggle={toggleSort} />
                    <SortableHead label="小計"           sortKey="subtotal"      sort={sort} onToggle={toggleSort} />
                    <SortableHead label="消費税"         sortKey="tax"           sort={sort} onToggle={toggleSort} />
                    <SortableHead label="手数料+運賃"    sortKey="fees"          sort={sort} onToggle={toggleSort} />
                    <SortableHead label="支払額"         sortKey="payment"       sort={sort} onToggle={toggleSort} color="oklch(0.82 0.14 90)" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((r, i) => {
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

function SortableHead({
  label,
  sortKey,
  sort,
  onToggle,
  color,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onToggle: (k: SortKey) => void;
  color?: string;
}) {
  const active = sort?.key === sortKey;
  const dir = active ? sort!.dir : null;
  const arrow = dir === "asc" ? "▲" : dir === "desc" ? "▼" : "⇅";
  const ariaSort: "ascending" | "descending" | "none" =
    dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none";

  return (
    <TableHead
      tabIndex={0}
      aria-sort={ariaSort}
      onClick={() => onToggle(sortKey)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle(sortKey);
        }
      }}
      style={{
        ...thStyle,
        color: color ?? "var(--text-muted)",
        cursor: "pointer",
        userSelect: "none",
        background: active ? "var(--surface-hover)" : undefined,
      }}
      title={
        active
          ? dir === "asc" ? "昇順 (クリックで降順)" : "降順 (クリックで解除)"
          : "クリックでソート"
      }
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {label}
        <span
          aria-hidden="true"
          style={{
            fontSize: 9,
            opacity: active ? 1 : 0.35,
            color: active ? "var(--green-bright)" : undefined,
          }}
        >
          {arrow}
        </span>
      </span>
    </TableHead>
  );
}
