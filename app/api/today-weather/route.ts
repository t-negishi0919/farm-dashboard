export const revalidate = 1800; // 30分キャッシュ

const LAT = 36.17;
const LON = 139.60;

// Open-Meteo weathercode → 絵文字＋ラベル
const WEATHER_MAP: Record<number, { emoji: string; label: string }> = {
  0:  { emoji: "☀️", label: "晴れ" },
  1:  { emoji: "🌤", label: "晴れがち" },
  2:  { emoji: "🌤", label: "曇りがち" },
  3:  { emoji: "☁️", label: "曇り" },
  45: { emoji: "🌫", label: "霧" },
  48: { emoji: "🌫", label: "霧" },
  51: { emoji: "🌧", label: "霧雨" },
  53: { emoji: "🌧", label: "霧雨" },
  55: { emoji: "🌧", label: "霧雨" },
  61: { emoji: "🌧", label: "雨" },
  63: { emoji: "🌧", label: "雨" },
  65: { emoji: "🌧", label: "強い雨" },
  71: { emoji: "❄️", label: "雪" },
  73: { emoji: "❄️", label: "雪" },
  75: { emoji: "❄️", label: "強い雪" },
  80: { emoji: "🌦", label: "にわか雨" },
  81: { emoji: "🌦", label: "にわか雨" },
  82: { emoji: "⛈", label: "強いにわか雨" },
  95: { emoji: "⛈", label: "雷雨" },
  96: { emoji: "⛈", label: "雷雨＋雹" },
  99: { emoji: "⛈", label: "雷雨＋雹" },
};

function describe(code: number | null): { emoji: string; label: string } {
  if (code == null) return { emoji: "—", label: "不明" };
  return WEATHER_MAP[code] ?? { emoji: "—", label: "不明" };
}

export type HourlyPoint = {
  hour: number;          // 0-24
  emoji: string;
  label: string;
  temp: number | null;
  windspeed: number | null;
  precipitation: number | null;
  humidity: number | null;
};

export type DailyForecast = {
  date: string;
  weather: { emoji: string; label: string };
  tempMax: number | null;
  tempMin: number | null;
  precipitation: number | null;
  precipitationProb: number | null; // %
  sunshine: number | null;          // 時間
  windMax: number | null;
  hourly: HourlyPoint[];            // その日の時間別（today/tomorrowのみ詳細）
};

export type TodayWeather = {
  // 互換: today の値（既存呼び出しは today + hourly を見ている）
  date: string;
  weather: { emoji: string; label: string };
  tempMax: number | null;
  tempMin: number | null;
  precipitation: number | null;
  sunshine: number | null;
  windMax: number | null;
  hourly: HourlyPoint[];
  // 拡張: 明日と7日間
  tomorrow: DailyForecast | null;
  weekly: DailyForecast[];   // 今日含む 7 日（時間別は省略）
};

const HOURS = [6, 9, 12, 15, 18, 21];

function buildHourly(times: string[], codes: number[], temps: number[], winds: number[], rains: number[], hums: number[], dayOffset: number): HourlyPoint[] {
  // dayOffset 日の HOURS 各時刻を返す
  const targetDateIdx = dayOffset; // 0=today
  return HOURS.map((h) => {
    const idx = times.findIndex((t, i) => {
      const dayIdx = Math.floor(i / 24);
      const hh = parseInt(t.slice(11, 13), 10);
      return dayIdx === targetDateIdx && hh === h;
    });
    if (idx < 0) {
      return { hour: h, emoji: "—", label: "—", temp: null, windspeed: null, precipitation: null, humidity: null };
    }
    const code = codes[idx] ?? null;
    const w = describe(code);
    return {
      hour: h,
      emoji: w.emoji,
      label: w.label,
      temp: temps[idx] ?? null,
      windspeed: winds[idx] ?? null,
      precipitation: rains[idx] ?? null,
      humidity: hums[idx] ?? null,
    };
  });
}

export async function GET() {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${LAT}&longitude=${LON}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunshine_duration,windspeed_10m_max` +
      `&hourly=weathercode,temperature_2m,windspeed_10m,precipitation,relativehumidity_2m` +
      `&timezone=Asia%2FTokyo&forecast_days=7`;

    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) {
      return Response.json({ error: `Open-Meteo ${res.status}` }, { status: 502 });
    }
    const j = await res.json();

    const daily = j.daily ?? {};
    const hourly = j.hourly ?? {};

    const dailyDates: string[] = daily.time ?? [];
    const dailyCodes: number[] = daily.weathercode ?? [];
    const dailyTmax: number[]  = daily.temperature_2m_max ?? [];
    const dailyTmin: number[]  = daily.temperature_2m_min ?? [];
    const dailyPrec: number[]  = daily.precipitation_sum ?? [];
    const dailyProb: number[]  = daily.precipitation_probability_max ?? [];
    const dailySun:  number[]  = daily.sunshine_duration ?? [];
    const dailyWind: number[]  = daily.windspeed_10m_max ?? [];

    const times: string[]  = hourly.time ?? [];
    const codes: number[]  = hourly.weathercode ?? [];
    const temps: number[]  = hourly.temperature_2m ?? [];
    const winds: number[]  = hourly.windspeed_10m ?? [];
    const rains: number[]  = hourly.precipitation ?? [];
    const hums: number[]   = hourly.relativehumidity_2m ?? [];

    const buildDay = (dayOffset: number, includeHourly: boolean): DailyForecast => {
      const code = dailyCodes[dayOffset] ?? null;
      const sun = dailySun[dayOffset] ?? null;
      return {
        date: dailyDates[dayOffset] ?? "",
        weather: describe(code),
        tempMax: dailyTmax[dayOffset] ?? null,
        tempMin: dailyTmin[dayOffset] ?? null,
        precipitation: dailyPrec[dayOffset] ?? null,
        precipitationProb: dailyProb[dayOffset] ?? null,
        sunshine: sun != null ? Math.round((sun / 3600) * 10) / 10 : null,
        windMax: dailyWind[dayOffset] ?? null,
        hourly: includeHourly ? buildHourly(times, codes, temps, winds, rains, hums, dayOffset) : [],
      };
    };

    const today = buildDay(0, true);
    const tomorrow = dailyDates.length > 1 ? buildDay(1, true) : null;
    const weekly: DailyForecast[] = dailyDates.map((_d, i) => buildDay(i, false));

    const result: TodayWeather = {
      date: today.date,
      weather: today.weather,
      tempMax: today.tempMax,
      tempMin: today.tempMin,
      precipitation: today.precipitation,
      sunshine: today.sunshine,
      windMax: today.windMax,
      hourly: today.hourly,
      tomorrow,
      weekly,
    };

    return Response.json(result);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
