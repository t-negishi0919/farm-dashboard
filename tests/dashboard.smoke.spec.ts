import { test, expect } from "@playwright/test";

/**
 * ダッシュボード周辺の煙テスト。読み取り API をモックして決定論的に検証。
 */

const monthly12 = (q: number, s: number) =>
  Array.from({ length: 12 }, (_, i) => ({
    month: i + 1, quantity: i === 4 ? q : 0, sales: i === 4 ? s : 0, payment: 0, count: i === 4 ? 1 : 0,
  }));

const yearlySummaryFixture = {
  thisYear: 2026, lastYear: 2025, thisMonth: 5,
  monthly: monthly12(100, 200000),
  monthlyPrev: monthly12(80, 150000),
  availableYears: [2026, 2025, 2024],
  monthlyByYear: {
    "2026": monthly12(100, 200000),
    "2025": monthly12(80, 150000),
    "2024": monthly12(60, 100000),
  },
  allTimeMonthly: [],
  availableMonths: ["2026-05", "2026-04", "2025-05"],
  gradesByMonth: {
    "2026-05": [
      { grade: "AS", quantity: 60, total: 120000, unitPrice: 2000 },
      { grade: "AM", quantity: 40, total: 60000,  unitPrice: 1500 },
    ],
    "2025-05": [
      { grade: "AS", quantity: 50, total: 90000, unitPrice: 1800 },
      { grade: "AM", quantity: 30, total: 45000, unitPrice: 1500 },
    ],
  },
  gradesByYear: {
    "2026": [{ grade: "AS", quantity: 60, total: 120000, unitPrice: 2000 }],
    "2025": [{ grade: "AS", quantity: 50, total: 90000, unitPrice: 1800 }],
  },
  gradesByWeek: {},
  weeklyByYear: { "2026": [], "2025": [] },
  availableWeeks: [],
  thisMonthQty: 100, thisMonthSales: 180000,
  prevYearSameMonthQty: 80, prevYearSameMonthSales: 150000,
  ytdQty: 100, ytdSales: 180000,
  prevYearYtdQty: 80, prevYearYtdSales: 150000,
  thisMonthGrades: [],
  thisYearGrades: [{ grade: "AS", quantity: 60, total: 120000, unitPrice: 2000 }],
  allTimeGrades: [{ grade: "AS", quantity: 60, total: 120000, unitPrice: 2000 }],
  forecast: {
    elapsedRatio: 0.1, currentQty: 100, currentSales: 180000,
    prevYearQty: 80, prevYearSales: 150000,
    projectedQty: 1000, projectedSales: 1800000,
    projectedQtyPct: 25, projectedSalesPct: 20,
  },
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/yearly-summary", (route) =>
    route.fulfill({ json: yearlySummaryFixture }),
  );
  await page.route("**/api/today-weather", (route) =>
    route.fulfill({ json: { error: "skip" } }),
  );
});

test("ダッシュボードの主要見出しが描画される", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("月別推移").first()).toBeVisible();
  await expect(page.getByText("等級ミックス").first()).toBeVisible();
});

test("等級ミックスの比較ビューで縦棒2本が並ぶ", async ({ page }) => {
  await page.goto("/");
  // 等級ミックスのツールバー内「比較」タブ
  await page.getByText("等級ミックス").first().scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "比較", exact: true }).first().click();
  // 比較ビュー: 比較表のヘッダー「差分」と縦棒×2(合計 N 箱が 2 個 + 上部サマリ 1 個 = 3 個)が出る
  await expect(page.getByText("差分")).toBeVisible();
  await expect(page.getByText(/合計\s+[\d,]+\s+箱/)).toHaveCount(3);
});
