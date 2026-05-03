import { google } from "googleapis";
import { getWriteAuth, getSpreadsheetId } from "./googleSheets";

const SHEET_NAME = "勤怠";
const HEADERS = [
  "日付", "名前", "出勤", "休憩開始", "休憩終了", "退勤",
  "実働(h)", "休憩(h)", "備考",
] as const;

export type TimeclockAction = "punchIn" | "breakStart" | "breakEnd" | "punchOut";

export type TimeclockStatus =
  | "notStarted"   // 未出勤
  | "working"      // 勤務中
  | "onBreak"      // 休憩中
  | "finished";    // 退勤済

export type TimeclockEntry = {
  date: string;          // YYYY-MM-DD
  user: string;
  punchIn: string | null;     // HH:mm
  breakStart: string | null;
  breakEnd: string | null;
  punchOut: string | null;
  workedHours: number | null;
  breakHours: number | null;
  note: string;
};

export function getTodayJst(): string {
  const now = new Date();
  // JST = UTC+9
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

export function getNowHmJst(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(11, 16);
}

function diffHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(0, minutes / 60);
}

function rowToEntry(row: string[]): TimeclockEntry {
  const punchIn = row[2] || null;
  const breakStart = row[3] || null;
  const breakEnd = row[4] || null;
  const punchOut = row[5] || null;
  return {
    date: row[0] || "",
    user: row[1] || "",
    punchIn,
    breakStart,
    breakEnd,
    punchOut,
    workedHours: row[6] ? parseFloat(row[6]) : null,
    breakHours: row[7] ? parseFloat(row[7]) : null,
    note: row[8] || "",
  };
}

export function statusFromEntry(e: TimeclockEntry | null): TimeclockStatus {
  if (!e || !e.punchIn) return "notStarted";
  if (e.punchOut) return "finished";
  if (e.breakStart && !e.breakEnd) return "onBreak";
  return "working";
}

async function ensureSheet(sheets: ReturnType<typeof google.sheets>) {
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === SHEET_NAME);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: SHEET_NAME } } }],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [HEADERS as unknown as string[]] },
  });
}

async function readAllRows(): Promise<string[][]> {
  const auth = getWriteAuth();
  const sheets = google.sheets({ version: "v4", auth });
  await ensureSheet(sheets);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: SHEET_NAME,
  });
  const values = (res.data.values as string[][]) || [];
  return values.length > 0 ? values.slice(1) : []; // ヘッダー除外
}

export async function getTodayEntry(user: string, date?: string): Promise<TimeclockEntry | null> {
  const targetDate = date ?? getTodayJst();
  const rows = await readAllRows();
  const found = rows.find((r) => r[0] === targetDate && r[1] === user);
  return found ? rowToEntry(found) : null;
}

export async function listEntries(opts: {
  from?: string;   // YYYY-MM-DD
  to?: string;
  user?: string;
}): Promise<TimeclockEntry[]> {
  const rows = await readAllRows();
  return rows
    .map(rowToEntry)
    .filter((e) => {
      if (!e.date) return false;
      if (opts.user && e.user !== opts.user) return false;
      if (opts.from && e.date < opts.from) return false;
      if (opts.to && e.date > opts.to) return false;
      return true;
    })
    .sort((a, b) => (a.date === b.date ? a.user.localeCompare(b.user) : b.date.localeCompare(a.date)));
}

/** 当日行のインデックスを返す。なければ -1。 */
async function findRowIndex(user: string, date: string): Promise<{ index: number; rows: string[][] }> {
  const rows = await readAllRows();
  const idx = rows.findIndex((r) => r[0] === date && r[1] === user);
  return { index: idx, rows };
}

/** 指定行を A 列基準の絶対行番号(1-based、ヘッダー込み)にする。 */
function toSheetRow(zeroBasedIndex: number): number {
  return zeroBasedIndex + 2; // +1 for header, +1 for 1-based
}

export type PunchResult = {
  status: TimeclockStatus;
  entry: TimeclockEntry;
};

export async function punch(user: string, action: TimeclockAction): Promise<PunchResult> {
  const auth = getWriteAuth();
  const sheets = google.sheets({ version: "v4", auth });
  await ensureSheet(sheets);
  const spreadsheetId = getSpreadsheetId();

  const date = getTodayJst();
  const time = getNowHmJst();
  const { index, rows } = await findRowIndex(user, date);

  // 既存の値 or 空配列
  const current: string[] = index >= 0
    ? [...rows[index], "", "", "", "", "", "", "", "", ""].slice(0, 9)
    : [date, user, "", "", "", "", "", "", ""];

  const status = statusFromEntry(rowToEntry(current));

  // バリデーション
  switch (action) {
    case "punchIn":
      if (status !== "notStarted") {
        throw new Error(`既に出勤しています (現在: ${labelOf(status)})`);
      }
      current[2] = time;
      break;
    case "breakStart":
      if (status !== "working") {
        throw new Error(`勤務中ではないため休憩開始できません (現在: ${labelOf(status)})`);
      }
      current[3] = time;
      break;
    case "breakEnd":
      if (status !== "onBreak") {
        throw new Error(`休憩中ではないため休憩終了できません (現在: ${labelOf(status)})`);
      }
      current[4] = time;
      break;
    case "punchOut":
      if (status === "notStarted") throw new Error("未出勤のため退勤できません");
      if (status === "finished")  throw new Error("既に退勤済みです");
      // 休憩中に退勤 → 休憩終了 = 退勤時刻とする
      if (status === "onBreak" && !current[4]) {
        current[4] = time;
      }
      current[5] = time;
      break;
  }

  // 計算列(実働 / 休憩)
  const breakH = current[3] && current[4] ? diffHours(current[3], current[4]) : 0;
  const workH = current[2] && current[5]
    ? Math.max(0, diffHours(current[2], current[5]) - breakH)
    : 0;
  current[6] = current[2] && current[5] ? workH.toFixed(2) : "";
  current[7] = breakH > 0 ? breakH.toFixed(2) : "";

  if (index >= 0) {
    const sheetRow = toSheetRow(index);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A${sheetRow}:I${sheetRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [current] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: SHEET_NAME,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [current] },
    });
  }

  const entry = rowToEntry(current);
  return { status: statusFromEntry(entry), entry };
}

function labelOf(s: TimeclockStatus): string {
  switch (s) {
    case "notStarted": return "未出勤";
    case "working":    return "勤務中";
    case "onBreak":    return "休憩中";
    case "finished":   return "退勤済";
  }
}
