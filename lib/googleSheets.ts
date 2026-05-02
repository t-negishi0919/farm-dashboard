import { google } from "googleapis";

function loadPrivateKey(): string {
  // 1) base64 で渡された場合（Vercel UI が \n を勝手に改行展開する問題を回避）
  const b64 = process.env.GOOGLE_PRIVATE_KEY_B64;
  if (b64) {
    return Buffer.from(b64, "base64").toString("utf-8");
  }
  // 2) 通常の GOOGLE_PRIVATE_KEY（\n エスケープも実改行も両対応）
  const raw = process.env.GOOGLE_PRIVATE_KEY ?? "";
  return raw.replace(/\\n/g, "\n");
}

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: loadPrivateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

async function getSheet(sheetName: string): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
      range: sheetName,
    });
    return (res.data.values as string[][]) || [];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unable to parse range") || msg.includes("notFound")) return [];
    throw e;
  }
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
  grades: Record<string, { quantity: number | null; amount: number | null; total: number | null }>;
  tax: number | null;
  marketFee: number | null;
  jaFee: number | null;
  shippingFee: number | null;
  totalQuantity: number | null;
  subtotal: number | null;
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

export type TroubleRow = {
  date: string;
  time: string;
  diagnosis: string;
  cause: string;
  action: string;
  prevention: string;
  urgency: string;
  status: string;
  photoUrl: string;
};

export type CombinedRow = WeatherRow & {
  totalQuantity: number | null;
  payment: number | null;
  subtotal: number | null;
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

// 出荷記録フォーマット（reformat後）:
// A(0)=出荷日, B(1)=摘果数量, C(2)=摘果金額, D(3)=ASS数量, E(4)=ASS金額, ...
// 9等級×2列: 摘果/ASS/AS/AM/B/C/D/S/M → r[1]〜r[18]
// T(19)=受取消費税, U(20)=市場手数料, V(21)=農協手数料, W(22)=運賃
// X(23)=摘果総額, Y(24)=ASS総額, Z(25)=AS総額, AA(26)=AM総額,
// AB(27)=B総額, AC(28)=C総額, AD(29)=S総額, AE(30)=M総額, AF(31)=D総額
const GRADE_KEYS = ["摘果", "ASS", "AS", "AM", "B", "C", "D", "S", "M"] as const;
const GRADE_TOTAL_IDX: Record<string, number> = {
  摘果: 23, ASS: 24, AS: 25, AM: 26, B: 27, C: 28, D: 31, S: 29, M: 30,
};

function normalizeDate(d: string): string {
  return d.replace(/\//g, "-");
}

export async function getShippingData(): Promise<ShippingRow[]> {
  const rows = await getSheet("出荷記録");
  if (rows.length < 2) return [];
  return rows.slice(1)
    .filter((r) => r[0])
    .map((r) => {
      const grades: ShippingRow["grades"] = {};
      GRADE_KEYS.forEach((g, i) => {
        grades[g] = {
          quantity: n(r[1 + i * 2]),
          amount:   n(r[2 + i * 2]),
          total:    n(r[GRADE_TOTAL_IDX[g]]),
        };
      });

      const tax         = n(r[19]);
      const marketFee   = n(r[20]);
      const jaFee       = n(r[21]);
      const shippingFee = n(r[22]);

      const totalQuantity = GRADE_KEYS.reduce((s, g) => s + (grades[g].quantity ?? 0), 0) || null;
      const subtotal      = GRADE_KEYS.reduce((s, g) => s + (grades[g].total    ?? 0), 0) || null;
      const payment       = subtotal !== null
        ? subtotal + (tax ?? 0) - (marketFee ?? 0) - (jaFee ?? 0) - (shippingFee ?? 0)
        : null;

      return {
        shippingDate: normalizeDate(r[0] || ""),
        grades,
        tax,
        marketFee,
        jaFee,
        shippingFee,
        totalQuantity,
        subtotal,
        payment,
      };
    });
}

export async function getGrowthData(): Promise<GrowthRow[]> {
  const rows = await getSheet("仕立て診断");
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

export async function getTroubleData(): Promise<TroubleRow[]> {
  const rows = await getSheet("不調相談");
  if (rows.length < 2) return [];
  return rows.slice(1).map((r) => ({
    date: r[0] || "",
    time: r[1] || "",
    diagnosis: r[2] || "",
    cause: r[3] || "",
    action: r[4] || "",
    prevention: r[5] || "",
    urgency: r[6] || "",
    status: r[7] || "",
    photoUrl: r[8] || "",
  }));
}

export async function getCombinedData(days?: number): Promise<CombinedRow[]> {
  const [weather, shipping] = await Promise.all([
    getWeatherData(),
    getShippingData(),
  ]);

  // 全日付の和集合で full outer join する
  const weatherMap = new Map<string, WeatherRow>();
  for (const w of weather) weatherMap.set(w.date, w);

  const shippingMap = new Map<string, ShippingRow>();
  for (const s of shipping) shippingMap.set(s.shippingDate, s);

  const allDates = new Set<string>([
    ...weather.map((w) => w.date),
    ...shipping.map((s) => s.shippingDate),
  ]);

  let combined: CombinedRow[] = Array.from(allDates).map((date) => {
    const w = weatherMap.get(date);
    const s = shippingMap.get(date);
    return {
      date,
      weather:       w?.weather       ?? "",
      tempMin:       w?.tempMin       ?? null,
      tempMax:       w?.tempMax       ?? null,
      tempAvg:       w?.tempAvg       ?? null,
      humidity:      w?.humidity      ?? null,
      precipitation: w?.precipitation ?? null,
      sunshine:      w?.sunshine      ?? null,
      et0:           w?.et0           ?? null,
      windspeedMax:  w?.windspeedMax  ?? null,
      totalQuantity: s?.totalQuantity ?? null,
      subtotal:      s?.subtotal      ?? null,
      payment:       s?.payment       ?? null,
    };
  });

  if (days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    combined = combined.filter((r) => new Date(r.date) >= cutoff);
  }

  return combined.sort((a, b) => a.date.localeCompare(b.date));
}
