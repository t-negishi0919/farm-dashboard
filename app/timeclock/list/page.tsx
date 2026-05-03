"use client";

import { useEffect, useMemo, useState } from "react";
import { TIMECLOCK_USERS } from "@/lib/users";
import type { TimeclockEntry } from "@/lib/timeclock";

type Range = "thisMonth" | "lastMonth" | "last30";

const RANGE_OPTS: { id: Range; label: string }[] = [
  { id: "thisMonth", label: "今月" },
  { id: "lastMonth", label: "先月" },
  { id: "last30",    label: "直近30日" },
];

function rangeDates(range: Range): { from: string; to: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  if (range === "thisMonth") {
    const from = `${y}-${pad(m + 1)}-01`;
    const last = new Date(y, m + 1, 0).getDate();
    return { from, to: `${y}-${pad(m + 1)}-${pad(last)}` };
  }
  if (range === "lastMonth") {
    const ly = m === 0 ? y - 1 : y;
    const lm = m === 0 ? 11 : m - 1;
    const last = new Date(ly, lm + 1, 0).getDate();
    return { from: `${ly}-${pad(lm + 1)}-01`, to: `${ly}-${pad(lm + 1)}-${pad(last)}` };
  }
  // last30
  const start = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { from: ymd(start), to: ymd(today) };
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function formatDateLabel(s: string): string {
  const [, m, d] = s.split("-");
  const dt = new Date(s);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][dt.getDay()];
  return `${parseInt(m, 10)}/${parseInt(d, 10)} (${wd})`;
}

function fmtHM(hours: number | null): string {
  if (!hours) return "0:00";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${pad(m)}`;
}

const USER_COLORS: Record<string, string> = {
  "大輔": "oklch(0.68 0.18 148)",
  "正直": "oklch(0.74 0.16 68)",
  "清江": "oklch(0.72 0.12 215)",
};

export default function TimeclockListPage() {
  const [range, setRange] = useState<Range>("thisMonth");
  const [user, setUser] = useState<string>("all");
  const [data, setData] = useState<TimeclockEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const { from, to } = rangeDates(range);
    const params = new URLSearchParams({ from, to });
    if (user !== "all") params.set("user", user);
    fetch(`/api/timeclock/list?${params.toString()}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => {
        if (ac.signal.aborted) return;
        if (d.error) throw new Error(d.error);
        setData(d.entries ?? []);
        setError(null);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        if (e instanceof Error && e.name === "AbortError") return;
        setError(String(e));
      });
    return () => ac.abort();
  }, [range, user]);

  const summary = useMemo(() => {
    if (!data) return null;
    const map = new Map<string, { days: number; worked: number; rest: number }>();
    for (const e of data) {
      if (!e.user) continue;
      const cur = map.get(e.user) ?? { days: 0, worked: 0, rest: 0 };
      cur.days += 1;
      cur.worked += e.workedHours ?? 0;
      cur.rest += e.breakHours ?? 0;
      map.set(e.user, cur);
    }
    return Array.from(map.entries()).map(([u, v]) => ({ user: u, ...v }));
  }, [data]);

  return (
    <div className="flex flex-col" data-page-shell style={{ height: "100vh", overflow: "hidden" }}>
      <div className="flex items-center justify-between shrink-0" data-page-topbar
        style={{ height: 60, padding: "0 28px", background: "var(--bg2)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div data-page-title style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>
          勤怠一覧
        </div>
        <div className="flex" style={{ gap: 6, flexWrap: "wrap" }}>
          <div className="flex gap-1" style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: 3 }}>
            {RANGE_OPTS.map((o) => (
              <button
                key={o.id}
                onClick={() => setRange(o.id)}
                style={{
                  border: "none", cursor: "pointer", transition: "all 0.15s",
                  fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, fontWeight: 500,
                  padding: "5px 12px", borderRadius: 7,
                  background: range === o.id ? "var(--green)" : "transparent",
                  color: range === o.id ? "#fff" : "var(--text-muted)",
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          <select
            value={user}
            onChange={(e) => setUser(e.target.value)}
            style={{
              background: "var(--surface-hover)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text)",
              borderRadius: 8,
              padding: "5px 12px",
              fontSize: 12,
              cursor: "pointer", outline: "none",
            }}
          >
            <option value="all">全員</option>
            {TIMECLOCK_USERS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      <div data-page-content style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
        {error && (
          <div style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#fca5a5" }}>
            ⚠️ {error}
          </div>
        )}

        {summary && summary.length > 0 && (
          <div data-summary-row className="flex" style={{ gap: 12 }}>
            {summary.map((s) => (
              <div key={s.user} style={{
                background: "var(--surface)", border: "1px solid var(--border-subtle)",
                borderRadius: 12, padding: "14px 18px", flex: 1, minWidth: 0,
                position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: USER_COLORS[s.user] ?? "var(--green)" }} />
                <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.06em" }}>{s.user}</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.03em", marginTop: 2, color: USER_COLORS[s.user] ?? "var(--green-bright)" }}>
                  {fmtHM(s.worked)}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4, fontFamily: "'Space Grotesk', sans-serif" }}>
                  {s.days}日 / 休憩 {fmtHM(s.rest)}
                </div>
              </div>
            ))}
          </div>
        )}

        {!data && !error ? (
          <div className="flex items-center justify-center" style={{ height: 200 }}>
            <div className="animate-spin" style={{ width: 40, height: 40, border: "3px solid var(--border-subtle)", borderTopColor: "var(--green-bright)", borderRadius: "50%" }} />
          </div>
        ) : data && data.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-dim)", padding: 24, textAlign: "center" }}>
            この期間の勤怠データはありません
          </div>
        ) : data ? (
          <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 12, overflow: "auto", background: "var(--surface)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Space Grotesk', sans-serif" }}>
              <thead>
                <tr style={{ background: "var(--surface-hover)", borderBottom: "1px solid var(--border-subtle)" }}>
                  {["日付", "名前", "出勤", "休憩1", "休憩2", "休憩3", "退勤", "実働", "休憩計"].map((h) => (
                    <th key={h} style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", padding: "10px 12px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((e, i) => (
                  <tr key={`${e.date}-${e.user}-${i}`} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ fontSize: 12, color: "var(--green-bright)", padding: "10px 12px", whiteSpace: "nowrap" }}>{formatDateLabel(e.date)}</td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      <span style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 999,
                        background: `${USER_COLORS[e.user] ?? "var(--green)"}22`,
                        color: USER_COLORS[e.user] ?? "var(--green-bright)",
                        fontWeight: 600,
                      }}>{e.user}</span>
                    </td>
                    <td style={cellStyle(e.punchIn)}>{e.punchIn ?? "—"}</td>
                    {[0, 1, 2].map((bi) => {
                      const b = e.breaks?.[bi];
                      const txt = !b || !b.start ? null
                        : b.end ? `${b.start}〜${b.end}` : `${b.start}〜`;
                      return (
                        <td key={bi} style={cellStyle(txt)}>{txt ?? "—"}</td>
                      );
                    })}
                    <td style={cellStyle(e.punchOut)}>{e.punchOut ?? "—"}</td>
                    <td style={{ fontSize: 12, padding: "10px 12px", color: "var(--green-bright)", fontWeight: 600 }}>{fmtHM(e.workedHours)}</td>
                    <td style={{ fontSize: 12, padding: "10px 12px", color: "var(--text-muted)" }}>{fmtHM(e.breakHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function cellStyle(value: string | null): React.CSSProperties {
  return {
    fontSize: 12,
    padding: "10px 12px",
    color: value ? "var(--text)" : "var(--text-dim)",
    whiteSpace: "nowrap",
  };
}
