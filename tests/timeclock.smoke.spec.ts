import { test, expect } from "@playwright/test";

type Break = { start: string | null; end: string | null };
type Entry = {
  date: string; user: string;
  punchIn: string | null; punchOut: string | null;
  breaks: Break[];
  workedHours: number | null; breakHours: number | null; note: string;
};

const emptyBreaks = (): Break[] => [
  { start: null, end: null },
  { start: null, end: null },
  { start: null, end: null },
];
const baseEntry = (): Entry => ({
  date: "2026-05-03", user: "大輔",
  punchIn: null, punchOut: null,
  breaks: emptyBreaks(),
  workedHours: null, breakHours: null, note: "",
});

test.describe("勤怠ページ", () => {
  test.beforeEach(async ({ page }) => {
    let state: "notStarted" | "working" | "onBreak" | "finished" = "notStarted";
    let entry = baseEntry();

    await page.route("**/api/timeclock**", async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() === "GET") {
        return route.fulfill({
          json: {
            user: url.searchParams.get("user") ?? "大輔",
            status: state,
            entry: state === "notStarted" ? null : entry,
          },
        });
      }
      const body = await route.request().postDataJSON();
      const action = body.action as string;
      const time = "09:00";
      if (action === "punchIn") {
        state = "working";
        entry = { ...entry, punchIn: time };
      } else if (action === "breakStart") {
        const slot = entry.breaks.findIndex((b) => !b.start);
        if (slot < 0) {
          return route.fulfill({ status: 409, json: { error: "max breaks" } });
        }
        const next = [...entry.breaks];
        next[slot] = { start: time, end: null };
        entry = { ...entry, breaks: next };
        state = "onBreak";
      } else if (action === "breakEnd") {
        const slot = [...entry.breaks].reverse().findIndex((b) => b.start && !b.end);
        const real = slot < 0 ? -1 : entry.breaks.length - 1 - slot;
        const next = [...entry.breaks];
        if (real >= 0) next[real] = { ...next[real], end: time };
        entry = { ...entry, breaks: next };
        state = "working";
      } else if (action === "punchOut") {
        state = "finished";
        entry = { ...entry, punchOut: time };
      }
      return route.fulfill({ json: { status: state, entry } });
    });
  });

  test("ユーザーピッカーが中央に出る・選択が切り替わる", async ({ page }) => {
    await page.goto("/timeclock");
    await expect(page.getByRole("radio", { name: "大輔" })).toBeVisible();
    await page.getByRole("radio", { name: "正直" }).click();
    await expect(page.getByText(/^正直\s+さん$/)).toBeVisible();
  });

  test("出勤後は退勤と休憩トグルが常時出ている", async ({ page }) => {
    await page.goto("/timeclock");
    await expect(page.getByRole("button", { name: "出勤" })).toBeVisible();

    await page.getByRole("button", { name: "出勤" }).click();
    // 出勤後: 退勤(メインボタン)と 休憩開始(中ボタン)が同時に見える
    await expect(page.getByRole("button", { name: "退勤" })).toBeVisible();
    await expect(page.getByRole("button", { name: "休憩開始" })).toBeVisible();
  });

  test("休憩を 2 回取って退勤できる", async ({ page }) => {
    await page.goto("/timeclock");
    await page.getByRole("button", { name: "出勤" }).click();

    // 1 回目
    await page.getByRole("button", { name: "休憩開始" }).click();
    await expect(page.getByRole("button", { name: "休憩終了" })).toBeVisible();
    await page.getByRole("button", { name: "休憩終了" }).click();
    // 戻ったら再び休憩開始が押せる
    await expect(page.getByRole("button", { name: "休憩開始" })).toBeVisible();

    // 2 回目
    await page.getByRole("button", { name: "休憩開始" }).click();
    await page.getByRole("button", { name: "休憩終了" }).click();

    // 退勤
    await page.getByRole("button", { name: "退勤" }).click();
    await expect(page.getByRole("button", { name: "退勤済み" })).toBeDisabled();
  });

  test("?u=正直 で名前固定アクセスするとピッカーが消える", async ({ page }) => {
    await page.goto("/timeclock?u=%E6%AD%A3%E7%9B%B4");
    await expect(page.getByText(/^正直\s+さん$/)).toBeVisible();
    await expect(page.getByRole("radio", { name: "大輔" })).toHaveCount(0);
  });
});
