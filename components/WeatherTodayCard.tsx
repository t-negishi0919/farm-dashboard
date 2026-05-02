"use client";

import { useState } from "react";
import type { TodayWeather, DailyForecast } from "@/app/api/today-weather/route";

type View = "today" | "tomorrow" | "weekly";

const VIEW_OPTS: { id: View; label: string }[] = [
  { id: "today",    label: "今日" },
  { id: "tomorrow", label: "明日" },
  { id: "weekly",   label: "週間" },
];

function fmt(v: number | null | undefined, digits = 1): string {
  if (v == null) return "—";
  return v.toFixed(digits);
}

function ymd(d: string): { md: string; weekday: string } {
  // d = "YYYY-MM-DD"
  const date = new Date(d + "T00:00:00+09:00");
  const md = `${date.getMonth() + 1}/${date.getDate()}`;
  const wd = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return { md, weekday: wd };
}

export function WeatherTodayCard({ data }: { data: TodayWeather | null }) {
  const [view, setView] = useState<View>("today");

  if (!data) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>天気情報を読み込み中…</div>
      </div>
    );
  }

  // ヘッダ
  const header = (
    <div className="flex items-center justify-between" style={{ marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
      <div className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "oklch(0.72 0.12 215)" }} />
        天気（板倉町）
      </div>
      <div className="flex" style={{ background: "var(--surface-hover)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 2, gap: 1 }}>
        {VIEW_OPTS.map((o) => (
          <button
            key={o.id}
            onClick={() => setView(o.id)}
            style={{
              border: "none",
              cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 11, fontWeight: 500,
              padding: "3px 10px", borderRadius: 6,
              background: view === o.id ? "var(--green)" : "transparent",
              color: view === o.id ? "#fff" : "var(--text-muted)",
              transition: "all 0.15s",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={cardStyle}>
      {header}
      {view === "today" && (
        <DayDetail
          forecast={{
            date: data.date,
            weather: data.weather,
            tempMax: data.tempMax,
            tempMin: data.tempMin,
            precipitation: data.precipitation,
            precipitationProb: data.weekly[0]?.precipitationProb ?? null,
            sunshine: data.sunshine,
            windMax: data.windMax,
            hourly: data.hourly,
          }}
          dayLabel="今日"
        />
      )}
      {view === "tomorrow" && data.tomorrow && (
        <DayDetail forecast={data.tomorrow} dayLabel="明日" />
      )}
      {view === "tomorrow" && !data.tomorrow && (
        <div style={{ fontSize: 12, color: "var(--text-dim)", padding: "20px 0" }}>明日のデータがありません。</div>
      )}
      {view === "weekly" && <WeeklyView weekly={data.weekly} />}
    </div>
  );
}

function DayDetail({ forecast, dayLabel }: { forecast: DailyForecast; dayLabel: string }) {
  const { md, weekday } = ymd(forecast.date);
  return (
    <>
      <div className="flex items-center justify-between" style={{ marginBottom: 14, gap: 16, flexWrap: "wrap" }}>
        <div className="flex items-center gap-3">
          <div style={{ fontSize: 36, lineHeight: 1 }}>{forecast.weather.emoji}</div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
              {dayLabel} · {md}（{weekday}）
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>
              {forecast.weather.label}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap" style={{ gap: 16, fontSize: 13, color: "var(--text-muted)" }}>
          <Stat icon="🔴" label="最高" value={`${fmt(forecast.tempMax, 1)}℃`} color="oklch(0.65 0.18 25)" />
          <Stat icon="🔵" label="最低" value={`${fmt(forecast.tempMin, 1)}℃`} color="oklch(0.72 0.12 215)" />
          <Stat icon="☔" label="降水" value={`${fmt(forecast.precipitation, 1)}mm`} />
          {forecast.precipitationProb != null && (
            <Stat icon="🌂" label="降水率" value={`${fmt(forecast.precipitationProb, 0)}%`} />
          )}
          <Stat icon="☀️" label="日照" value={`${fmt(forecast.sunshine, 1)}h`} />
          <Stat icon="💨" label="最大風" value={`${fmt(forecast.windMax, 1)}m/s`} />
        </div>
      </div>

      {forecast.hourly.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12, overflowX: "auto" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
            時間別
          </div>
          <table style={{ width: "100%", minWidth: 480, fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={hdrCellStyle}></th>
                {forecast.hourly.map((h) => (
                  <th key={h.hour} style={{ ...hdrCellStyle, textAlign: "center" }}>
                    {String(h.hour).padStart(2, "0")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="天気" cells={forecast.hourly.map((h) => (
                <span style={{ fontSize: 18, lineHeight: 1 }}>{h.emoji}</span>
              ))} />
              <Row label="気温" unit="℃" cells={forecast.hourly.map((h) => fmt(h.temp, 0))} />
              <Row label="風速" unit="m/s" cells={forecast.hourly.map((h) => fmt(h.windspeed, 1))} />
              <Row label="降水" unit="mm" cells={forecast.hourly.map((h) => fmt(h.precipitation, 1))} />
              <Row label="湿度" unit="%" cells={forecast.hourly.map((h) => fmt(h.humidity, 0))} />
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function WeeklyView({ weekly }: { weekly: DailyForecast[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {weekly.map((d, i) => {
        const { md, weekday } = ymd(d.date);
        const isWeekend = weekday === "土" || weekday === "日";
        const dayLabel = i === 0 ? "今日" : i === 1 ? "明日" : "";
        return (
          <div
            key={d.date}
            className="flex items-center"
            style={{
              gap: 10,
              padding: "10px 12px",
              background: i === 0 ? "rgba(72,199,116,0.06)" : "var(--surface-hover)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 10,
            }}
          >
            <div style={{ minWidth: 60 }}>
              <div style={{ fontSize: 11, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: "var(--text)" }}>
                {md}
                <span style={{
                  marginLeft: 4,
                  color: weekday === "日" ? "#f87171" : weekday === "土" ? "oklch(0.72 0.12 215)" : "var(--text-muted)",
                }}>
                  ({weekday})
                </span>
              </div>
              {dayLabel && (
                <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{dayLabel}</div>
              )}
            </div>

            <div style={{ fontSize: 22, lineHeight: 1, minWidth: 28, textAlign: "center" }}>
              {d.weather.emoji}
            </div>

            <div style={{ fontSize: 12, color: "var(--text-muted)", flex: 1, minWidth: 0 }}>
              {d.weather.label}
            </div>

            <div className="flex items-center" style={{ gap: 6, fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600 }}>
              <span style={{ color: "oklch(0.65 0.18 25)" }}>{fmt(d.tempMax, 0)}°</span>
              <span style={{ color: "var(--text-dim)" }}>/</span>
              <span style={{ color: "oklch(0.72 0.12 215)" }}>{fmt(d.tempMin, 0)}°</span>
            </div>

            <div className="flex items-center" style={{ gap: 8, fontSize: 11, color: "var(--text-muted)", minWidth: 0 }}>
              <span title="降水確率">🌂 {d.precipitationProb != null ? `${fmt(d.precipitationProb, 0)}%` : "—"}</span>
              <span title="降水量">{fmt(d.precipitation, 1)}mm</span>
            </div>

            {!isWeekend && null}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{label}</span>
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, color: color ?? "var(--text)", fontSize: 14 }}>{value}</span>
    </div>
  );
}

function Row({ label, unit, cells }: { label: string; unit?: string; cells: React.ReactNode[] }) {
  return (
    <tr>
      <td style={labelCellStyle}>
        {label}
        {unit && <span style={{ marginLeft: 4, fontSize: 10, color: "var(--text-dim)" }}>({unit})</span>}
      </td>
      {cells.map((c, i) => (
        <td key={i} style={dataCellStyle}>{c}</td>
      ))}
    </tr>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 14,
  padding: "20px 22px",
};

const hdrCellStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.04em",
  color: "var(--text-dim)",
  fontWeight: 500,
  padding: "4px 6px",
  textAlign: "left",
};

const labelCellStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  padding: "6px 6px",
  whiteSpace: "nowrap",
  borderTop: "1px dashed var(--border-subtle)",
};

const dataCellStyle: React.CSSProperties = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: 13,
  color: "var(--text)",
  textAlign: "center",
  padding: "6px 6px",
  borderTop: "1px dashed var(--border-subtle)",
  whiteSpace: "nowrap",
};
