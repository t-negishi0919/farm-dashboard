import { google } from "googleapis";
import { getWriteAuth, getSpreadsheetId } from "@/lib/googleSheets";

const SHEET_NAME = "ご要望";
const HEADER = [
  "送信日時",
  "送信者",
  "種別",
  "本文",
  "スクショURL",
  "ステータス",
];

export type FeedbackCategory = "要望" | "不具合" | "その他";

export type FeedbackInput = {
  email: string;
  category: FeedbackCategory;
  body: string;
  imageUrls: string[];
};

async function ensureSheetExists(): Promise<void> {
  const auth = getWriteAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSpreadsheetId();

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets?.some(
    (s) => s.properties?.title === SHEET_NAME,
  );
  if (existing) return;

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
    requestBody: { values: [HEADER] },
  });
}

export async function appendFeedback(input: FeedbackInput): Promise<void> {
  await ensureSheetExists();

  const auth = getWriteAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSpreadsheetId();

  const now = new Date().toISOString();
  const row = [
    now,
    input.email,
    input.category,
    input.body,
    input.imageUrls.join(","),
    "未対応",
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}
