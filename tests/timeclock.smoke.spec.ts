import { test, expect } from "@playwright/test";

/**
 * 勤怠ページの煙テスト。
 * 本番 Sheets を絶対に汚さないように API レイヤを page.route で完全モックする。
 */

const baseEntry = {
  date: "2026-05-03", user: "大輔",
  punchIn: null, breakStart: null, breakEnd: null, punchOut: null,
  workedHours: null, breakHours: null, note: "",
};

test.describe("勤怠ページ", () => {
  test.beforeEach(async ({ page }) => {
    let state: "notStarted" | "working" | "onBreak" | "finished" = "notStarted";
    let entry = { ...baseEntry };

    await page.route("**/api/timeclock**", async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() === "GET") {
        return route.fulfill({ json: { user: url.searchParams.get("user") ?? "大輔", status: state, entry: state === "notStarted" ? null : entry } });
      }
      const body = await route.request().postDataJSON();
      const action = body.action as string;
      const time = "09:00";
      if (action === "punchIn") { state = "working"; entry = { ...entry, punchIn: time }; }
      else if (action === "breakStart") { state = "onBreak"; entry = { ...entry, breakStart: time }; }
      else if (action === "breakEnd") { state = "working"; entry = { ...entry, breakEnd: time }; }
      else if (action === "punchOut") { state = "finished"; entry = { ...entry, punchOut: time }; }
      return route.fulfill({ json: { status: state, entry } });
    });
  });

  test("ユーザーピッカーが中央に出る・選択が切り替わる", async ({ page }) => {
    await page.goto("/timeclock");
    await expect(page.getByRole("radio", { name: "大輔" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "正直" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "清江" })).toBeVisible();

    await page.getByRole("radio", { name: "正直" }).click();
    await expect(page.getByText(/^正直\s+さん$/)).toBeVisible();
  });

  test("出勤 → 休憩 → 再開 → 退勤 の状態遷移が動く", async ({ page }) => {
    await page.goto("/timeclock");
    await expect(page.getByText("未出勤").first()).toBeVisible();

    await page.getByRole("button", { name: "出勤" }).click();
    await expect(page.getByRole("button", { name: "休憩" })).toBeVisible();
    await expect(page.getByText("勤務中").first()).toBeVisible();

    await page.getByRole("button", { name: "休憩" }).click();
    await expect(page.getByRole("button", { name: "再開" })).toBeVisible();
    await expect(page.getByText("休憩中").first()).toBeVisible();

    await page.getByRole("button", { name: "再開" }).click();
    await expect(page.getByRole("button", { name: "退勤" })).toBeVisible();

    await page.getByRole("button", { name: "退勤" }).click();
    await expect(page.getByText("退勤済み").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "完了" })).toBeDisabled();
  });

  test("?u=正直 で名前固定アクセスするとピッカーが消える", async ({ page }) => {
    await page.goto("/timeclock?u=%E6%AD%A3%E7%9B%B4");
    await expect(page.getByText(/^正直\s+さん$/)).toBeVisible();
    await expect(page.getByRole("radio", { name: "大輔" })).toHaveCount(0);
  });
});
