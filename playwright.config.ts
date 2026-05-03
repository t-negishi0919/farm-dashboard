import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright 設定
 * - dev server を `npm run dev` で自動起動(既に起動済なら使い回す)
 * - 並列実行は false: 同一 Sheets を叩く可能性があるため
 * - locale / timezone は JST 固定
 *
 * 注意: 既定では実 API モックなしで叩くと本番スプレッドシートに書き込み
 * される可能性があります。打刻系のテストは `page.route` で API をモック
 * してください (tests/timeclock.smoke.spec.ts 参照)。
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? "list" : "html",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile",   use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
