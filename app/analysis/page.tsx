"use client";

import { useEffect, useState } from "react";

type Icon = "sun" | "cloudSun" | "cloud" | "rain";
type ShortDay = {
  date: string; label: string;
  emoji: string;
  boxes: number; yen: number;
  tempMax: number | null;
  sunshine: number | null;
  humidity: number | null;
};
type WeekDay = {
  date: string | null; dow: string;
  cur: number | null; last: number;
  future: boolean;
};
type ForecastDay = {
  date: string; label: string; dow: string;
  icon: Icon; desc: string;
  hi: number | null; lo: number | null;
  est: number | null; n: number;
  status: "ok" | "mid" | "warn";
};
type Insights = {
  today: {
    date: string; label: string;
    weatherEmoji: string;
    weatherIcon: Icon;
    weatherDesc: string;
    tempHi: number | null;
    weekBoxes: number;
    yoy: number | null;
    avgPrice: number | null;
  };
  top: ShortDay[];
  bottom: ShortDay[];
  week: { days: WeekDay[]; total: number; lastTotal: number };
  forecast: ForecastDay[];
};

export default function AnalysisPage() {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/insights", { signal: ac.signal })
      .then((r) => r.json())
      .then((d: Insights & { error?: string }) => {
        if (ac.signal.aborted) return;
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        if (e instanceof Error && e.name === "AbortError") return;
        setError(String(e));
      });
    return () => ac.abort();
  }, []);

  return (
    <div className="ya-root" data-page-shell>
      <div className="ya-app">
        <div className="ya-page-title">
          <h1>収量と天気</h1>
          <span className="ya-live">LIVE</span>
        </div>

        {error && (
          <div className="ya-error">⚠️ データの取得に失敗しました: {error}</div>
        )}

        {!data && !error ? (
          <div className="ya-loading">
            <div className="ya-spinner" />
          </div>
        ) : data ? (
          <>
            <Card1 today={data.today} />
            <Card2 top={data.top} bottom={data.bottom} />
            <Card3 week={data.week} forecast={data.forecast} />
            <Card4 forecast={data.forecast} />
            <Card5 />
          </>
        ) : null}
      </div>

      <style>{`
        .ya-root {
          background: radial-gradient(ellipse at 50% 0%, #0d1610 0%, #050805 70%);
          min-height: 100vh;
          color: #e8f0ea;
          font-family: 'Noto Sans JP', sans-serif;
          width: 100%;
          height: 100vh;
          overflow-y: auto;
        }
        .ya-app {
          max-width: 480px;
          margin: 0 auto;
          padding: 18px 14px 32px;
          display: flex; flex-direction: column;
          gap: 12px;
        }
        .ya-page-title {
          display: flex; align-items: baseline; justify-content: space-between;
          padding: 4px 6px 2px;
        }
        .ya-page-title h1 {
          font-size: 18px; font-weight: 700;
          letter-spacing: 0.01em;
        }
        .ya-live {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 10px;
          color: oklch(0.76 0.22 148);
          letter-spacing: 0.15em;
          font-family: 'Space Grotesk', sans-serif;
          text-transform: uppercase;
        }
        .ya-live::before {
          content: ''; width: 6px; height: 6px; border-radius: 50%;
          background: oklch(0.76 0.22 148);
          box-shadow: 0 0 6px oklch(0.76 0.22 148);
          animation: yaLivePulse 1.6s ease-in-out infinite;
        }
        @keyframes yaLivePulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

        .ya-error {
          background: rgba(220,38,38,0.12);
          border: 1px solid rgba(220,38,38,0.3);
          color: #fca5a5;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 12px;
        }
        .ya-loading {
          display: flex; align-items: center; justify-content: center;
          padding: 80px 0;
        }
        .ya-spinner {
          width: 40px; height: 40px;
          border: 3px solid rgba(255,255,255,0.1);
          border-top-color: oklch(0.76 0.22 148);
          border-radius: 50%;
          animation: yaSpin 0.9s linear infinite;
        }
        @keyframes yaSpin { to { transform: rotate(360deg); } }

        /* Card */
        .ya-card {
          position: relative;
          border-radius: 18px;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02)),
            #0e1612;
          border: 1px solid rgba(255,255,255,0.07);
          padding: 16px;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.04),
            0 24px 40px rgba(0,0,0,0.5);
          overflow: hidden;
          opacity: 0;
          animation: yaCardIn 0.5s ease-out forwards;
        }
        .ya-card::before {
          content: '';
          position: absolute;
          top: 0; left: 16px; right: 16px;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--ya-accent, oklch(0.68 0.18 148)), transparent);
          opacity: 0.7;
        }
        @keyframes yaCardIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ya-card.c1 { animation-delay: 0ms; }
        .ya-card.c2 { animation-delay: 60ms; }
        .ya-card.c3 { animation-delay: 120ms; }
        .ya-card.c4 { animation-delay: 180ms; }
        .ya-card.c5 { animation-delay: 240ms; }

        .ya-card-head {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 12px;
        }
        .ya-card-title {
          font-size: 13px; font-weight: 700;
          color: #e8f0ea;
          display: flex; align-items: center; gap: 8px;
        }
        .ya-pip {
          width: 6px; height: 6px; border-radius: 1px;
          background: var(--ya-accent, oklch(0.68 0.18 148));
          box-shadow: 0 0 6px var(--ya-accent, oklch(0.68 0.18 148));
        }
        .ya-card-sub {
          font-size: 10px;
          color: rgba(232,240,234,0.4);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-family: 'Space Grotesk', sans-serif;
        }

        /* Card 1 */
        .ya-c1 .ya-row {
          display: grid;
          grid-template-columns: auto 1fr 1fr;
          gap: 12px;
          align-items: center;
        }
        .ya-weather-cell { display: flex; align-items: center; gap: 10px; }
        .ya-weather-cell .ya-icon { width: 56px; height: 56px; flex-shrink: 0; }
        .ya-weather-cell .ya-temp {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 30px; font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .ya-weather-cell .ya-temp .ya-unit { font-size: 14px; opacity: 0.6; margin-left: 1px; }
        .ya-weather-cell .ya-desc { font-size: 11px; color: rgba(232,240,234,0.6); margin-top: 4px; }
        .ya-stat {
          display: flex; flex-direction: column;
          padding-left: 12px;
          border-left: 1px solid rgba(255,255,255,0.07);
          height: 56px;
          justify-content: center;
        }
        .ya-stat .ya-lbl {
          font-size: 9px;
          color: rgba(232,240,234,0.4);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-family: 'Space Grotesk', sans-serif;
          margin-bottom: 3px;
        }
        .ya-stat .ya-val {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 20px; font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .ya-stat .ya-val .ya-unit { font-size: 11px; opacity: 0.55; margin-left: 2px; }
        .ya-delta {
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 11px; font-weight: 700;
          margin-top: 4px;
          font-family: 'Space Grotesk', sans-serif;
        }
        .ya-delta.up { color: oklch(0.76 0.22 148); }
        .ya-delta.down { color: #f87171; }

        /* Card 2 */
        .ya-c2 { --ya-accent: oklch(0.68 0.18 148); }
        .ya-sub-card {
          border-radius: 12px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.07);
          overflow: hidden;
          margin-bottom: 10px;
        }
        .ya-sub-card-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          background: rgba(53,129,40,0.08);
        }
        .ya-sub-card.bad .ya-sub-card-head { background: rgba(248,113,113,0.06); }
        .ya-sub-card-title {
          display: flex; align-items: center; gap: 7px;
          font-size: 12px; font-weight: 700;
        }
        .ya-sub-card.good .ya-sub-card-title { color: oklch(0.76 0.22 148); }
        .ya-sub-card.bad .ya-sub-card-title  { color: #fca5a5; }
        .ya-sub-card-title .ya-badge {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 9px; font-weight: 600;
          padding: 2px 6px;
          border-radius: 3px;
          letter-spacing: 0.08em;
        }
        .ya-sub-card.good .ya-badge { background: rgba(94,194,80,0.15); color: oklch(0.76 0.22 148); }
        .ya-sub-card.bad  .ya-badge { background: rgba(248,113,113,0.15); color: #fca5a5; }
        .ya-sub-card-meta {
          font-size: 10px; color: rgba(232,240,234,0.4);
          font-family: 'Space Grotesk', sans-serif;
          letter-spacing: 0.05em;
        }
        .ya-day-row {
          display: grid;
          grid-template-columns: 26px 80px 1fr auto;
          gap: 8px;
          align-items: center;
          padding: 9px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          font-size: 12px;
        }
        .ya-day-row:last-child { border-bottom: none; }
        .ya-day-row .ya-day-icon { font-size: 18px; line-height: 1; text-align: center; }
        .ya-day-row .ya-day-date {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 600;
          color: #e8f0ea;
          font-size: 12px;
        }
        .ya-day-row .ya-day-meta {
          font-size: 10px;
          color: rgba(232,240,234,0.6);
          line-height: 1.4;
          font-family: 'Space Grotesk', sans-serif;
          letter-spacing: 0.02em;
        }
        .ya-day-row .ya-day-vals { text-align: right; line-height: 1.2; }
        .ya-day-row .ya-day-boxes {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 16px;
          letter-spacing: -0.02em;
        }
        .ya-sub-card.good .ya-day-boxes { color: oklch(0.76 0.22 148); }
        .ya-sub-card.bad  .ya-day-boxes { color: #fca5a5; }
        .ya-day-row .ya-day-yen {
          font-size: 10px;
          color: rgba(232,240,234,0.4);
          font-family: 'Space Grotesk', sans-serif;
          margin-top: 1px;
        }

        .ya-insight {
          margin-top: 10px;
          padding: 12px 14px;
          background: linear-gradient(135deg, rgba(94,194,80,0.08), rgba(94,194,80,0.02));
          border: 1px solid rgba(94,194,80,0.18);
          border-radius: 10px;
          font-size: 12px;
          line-height: 1.65;
          color: #e8f0ea;
        }
        .ya-insight .ya-lead {
          display: flex; align-items: center; gap: 6px;
          font-size: 10px; font-weight: 700;
          color: oklch(0.76 0.22 148);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-family: 'Space Grotesk', sans-serif;
          margin-bottom: 6px;
        }
        .ya-insight strong { color: oklch(0.76 0.22 148); font-weight: 700; }
        .ya-insight em { font-style: normal; color: #fca5a5; font-weight: 600; }

        /* Card 3 */
        .ya-c3 { --ya-accent: oklch(0.76 0.22 148); }
        .ya-week-head {
          display: flex; justify-content: space-between; align-items: flex-end;
          margin-bottom: 14px;
        }
        .ya-week-totals .ya-total {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 28px; font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .ya-week-totals .ya-total .ya-unit { font-size: 12px; opacity: 0.55; margin-left: 2px; }
        .ya-week-totals .ya-lbl {
          font-size: 10px; color: rgba(232,240,234,0.4);
          letter-spacing: 0.1em;
          font-family: 'Space Grotesk', sans-serif;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .ya-week-delta { text-align: right; }
        .ya-delta-pill {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 6px 10px;
          border-radius: 6px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 14px; font-weight: 700;
          letter-spacing: -0.01em;
        }
        .ya-delta-pill.up {
          background: rgba(94,194,80,0.15);
          border: 1px solid rgba(94,194,80,0.3);
          color: oklch(0.76 0.22 148);
        }
        .ya-delta-pill.down {
          background: rgba(248,113,113,0.12);
          border: 1px solid rgba(248,113,113,0.25);
          color: #fca5a5;
        }
        .ya-delta-sub {
          font-size: 10px; color: rgba(232,240,234,0.6);
          margin-top: 4px;
          font-family: 'Space Grotesk', sans-serif;
        }
        .ya-week-chart { width: 100%; height: 160px; display: block; }

        /* Card 4 */
        .ya-c4 { --ya-accent: #7dd3fc; }
        .ya-fc-list { display: flex; flex-direction: column; gap: 6px; }
        .ya-fc-row {
          display: grid;
          grid-template-columns: 38px 50px 56px 1fr auto;
          gap: 10px;
          align-items: center;
          padding: 10px 12px;
          background: rgba(255,255,255,0.035);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          font-size: 12px;
        }
        .ya-fc-row .ya-fc-icon { font-size: 22px; text-align: center; line-height: 1; }
        .ya-fc-row .ya-fc-day {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 600;
          font-size: 12px;
        }
        .ya-fc-row .ya-fc-day .ya-fc-dow {
          display: block;
          font-size: 9px;
          color: rgba(232,240,234,0.6);
          font-weight: 500;
          margin-top: 1px;
        }
        .ya-fc-row .ya-fc-temps {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 12px;
          line-height: 1.3;
        }
        .ya-fc-row .ya-fc-hi { color: #fbbf24; font-weight: 600; }
        .ya-fc-row .ya-fc-lo { color: #7dd3fc; opacity: 0.85; }
        .ya-fc-row .ya-fc-est {
          font-size: 10px;
          color: rgba(232,240,234,0.6);
          line-height: 1.4;
        }
        .ya-fc-row .ya-fc-est strong { color: #e8f0ea; font-weight: 600; }
        .ya-fc-row .ya-fc-est .ya-fc-scarce {
          color: rgba(232,240,234,0.4);
          font-size: 9px;
          font-style: italic;
        }
        .ya-chip {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }
        .ya-chip.ok {
          background: rgba(94,194,80,0.14);
          color: oklch(0.76 0.22 148);
          border: 1px solid rgba(94,194,80,0.25);
        }
        .ya-chip.warn {
          background: rgba(248,113,113,0.12);
          color: #fca5a5;
          border: 1px solid rgba(248,113,113,0.25);
        }
        .ya-chip.mid {
          background: rgba(252,211,77,0.1);
          color: #fcd34d;
          border: 1px solid rgba(252,211,77,0.22);
        }

        /* Card 5 */
        .ya-details-wrap {
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.025);
          overflow: hidden;
        }
        .ya-details-wrap summary {
          list-style: none;
          cursor: pointer;
          padding: 12px 16px;
          display: flex; align-items: center; justify-content: space-between;
          font-size: 12px;
          color: rgba(232,240,234,0.6);
          font-family: 'Space Grotesk', sans-serif;
        }
        .ya-details-wrap summary::-webkit-details-marker { display: none; }
        .ya-details-wrap summary::after {
          content: '+';
          font-size: 18px;
          color: rgba(232,240,234,0.4);
        }
        .ya-details-wrap[open] summary::after { content: '−'; }
        .ya-details-body {
          padding: 4px 16px 16px;
          font-size: 11px;
          color: rgba(232,240,234,0.6);
          font-family: 'Space Grotesk', sans-serif;
          line-height: 1.6;
        }
        .ya-details-body .ya-d-row {
          display: flex; justify-content: space-between;
          padding: 6px 0;
          border-bottom: 1px dashed rgba(255,255,255,0.07);
        }
        .ya-details-body .ya-d-row:last-child { border: none; }
        .ya-details-body .ya-lbl-jp {
          font-family: 'Noto Sans JP', sans-serif;
          color: rgba(232,240,234,0.4);
        }
        .ya-details-body .ya-num {
          color: #e8f0ea;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

/* ──────── Cards ──────── */

function Card1({ today }: { today: Insights["today"] }) {
  const yoy = today.yoy ?? 0;
  return (
    <div className="ya-card ya-c1 c1">
      <div className="ya-card-head">
        <div className="ya-card-title"><span className="ya-pip"/>今日のサマリー</div>
        <div className="ya-card-sub">{today.label}</div>
      </div>
      <div className="ya-row">
        <div className="ya-weather-cell">
          <div className="ya-icon"><WeatherIcon kind={today.weatherIcon} size={56}/></div>
          <div>
            <div className="ya-temp">{today.tempHi ?? "—"}<span className="ya-unit">℃</span></div>
            <div className="ya-desc">{today.weatherDesc}</div>
          </div>
        </div>
        <div className="ya-stat">
          <div className="ya-lbl">直近 7日 出荷</div>
          <div className="ya-val">{today.weekBoxes.toLocaleString()}<span className="ya-unit">箱</span></div>
          {today.yoy != null && (
            <div className={`ya-delta ${yoy >= 0 ? "up" : "down"}`}>
              {yoy >= 0 ? "↑" : "↓"} {Math.abs(yoy)}%
              <span style={{opacity:0.6,fontWeight:500}}> 前年同週比</span>
            </div>
          )}
        </div>
        <div className="ya-stat">
          <div className="ya-lbl">平均単価</div>
          <div className="ya-val">{today.avgPrice != null ? `¥${today.avgPrice.toLocaleString()}` : "—"}</div>
        </div>
      </div>
    </div>
  );
}

function Card2({ top, bottom }: { top: ShortDay[]; bottom: ShortDay[] }) {
  return (
    <div className="ya-card ya-c2 c2">
      <div className="ya-card-head">
        <div className="ya-card-title"><span className="ya-pip"/>よく取れた日 vs 取れなかった日</div>
        <div className="ya-card-sub">直近 90日</div>
      </div>

      <div className="ya-sub-card good">
        <div className="ya-sub-card-head">
          <div className="ya-sub-card-title"><span className="ya-badge">TOP 5</span> よく取れた日</div>
          <div className="ya-sub-card-meta">出荷数 上位</div>
        </div>
        {top.length === 0 ? <Empty/> : top.map((d, i) => <DayRow key={i} d={d}/>)}
      </div>

      <div className="ya-sub-card bad">
        <div className="ya-sub-card-head">
          <div className="ya-sub-card-title"><span className="ya-badge">BOTTOM 5</span> 取れなかった日</div>
          <div className="ya-sub-card-meta">出荷数 下位</div>
        </div>
        {bottom.length === 0 ? <Empty/> : bottom.map((d, i) => <DayRow key={i} d={d}/>)}
      </div>

      {top.length > 0 && (
        <Insight2 top={top} bottom={bottom} />
      )}
    </div>
  );
}

function Empty() {
  return <div style={{ padding: "12px 14px", fontSize: 11, color: "rgba(232,240,234,0.5)" }}>該当データなし</div>;
}

function DayRow({ d }: { d: ShortDay }) {
  return (
    <div className="ya-day-row">
      <div className="ya-day-icon">{d.emoji || "—"}</div>
      <div>
        <div className="ya-day-date">{d.label}</div>
        <div className="ya-day-meta">
          {d.tempMax != null ? `${d.tempMax.toFixed(1)}℃` : "—"} ·{" "}
          {d.sunshine != null ? `${d.sunshine.toFixed(1)}h` : "—"}
        </div>
      </div>
      <div className="ya-day-meta" style={{textAlign:"right",paddingRight:6}}>
        湿度 {d.humidity != null ? `${Math.round(d.humidity)}%` : "—"}
      </div>
      <div className="ya-day-vals">
        <div className="ya-day-boxes">{d.boxes}<span style={{fontSize:10,opacity:0.55,marginLeft:2}}>箱</span></div>
        <div className="ya-day-yen">¥{(d.yen / 1000).toFixed(0)}k</div>
      </div>
    </div>
  );
}

function avg(arr: number[]): number | null {
  const v = arr.filter((x): x is number => x != null);
  if (v.length === 0) return null;
  return v.reduce((s, x) => s + x, 0) / v.length;
}

function Insight2({ top, bottom }: { top: ShortDay[]; bottom: ShortDay[] }) {
  const tTopAvg = avg(top.map((d) => d.tempMax ?? 0).filter((x) => x > 0));
  const sTopAvg = avg(top.map((d) => d.sunshine ?? 0).filter((x) => x > 0));
  const bTopBoxes = avg(top.map((d) => d.boxes));
  const bBotBoxes = avg(bottom.map((d) => d.boxes));
  const ratio = bTopBoxes && bBotBoxes ? Math.round((bBotBoxes / bTopBoxes) * 100) : null;

  return (
    <div className="ya-insight">
      <div className="ya-lead">💡 直近 90 日のパターン</div>
      出荷が多かった日は <strong>平均気温 {tTopAvg != null ? `${tTopAvg.toFixed(0)}℃前後` : "—"}</strong>
      ・<strong>日照 {sTopAvg != null ? `${sTopAvg.toFixed(0)}時間前後` : "—"}</strong> の晴れた日でした。
      反対に、<em>雨や日照不足</em> の日は出荷量が
      <em> {ratio != null ? `${ratio}%（約${Math.round(ratio / 10) * 10}%）` : "半分以下"}</em>
      まで下がる傾向があります。
    </div>
  );
}

function Card3({ week, forecast }: { week: Insights["week"]; forecast: ForecastDay[] }) {
  const total = week.total;
  const lastTotal = week.lastTotal;
  const diff = total - lastTotal;
  const pct = lastTotal > 0 ? Math.round((diff / lastTotal) * 100) : 0;
  const up = diff >= 0;

  // 今週後半に雨予報があるか
  const rainAhead = forecast.some((f) => f.icon === "rain" && new Date(f.date) <= new Date(new Date().getTime() + 5 * 24 * 60 * 60 * 1000));

  return (
    <div className="ya-card ya-c3 c3">
      <div className="ya-card-head">
        <div className="ya-card-title"><span className="ya-pip"/>今週 vs 前年同週</div>
        <div className="ya-card-sub">月〜日</div>
      </div>
      <div className="ya-week-head">
        <div className="ya-week-totals">
          <div className="ya-lbl">今週 累計</div>
          <div className="ya-total">{total}<span className="ya-unit">箱</span></div>
        </div>
        <div className="ya-week-delta">
          {lastTotal > 0 && (
            <>
              <div className={`ya-delta-pill ${up ? "up" : "down"}`}>
                {up ? "↑" : "↓"} {Math.abs(pct)}%
              </div>
              <div className="ya-delta-sub">{up ? "+" : ""}{diff} 箱 vs 前年</div>
            </>
          )}
        </div>
      </div>
      <WeekChart days={week.days}/>
      <div className="ya-insight" style={{ marginTop: 12 }}>
        <div className="ya-lead">{up ? "✅" : "⚠️"} 今週のパターン</div>
        {up
          ? <>今週は前年より <strong>+{Math.abs(pct)}%</strong> のペース。</>
          : <>今週は前年より <em>{Math.abs(pct)}%</em> のペース。</>
        }
        {rainAhead && <> 直近の予報に <em>雨</em> が含まれているため、伸びが鈍る可能性があります。</>}
      </div>
    </div>
  );
}

function WeekChart({ days }: { days: WeekDay[] }) {
  const W = 440, H = 160;
  const padL = 24, padR = 10, padT = 14, padB = 26;
  const cw = W - padL - padR;
  const ch = H - padT - padB;
  const max = Math.max(1, ...days.map((d) => Math.max(d.cur ?? 0, d.last)));
  const barW = cw / 7 * 0.55;
  const slot = cw / 7;

  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const e = (t - start) / 700;
      const p = Math.min(1, e);
      setProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const linePts = days.map((d, i) => {
    const x = padL + slot * (i + 0.5);
    const y = padT + ch - (d.last / max) * ch;
    return [x, y] as const;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ya-week-chart">
      <defs>
        <linearGradient id="yaBarG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5fc24f"/>
          <stop offset="100%" stopColor="#2d8120" stopOpacity="0.85"/>
        </linearGradient>
        <linearGradient id="yaBarFutG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(94,194,80,0.15)"/>
          <stop offset="100%" stopColor="rgba(94,194,80,0.05)"/>
        </linearGradient>
      </defs>

      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={padL} x2={W - padR}
          y1={padT + ch * (1 - f)} y2={padT + ch * (1 - f)}
          stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4"/>
      ))}

      {days.map((d, i) => {
        const x = padL + slot * (i + 0.5) - barW / 2;
        const v = d.cur ?? 0;
        const fullH = (v / max) * ch;
        const h = fullH * progress;
        const y = padT + ch - h;
        return (
          <g key={i}>
            {d.future ? (
              <rect x={x} y={padT + ch * 0.4} width={barW} height={ch * 0.6}
                fill="url(#yaBarFutG)" rx="3"
                stroke="rgba(94,194,80,0.2)" strokeDasharray="2 3" strokeWidth="1"/>
            ) : (
              <rect x={x} y={y} width={barW} height={h}
                fill="url(#yaBarG)" rx="3"
                style={{ filter: "drop-shadow(0 0 6px rgba(94,194,80,0.3))" }}/>
            )}
            {!d.future && progress > 0.95 && (d.cur ?? 0) > 0 && (
              <text x={x + barW / 2} y={y - 5} textAnchor="middle"
                fontSize="9" fontFamily="Space Grotesk" fontWeight="600"
                fill="#fff">{d.cur}</text>
            )}
            <text x={padL + slot * (i + 0.5)} y={H - 8} textAnchor="middle"
              fontSize="11" fontFamily="Noto Sans JP"
              fill={d.future ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.6)"}
              fontWeight={d.future ? 400 : 600}>{d.dow}</text>
          </g>
        );
      })}

      <polyline
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="1.3"
        strokeDasharray="3 3"
        points={linePts.map((p) => p.join(",")).join(" ")}/>
      {linePts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="2.5"
          fill="rgba(255,255,255,0.7)" opacity={progress}/>
      ))}

      <g transform={`translate(${padL}, 4)`}>
        <rect x="0" y="2" width="9" height="9" rx="2" fill="url(#yaBarG)"/>
        <text x="13" y="11" fontSize="9" fill="rgba(255,255,255,0.7)" fontFamily="Noto Sans JP">今週</text>
        <line x1="50" y1="6" x2="62" y2="6" stroke="rgba(255,255,255,0.5)" strokeWidth="1.3" strokeDasharray="3 3"/>
        <circle cx="56" cy="6" r="2" fill="rgba(255,255,255,0.7)"/>
        <text x="66" y="11" fontSize="9" fill="rgba(255,255,255,0.7)" fontFamily="Noto Sans JP">前年同週</text>
      </g>
    </svg>
  );
}

function Card4({ forecast }: { forecast: ForecastDay[] }) {
  return (
    <div className="ya-card ya-c4 c4">
      <div className="ya-card-head">
        <div className="ya-card-title"><span className="ya-pip"/>これからの天気と収量見込み</div>
        <div className="ya-card-sub">5日先まで</div>
      </div>
      <div className="ya-fc-list">
        {forecast.length === 0 && (
          <div style={{ fontSize: 11, color: "rgba(232,240,234,0.5)", padding: "8px 0" }}>予報を取得できませんでした</div>
        )}
        {forecast.map((f, i) => (
          <div key={i} className="ya-fc-row">
            <div className="ya-fc-icon"><WeatherIcon kind={f.icon} size={28}/></div>
            <div className="ya-fc-day">
              {f.label}
              <span className="ya-fc-dow">({f.dow})</span>
            </div>
            <div className="ya-fc-temps">
              <span className="ya-fc-hi">{f.hi != null ? `${f.hi}°` : "—"}</span>
              <span style={{opacity:0.4,margin:"0 3px"}}>/</span>
              <span className="ya-fc-lo">{f.lo != null ? `${f.lo}°` : "—"}</span>
            </div>
            <div className="ya-fc-est">
              {f.est != null ? (
                f.n < 5 ? (
                  <>
                    <strong>{f.est}箱</strong> くらい
                    <div className="ya-fc-scarce">データ少なめ ({f.n}日分)</div>
                  </>
                ) : (
                  <>
                    だいたい <strong>{f.est}箱</strong> くらい
                    <div style={{opacity:0.6,fontSize:9}}>過去同条件 {f.n}日の平均</div>
                  </>
                )
              ) : <span style={{opacity:0.4}}>—</span>}
            </div>
            <div className={`ya-chip ${f.status}`}>
              {f.status === "warn" ? "⚠ " : f.status === "ok" ? "☀ " : "☁ "}
              {f.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card5() {
  return (
    <details className="ya-details-wrap ya-card c5" style={{ animation: "yaCardIn 0.5s ease-out forwards", animationDelay: "240ms", opacity: 0, padding: 0 }}>
      <summary>📊 詳しい数値を見る</summary>
      <div className="ya-details-body">
        <div className="ya-d-row">
          <span className="ya-lbl-jp">本ページの判定ロジック</span>
          <span className="ya-num">アイコン群 → 平均出荷量</span>
        </div>
        <div style={{ fontSize: 10, color: "rgba(232,240,234,0.4)", marginTop: 6, lineHeight: 1.6 }}>
          内部分析用の Pearson 相関係数や散布図はこちらに収納予定。
          現在は天気アイコン群(晴/薄曇/曇/雨)ごとの過去出荷平均で予測しています。
        </div>
      </div>
    </details>
  );
}

/* ──────── Weather Icons ──────── */

function WeatherIcon({ kind, size = 48 }: { kind: Icon; size?: number }) {
  switch (kind) {
    case "sun": return <SunIcon size={size}/>;
    case "cloudSun": return <CloudSunIcon size={size}/>;
    case "cloud": return <CloudIcon size={size}/>;
    case "rain": return <RainIcon size={size}/>;
  }
}

function SunIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="yaSunGrad">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="1"/>
          <stop offset="60%" stopColor="#fbbf24" stopOpacity="1"/>
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.6"/>
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="14" fill="url(#yaSunGrad)"
        style={{ filter: "drop-shadow(0 0 10px rgba(251,191,36,0.6))" }}/>
      {[0,45,90,135,180,225,270,315].map((a) => {
        const rad = a * Math.PI / 180;
        const x1 = 32 + Math.cos(rad) * 20;
        const y1 = 32 + Math.sin(rad) * 20;
        const x2 = 32 + Math.cos(rad) * 27;
        const y2 = 32 + Math.sin(rad) * 27;
        return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>;
      })}
    </svg>
  );
}

function CloudSunIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <radialGradient id="yaCsSunG">
          <stop offset="0%" stopColor="#fde68a"/>
          <stop offset="100%" stopColor="#fbbf24"/>
        </radialGradient>
      </defs>
      <circle cx="22" cy="22" r="9" fill="url(#yaCsSunG)" opacity="0.9"
        style={{ filter: "drop-shadow(0 0 6px rgba(251,191,36,0.5))" }}/>
      {[0,60,120,180,240,300].map((a) => {
        const rad = a * Math.PI / 180;
        const x1 = 22 + Math.cos(rad) * 13;
        const y1 = 22 + Math.sin(rad) * 13;
        const x2 = 22 + Math.cos(rad) * 17;
        const y2 = 22 + Math.sin(rad) * 17;
        return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" opacity="0.85"/>;
      })}
      <path d="M22 44 Q18 44 18 39 Q18 33 24 33 Q26 28 32 30 Q38 28 42 33 Q48 33 48 39 Q48 44 42 44 Z"
        fill="rgba(255,255,255,0.9)"
        style={{ filter: "drop-shadow(0 2px 6px rgba(255,255,255,0.2))" }}/>
    </svg>
  );
}

function CloudIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M16 42 Q10 42 10 35 Q10 26 20 26 Q22 18 32 19 Q42 18 46 26 Q54 26 54 34 Q54 42 46 42 Z"
        fill="rgba(255,255,255,0.85)"
        style={{ filter: "drop-shadow(0 2px 8px rgba(255,255,255,0.15))" }}/>
    </svg>
  );
}

function RainIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M16 36 Q10 36 10 30 Q10 22 20 22 Q22 14 32 15 Q42 14 46 22 Q54 22 54 30 Q54 36 46 36 Z"
        fill="rgba(180,200,220,0.9)"/>
      {[20,32,44].map((x, i) => (
        <line key={i} x1={x} y1="42" x2={x - 3} y2="54"
          stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 4px rgba(125,211,252,0.6))" }}/>
      ))}
    </svg>
  );
}
