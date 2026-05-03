"use client";

import { useState, useEffect } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { CombinedRow } from "@/lib/googleSheets";

function downloadCsv(data: CombinedRow[]) {
  const headers = ["日付","天気","最低気温","最高気温","平均気温","湿度","降水量","日照時間","蒸発散量","最大風速","出荷数量","支払額"];
  const rows = data.map((r) => [r.date,r.weather,r.tempMin,r.tempMax,r.tempAvg,r.humidity,r.precipitation,r.sunshine,r.et0,r.windspeedMax,r.totalQuantity,r.payment]);
  const csv = [headers, ...rows].map((row) => row.map((v) => v == null ? "" : String(v)).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "farm_data.csv"; a.click();
  URL.revokeObjectURL(url);
}

const COL_COLORS: Record<string, string> = {
  "最低気温": "oklch(0.72 0.12 215)",
  "最高気温": "oklch(0.65 0.18 25)",
  "平均気温": "oklch(0.74 0.16 68)",
  "湿度": "oklch(0.72 0.12 215)",
  "日照時間": "oklch(0.82 0.14 90)",
  "出荷数量": "var(--green-bright)",
};

export default function DataPage() {
  const [data, setData] = useState<CombinedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/combined?days=all")
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setData(d); })
      .catch((e) => setError(String(e)));
  }, []);

  const headers = ["日付","天気","最低気温","最高気温","平均気温","湿度","降水量","日照時間","蒸発散量","最大風速","出荷数量","支払額"];

  return (
    <div className="flex flex-col" data-page-shell style={{ height: "100vh", overflow: "hidden" }}>
      {/* Topbar */}
      <div className="flex items-center justify-between shrink-0" data-page-topbar style={{ height: 60, padding: "0 28px", background: "var(--bg2)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div data-page-title style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>
          データ一覧
        </div>
        <button
          onClick={() => data && downloadCsv(data)}
          disabled={!data}
          style={{
            background: "rgba(72,199,116,0.15)", border: "1px solid rgba(72,199,116,0.25)",
            color: "var(--green-bright)", borderRadius: 8, padding: "6px 16px",
            fontSize: 12, fontWeight: 500, cursor: data ? "pointer" : "not-allowed",
            opacity: data ? 1 : 0.5, fontFamily: "'Space Grotesk', sans-serif",
            letterSpacing: "0.02em", transition: "all 0.15s",
          }}
        >
          CSVダウンロード
        </button>
      </div>

      <div data-page-content style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
        {error && (
          <div style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#fca5a5", marginBottom: 16 }}>
            ⚠️ データの取得に失敗しました: {error}
          </div>
        )}

        {!data && !error ? (
          <div className="flex items-center justify-center" style={{ height: "calc(100vh - 120px)" }}>
            <div className="animate-spin" style={{ width: 56, height: 56, border: "4px solid var(--border-subtle)", borderTopColor: "var(--green-bright)", borderRadius: "50%" }} />
          </div>
        ) : data ? (
          <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "auto" }}>
            <Table>
              <TableHeader>
                <TableRow style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--surface)" }}>
                  {headers.map((h) => (
                    <TableHead
                      key={h}
                      style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", padding: "10px 12px", whiteSpace: "nowrap" }}
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...data].reverse().map((r) => (
                  <TableRow key={r.date} style={{ borderBottom: "1px solid var(--border-subtle)", transition: "background 0.1s" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "var(--surface-hover)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
                  >
                    <TableCell style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 500, color: "var(--green-bright)", padding: "8px 12px", whiteSpace: "nowrap" }}>{r.date}</TableCell>
                    <TableCell style={{ fontSize: 12, color: "var(--text)", padding: "8px 12px" }}>{r.weather || "—"}</TableCell>
                    {[
                      { v: r.tempMin, k: "最低気温" },
                      { v: r.tempMax, k: "最高気温" },
                      { v: r.tempAvg, k: "平均気温" },
                      { v: r.humidity, k: "湿度" },
                      { v: r.precipitation, k: "降水量" },
                      { v: r.sunshine, k: "日照時間" },
                      { v: r.et0, k: "蒸発散量" },
                      { v: r.windspeedMax, k: "最大風速" },
                      { v: r.totalQuantity, k: "出荷数量" },
                      { v: r.payment, k: "支払額" },
                    ].map(({ v, k }) => (
                      <TableCell key={k} style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, textAlign: "right", color: COL_COLORS[k] || "var(--text-muted)", padding: "8px 12px" }}>
                        {v ?? "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
