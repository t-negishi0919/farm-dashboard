import { google } from "googleapis";

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

async function getSheet(sheetName: string): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    range: sheetName,
  });
  return (res.data.values as string[][]) || [];
}

export type WeatherRow = {
  date: string;
  weather: string;
  tempMin: number | null;
  tempMax: number | null;
  tempAvg: number | null;
  humidity: number | null;
  precipitation: number | null;
  sunshine: number | null;
  et0: number | null;
  windspeedMax: number | null;
};

export type ShippingRow = {
  shippingDate: string;
  settlementDate: string;
  grades: Record<string, { quantity: number | null; amount: number | null }>;
  totalQuantity: number | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  marketFee: number | null;
  jaFee: number | null;
  shippingFee: number | null;
  payment: number | null;
};

export type GrowthRow = {
  date: string;
  time: string;
  comment: string;
  aiSummary: string;
  status: string;
  photoUrl: string;
};

export type CombinedRow = WeatherRow & {
  totalQuantity: number | null;
  payment: number | null;
};

function n(v: string | undefined): number | null {
  if (!v || v === "") return null;
  const num = parseFloat(v);
  return isNaN(num) ? null : num;
}

export async function getWeatherData(): Promise<WeatherRow[]> {
  const rows = await getSheet("気象データ");
  if (rows.length < 2) return [];
  return rows.slice(1).map((r) => ({
    date: r[0] || "",
    weather: r[1] || "",
    tempMin: n(r[2]),
    tempMax: n(r[3]),
    tempAvg: n(r[4]),
    humidity: n(r[5]),
    precipitation: n(r[6]),
    sunshine: n(r[7]),
    et0: n(r[8]),
    windspeedMax: n(r[9]),
  }));
}

const GRADE_KEYS = ["摘果", "ASS", "AS", "AM", "B", "C", "S"];

export async function getShippingData(): Promise<ShippingRow[]> {
  const rows = await getSheet("出荷記録");
  if (rows.length < 2) return [];
  return rows.slice(1).map((r) => {
    const grades: ShippingRow["grades"] = {};
    GRADE_KEYS.forEach((g, i) => {
      grades[g] = { quantity: n(r[2 + i * 2]), amount: n(r[3 + i * 2]) };
    });
    return {
      shippingDate: r[0] || "",
      settlementDate: r[1] || "",
      grades,
      totalQuantity: n(r[16]),
      subtotal: n(r[17]),
      tax: n(r[18]),
      total: n(r[19]),
      marketFee: n(r[20]),
      jaFee: n(r[21]),
      shippingFee: n(r[22]),
      payment: n(r[23]),
    };
  });
}

export async function getGrowthData(): Promise<GrowthRow[]> {
  const rows = await getSheet("生育記録");
  if (rows.length < 2) return [];
  return rows.slice(1).map((r) => ({
    date: r[0] || "",
    time: r[1] || "",
    comment: r[2] || "",
    aiSummary: r[3] || "",
    status: r[4] || "",
    photoUrl: r[5] || "",
  }));
}

export async function getCombinedData(days?: number): Promise<CombinedRow[]> {
  const [weather, shipping] = await Promise.all([
    getWeatherData(),
    getShippingData(),
  ]);

  const shippingMap = new Map<string, ShippingRow>();
  for (const s of shipping) {
    shippingMap.set(s.shippingDate, s);
  }

  let combined: CombinedRow[] = weather.map((w) => {
    const s = shippingMap.get(w.date);
    return {
      ...w,
      totalQuantity: s?.totalQuantity ?? null,
      payment: s?.payment ?? null,
    };
  });

  if (days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    combined = combined.filter((r) => new Date(r.date) >= cutoff);
  }

  return combined.sort((a, b) => a.date.localeCompare(b.date));
}
