import { google } from "googleapis";
import { getWriteAuth, getSpreadsheetId } from "./googleSheets";

const SHEET_NAME = "勤怠";

/**
 * 勤怠シートの列順:
 *  A 日付 / B 名前 / C 出勤
 *  D 休憩1開始 / E 休憩1終了
 *  F 休憩2開始 / G 休憩2終了
 *  H 休憩3開始 / I 休憩3終了
 *  J 退勤 / K 実働(h) / L 休憩(h) / M 備考
 */
const HEADERS = [
  "日付", "名前", "出勤",
  "休憩1開始", "休憩1終了",
  "休憩2開始", "休憩2終了",
  "休憩3開始", "休憩3終了",
  "退勤", "実働(h)", "休憩(h)", "備考",
] as const;
const COL_COUNT = HEADERS.length;
const LAST_COL_LETTER = "M"; // A..M = 13 列
const MAX_BREAKS = 3;

const COL = {
  date: 0, user: 1, punchIn: 2,
  break1Start: 3, break1End: 4,
  break2Start: 5, break2End: 6,
  break3Start: 7, break3End: 8,
  punchOut: 9, workedH: 10, breakH: 11, note: 12,
} as const;

export type TimeclockAction = "punchIn" | "breakStart" | "breakEnd" | "punchOut";

export type TimeclockStatus =
  | "notStarted"
  | "working"
  | "onBreak"
  | "finished";

export type BreakSlot = { start: string | null; end: string | null };

export type TimeclockEntry = {
  date: string;
  user: string;
  punchIn: string | null;
  punchOut: string | null;
  breaks: BreakSlot[];          // 長さ MAX_BREAKS, 未使用は { start: null, end: null }
  workedHours: number | null;
  breakHours: number | null;
  note: string;
};

export function getTodayJst(): string {
  const now = new Date();
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

function normalizeDateCell(v: string | undefined): string {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return v;
}

function normalizeTimeCell(v: string | undefined): string | null {
  if (!v) return null;
  const m = v.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?\s*(AM|PM)?$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = m[3]?.toUpperCase();
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  return v;
}

/** 行配列(可変長)を 13 列に整える */
function padRow(row: string[]): string[] {
  const out = row.slice(0, COL_COUNT);
  while (out.length < COL_COUNT) out.push("");
  return out;
}

function rowToEntry(rawRow: string[]): TimeclockEntry {
  const row = padRow(rawRow);
  const breaks: BreakSlot[] = [
    { start: normalizeTimeCell(row[COL.break1Start]), end: normalizeTimeCell(row[COL.break1End]) },
    { start: normalizeTimeCell(row[COL.break2Start]), end: normalizeTimeCell(row[COL.break2End]) },
    { start: normalizeTimeCell(row[COL.break3Start]), end: normalizeTimeCell(row[COL.break3End]) },
  ];
  return {
    date: normalizeDateCell(row[COL.date]),
    user: row[COL.user] || "",
    punchIn: normalizeTimeCell(row[COL.punchIn]),
    punchOut: normalizeTimeCell(row[COL.punchOut]),
    breaks,
    workedHours: row[COL.workedH] ? parseFloat(row[COL.workedH]) : null,
    breakHours: row[COL.breakH] ? parseFloat(row[COL.breakH]) : null,
    note: row[COL.note] || "",
  };
}

/** 「最後にスタートした未終了休憩」のスロット番号(0..2)。なければ -1。 */
function activeBreakIndex(breaks: BreakSlot[]): number {
  for (let i = breaks.length - 1; i >= 0; i--) {
    if (breaks[i].start && !breaks[i].end) return i;
  }
  return -1;
}

/** 次に使える空のスタートスロット番号(0..2)。空きがなければ -1。 */
function nextEmptyBreakIndex(breaks: BreakSlot[]): number {
  return breaks.findIndex((b) => !b.start);
}

export function statusFromEntry(e: TimeclockEntry | null): TimeclockStatus {
  if (!e || !e.punchIn) return "notStarted";
  if (e.punchOut) return "finished";
  if (activeBreakIndex(e.breaks) >= 0) return "onBreak";
  return "working";
}

/**
 * 勤怠シートの存在確認。無ければ作成、ヘッダーが旧フォーマットなら **clear → 再生成**。
 * (ユーザー合意済み: 既存データを初期化して再構成して良い)
 */
async function ensureSheet(sheets: ReturnType<typeof google.sheets>) {
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === SHEET_NAME);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS as unknown as string[]] },
    });
    return;
  }

  // 既存ヘッダーをチェック
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A1:M1`,
  });
  const got = (headerRes.data.values?.[0] ?? []) as string[];
  const matches = HEADERS.every((h, i) => got[i] === h);
  if (!matches) {
    // 全体クリア → ヘッダー再書き込み(旧データ破棄)
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: SHEET_NAME,
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS as unknown as string[]] },
    });
  }
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
  return values.length > 0 ? values.slice(1) : [];
}

export async function getTodayEntry(user: string, date?: string): Promise<TimeclockEntry | null> {
  const targetDate = date ?? getTodayJst();
  const rows = await readAllRows();
  const found = rows.find((r) => normalizeDateCell(r[COL.date]) === targetDate && r[COL.user] === user);
  return found ? rowToEntry(found) : null;
}

export async function listEntries(opts: {
  from?: string;
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

async function findRowIndex(user: string, date: string): Promise<{ index: number; rows: string[][] }> {
  const rows = await readAllRows();
  const idx = rows.findIndex((r) => normalizeDateCell(r[COL.date]) === date && r[COL.user] === user);
  return { index: idx, rows };
}

function toSheetRow(zeroBasedIndex: number): number {
  return zeroBasedIndex + 2;
}

function totalBreakHours(breaks: BreakSlot[]): number {
  return breaks.reduce((sum, b) => {
    if (b.start && b.end) return sum + diffHours(b.start, b.end);
    return sum;
  }, 0);
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

  const current: string[] = index >= 0
    ? padRow(rows[index])
    : (() => {
        const r = new Array<string>(COL_COUNT).fill("");
        r[COL.date] = date;
        r[COL.user] = user;
        return r;
      })();

  const entryNow = rowToEntry(current);
  const status = statusFromEntry(entryNow);

  switch (action) {
    case "punchIn":
      if (status !== "notStarted") {
        throw new Error(`既に出勤しています (現在: ${labelOf(status)})`);
      }
      current[COL.punchIn] = time;
      break;
    case "breakStart": {
      if (status !== "working") {
        throw new Error(`勤務中ではないため休憩開始できません (現在: ${labelOf(status)})`);
      }
      const slot = nextEmptyBreakIndex(entryNow.breaks);
      if (slot < 0) {
        throw new Error(`本日は休憩を ${MAX_BREAKS} 回取得済みのため、これ以上休憩できません`);
      }
      const startCol = [COL.break1Start, COL.break2Start, COL.break3Start][slot];
      current[startCol] = time;
      break;
    }
    case "breakEnd": {
      if (status !== "onBreak") {
        throw new Error(`休憩中ではないため休憩終了できません (現在: ${labelOf(status)})`);
      }
      const slot = activeBreakIndex(entryNow.breaks);
      const endCol = [COL.break1End, COL.break2End, COL.break3End][slot];
      current[endCol] = time;
      break;
    }
    case "punchOut": {
      if (status === "notStarted") throw new Error("未出勤のため退勤できません");
      if (status === "finished")   throw new Error("既に退勤済みです");
      // 休憩中に退勤 → 該当スロットの終了を退勤時刻で確定
      if (status === "onBreak") {
        const slot = activeBreakIndex(entryNow.breaks);
        const endCol = [COL.break1End, COL.break2End, COL.break3End][slot];
        current[endCol] = time;
      }
      current[COL.punchOut] = time;
      break;
    }
  }

  // 再パースして合計時間を計算
  const after = rowToEntry(current);
  const breakH = totalBreakHours(after.breaks);
  const workH = after.punchIn && after.punchOut
    ? Math.max(0, diffHours(after.punchIn, after.punchOut) - breakH)
    : 0;
  current[COL.workedH] = (after.punchIn && after.punchOut) ? workH.toFixed(2) : "";
  current[COL.breakH] = breakH > 0 ? breakH.toFixed(2) : "";

  if (index >= 0) {
    const sheetRow = toSheetRow(index);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A${sheetRow}:${LAST_COL_LETTER}${sheetRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [current] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: SHEET_NAME,
      valueInputOption: "RAW",
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
