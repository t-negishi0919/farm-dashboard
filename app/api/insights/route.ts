import { getCombinedData, type CombinedRow } from "@/lib/googleSheets";

export const revalidate = 600;

const LAT = 36.17;
const LON = 139.60;

// Open-Meteo weather code → アイコンキー
const CODE_TO_ICON: Record<number, "sun" | "cloudSun" | "cloud" | "rain"> = {
  0: "sun",
  1: "cloudSun", 2: "cloudSun",
  3: "cloud",
  45: "cloud", 48: "cloud",
  51: "rain", 53: "rain", 55: "rain",
  61: "rain", 63: "rain", 65: "rain",
  71: "cloud", 73: "cloud", 75: "cloud",
  80: "rain", 81: "rain", 82: "rain",
  95: "rain", 96: "rain", 99: "rain",
};

const CODE_TO_DESC: Record<number, string> = {
  0: "晴れ", 1: "晴れがち", 2: "曇りがち", 3: "曇り",
  45: "霧", 48: "霧",
  51: "霧雨", 53: "霧雨", 55: "霧雨",
  61: "雨", 63: "雨", 65: "強い雨",
  71: "雪", 73: "雪", 75: "強い雪",
  80: "にわか雨", 81: "にわか雨", 82: "強いにわか雨",
  95: "雷雨", 96: "雷雨", 99: "雷雨",
};

const CODE_TO_EMOJI: Record<number, string> = {
  0: "☀️", 1: "🌤", 2: "🌤", 3: "☁️",
  45: "🌫", 48: "🌫",
  51: "🌧", 53: "🌧", 55: "🌧",
  61: "🌧", 63: "🌧", 65: "🌧",
  71: "❄️", 73: "❄️", 75: "❄️",
  80: "🌦", 81: "🌦", 82: "⛈",
  95: "⛈", 96: "⛈", 99: "⛈",
};

function iconFor(code: number | null | undefined): "sun" | "cloudSun" | "cloud" | "rain" {
  if (code == null) return "cloud";
  return CODE_TO_ICON[code] ?? "cloud";
}
function descFor(code: number | null | undefined): string {
  if (code == null) return "—";
  return CODE_TO_DESC[code] ?? "—";
}
function emojiFor(code: number | null | undefined): string {
  if (code == null) return "—";
  return CODE_TO_EMOJI[code] ?? "—";
}

function ymdJst(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/** 与えた日付の同年内の月曜日 (Mon=start of week) を返す */
function mondayOf(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00+09:00");
  const day = d.getUTCDay() || 7; // Sun=0 → 7
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function dowJp(dateStr: string): string {
  const dow = new Date(dateStr + "T00:00:00+09:00").getUTCDay();
  return ["日", "月", "火", "水", "木", "金", "土"][dow];
}

function formatMd(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)} (${dowJp(dateStr)})`;
}

type ShortDay = {
  date: string;        // YYYY-MM-DD
  label: string;       // "4/14 (火)"
  emoji: string;
  boxes: number;
  yen: number;
  tempMax: number | null;
  sunshine: number | null;
  humidity: number | null;
};

function pickTopBottom(rows: CombinedRow[], days: number): { top: ShortDay[]; bottom: ShortDay[] } {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffStr = ymdJst(cutoff);

  const recent = rows.filter((r) => r.date >= cutoffStr && (r.totalQuantity ?? 0) > 0);
  const sorted = [...recent].sort((a, b) => (b.totalQuantity ?? 0) - (a.totalQuantity ?? 0));
  const toShort = (r: CombinedRow): ShortDay => ({
    date: r.date,
    label: formatMd(r.date),
    emoji: r.weather || "—",
    boxes: r.totalQuantity ?? 0,
    yen: r.payment ?? r.subtotal ?? 0,
    tempMax: r.tempMax,
    sunshine: r.sunshine,
    humidity: r.humidity,
  });
  return {
    top: sorted.slice(0, 5).map(toShort),
    bottom: sorted.slice(-5).reverse().map(toShort),
  };
}

type WeekDay = {
  date: string | null;       // current year date (null for future days outside window)
  dow: string;
  cur: number | null;
  last: number;
  future: boolean;
};

function buildWeek(rows: CombinedRow[]): { days: WeekDay[]; total: number; lastTotal: number } {
  const today = ymdJst(new Date());
  const monday = mondayOf(today);
  const lastYearMonday = new Date(monday);
  lastYearMonday.setUTCFullYear(lastYearMonday.getUTCFullYear() - 1);

  const map = new Map<string, CombinedRow>();
  rows.forEach((r) => map.set(r.date, r));

  const days: WeekDay[] = [];
  let total = 0;
  let lastTotal = 0;
  for (let i = 0; i < 7; i++) {
    const cur = ymdJst(addDays(monday, i));
    const last = ymdJst(addDays(lastYearMonday, i));
    const future = cur > today;
    const curRow = map.get(cur);
    const lastRow = map.get(last);
    const curBoxes = curRow?.totalQuantity ?? null;
    const lastBoxes = lastRow?.totalQuantity ?? 0;
    if (curBoxes != null) total += curBoxes;
    lastTotal += lastBoxes;
    days.push({
      date: future ? null : cur,
      dow: ["月", "火", "水", "木", "金", "土", "日"][i],
      cur: curBoxes,
      last: lastBoxes,
      future,
    });
  }
  return { days, total, lastTotal };
}

type ForecastDay = {
  date: string;          // YYYY-MM-DD
  label: string;         // "5/04"
  dow: string;           // "月"
  icon: "sun" | "cloudSun" | "cloud" | "rain";
  desc: string;
  hi: number | null;
  lo: number | null;
  est: number | null;    // boxes (avg of historical with same icon group)
  n: number;             // sample size
  status: "ok" | "mid" | "warn";
};

function statusFromForecast(icon: ForecastDay["icon"], est: number | null, allEst: number[]): "ok" | "mid" | "warn" {
  if (icon === "rain") return "warn";
  if (est == null) return "mid";
  // 同窓の予測値の平均と比較して判定
  const avg = allEst.length > 0 ? allEst.reduce((s, x) => s + x, 0) / allEst.length : 0;
  if (est >= avg) return "ok";
  return "mid";
}

async function fetchForecast(): Promise<{
  date: string; code: number | null; hi: number | null; lo: number | null;
}[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTokyo&forecast_days=6`;
  const res = await fetch(url, { next: { revalidate: 1800 } });
  if (!res.ok) return [];
  const data = await res.json();
  const dates = data.daily?.time ?? [];
  const codes = data.daily?.weathercode ?? [];
  const his = data.daily?.temperature_2m_max ?? [];
  const los = data.daily?.temperature_2m_min ?? [];
  return dates.map((date: string, i: number) => ({
    date,
    code: codes[i] ?? null,
    hi: his[i] != null ? Math.round(his[i]) : null,
    lo: los[i] != null ? Math.round(los[i]) : null,
  }));
}

/** 過去 365 日の (アイコングループ → 平均出荷数, サンプル数) */
function buildIconAverages(rows: CombinedRow[]): Record<string, { avg: number; n: number }> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 365);
  const cutoffStr = ymdJst(cutoff);

  const buckets: Record<string, { sum: number; n: number }> = {};
  for (const r of rows) {
    if (r.date < cutoffStr) continue;
    if ((r.totalQuantity ?? 0) <= 0) continue;
    // weather column の絵文字や label からアイコングループを推定するのは曖昧なので、
    // ここでは weather 文字列に "雨" が含まれるか、"晴" が含まれるか、で 4 群に分ける。
    const w = r.weather ?? "";
    let key: "sun" | "cloudSun" | "cloud" | "rain";
    if (/雨|☔|🌧|⛈/.test(w)) key = "rain";
    else if (/曇.*晴|🌤/.test(w)) key = "cloudSun";
    else if (/晴|☀/.test(w)) key = "sun";
    else key = "cloud";
    const b = buckets[key] ?? { sum: 0, n: 0 };
    b.sum += r.totalQuantity ?? 0;
    b.n += 1;
    buckets[key] = b;
  }
  const out: Record<string, { avg: number; n: number }> = {};
  for (const [k, v] of Object.entries(buckets)) {
    out[k] = { avg: v.n > 0 ? Math.round(v.sum / v.n) : 0, n: v.n };
  }
  return out;
}

export async function GET() {
  try {
    const rows = await getCombinedData();

    const today = ymdJst(new Date());
    const todayRow = rows.find((r) => r.date === today);

    // 直近 7 日 (today - 6 .. today) の出荷量・売上
    const last7Cutoff = ymdJst(addDays(new Date(today + "T00:00:00+09:00"), -6));
    const last7 = rows.filter((r) => r.date >= last7Cutoff && r.date <= today);
    const weekBoxes = last7.reduce((s, r) => s + (r.totalQuantity ?? 0), 0);
    const weekSubtotal = last7.reduce((s, r) => s + (r.subtotal ?? 0), 0);

    // 前年同週(same date - 1 year, 7 日合計)
    const lastYearTo = new Date(today + "T00:00:00+09:00");
    lastYearTo.setUTCFullYear(lastYearTo.getUTCFullYear() - 1);
    const lyTo = ymdJst(lastYearTo);
    const lyFrom = ymdJst(addDays(lastYearTo, -6));
    const ly7 = rows.filter((r) => r.date >= lyFrom && r.date <= lyTo);
    const lyBoxes = ly7.reduce((s, r) => s + (r.totalQuantity ?? 0), 0);
    const yoy = lyBoxes > 0 ? Math.round(((weekBoxes - lyBoxes) / lyBoxes) * 100) : null;

    const totalQty7 = last7.reduce((s, r) => s + (r.totalQuantity ?? 0), 0);
    const avgPrice = totalQty7 > 0
      ? Math.round(weekSubtotal / totalQty7)
      : null;

    const { top, bottom } = pickTopBottom(rows, 90);
    const week = buildWeek(rows);
    const iconAverages = buildIconAverages(rows);

    const forecastRaw = await fetchForecast();
    // forecast から「今日」を除外し、最大 5 日
    const futureFc = forecastRaw.filter((f) => f.date > today).slice(0, 5);
    const forecastDays: ForecastDay[] = futureFc.map((f) => {
      const icon = iconFor(f.code);
      const bucket = iconAverages[icon];
      const est = bucket?.avg ?? null;
      const n = bucket?.n ?? 0;
      return {
        date: f.date,
        label: `${parseInt(f.date.slice(5, 7), 10)}/${f.date.slice(8, 10)}`,
        dow: dowJp(f.date),
        icon,
        desc: descFor(f.code),
        hi: f.hi,
        lo: f.lo,
        est,
        n,
        status: "ok",
      };
    });
    const allEst = forecastDays.map((f) => f.est ?? 0).filter((v) => v > 0);
    forecastDays.forEach((f) => {
      f.status = statusFromForecast(f.icon, f.est, allEst);
    });

    return Response.json({
      today: {
        date: today,
        label: formatMd(today),
        weather: todayRow?.weather ?? null,
        weatherEmoji: emojiFor(forecastRaw[0]?.code),
        weatherIcon: iconFor(forecastRaw[0]?.code),
        weatherDesc: descFor(forecastRaw[0]?.code),
        tempHi: forecastRaw[0]?.hi ?? todayRow?.tempMax ?? null,
        weekBoxes,
        yoy,                 // % (null if no prev year data)
        avgPrice,            // ¥
      },
      top,
      bottom,
      week,
      forecast: forecastDays,
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
