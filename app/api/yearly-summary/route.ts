import { getShippingData } from "@/lib/googleSheets";

export const revalidate = 0;

export type MonthlyPoint = {
  month: number;            // 1-12
  quantity: number;
  /** 売上 = 等級総額の合計 (subtotal) */
  sales: number;
  /** 手取り = subtotal + tax - 各種手数料 */
  payment: number;
  count: number;
};

/** 全期間（複数年）の月単位ポイント */
export type AllTimePoint = {
  /** "YYYY-MM" */
  ym: string;
  year: number;
  month: number;
  quantity: number;
  sales: number;
  payment: number;
};

export type GradeStat = {
  grade: string;
  quantity: number;
  total: number;            // 等級ごとの売上総額
  unitPrice: number | null; // 平均単価 = total / quantity
};

/** 週単位ポイント（日曜始まり・土曜終わり） */
export type WeeklyPoint = {
  /** 週の日曜の年（年跨ぎ反映） */
  weekYear: number;
  /** その weekYear 内での週番号 (1-53) */
  week: number;
  /** "YYYY-Www" 例: "2026-W14" */
  isoKey: string;
  /** 週の開始日(日曜) "YYYY-MM-DD" */
  startDate: string;
  /** 週の終了日(土曜) "YYYY-MM-DD" */
  endDate: string;
  quantity: number;
  sales: number;
  payment: number;
  count: number;
};

/** 当月（進行中）の達成ペース予測 */
export type MonthlyForecast = {
  /** 月の経過進捗率 0-1 (= 経過日数 / その月の日数) */
  elapsedRatio: number;
  /** 当月実績数量 */
  currentQty: number;
  /** 当月実績売上 */
  currentSales: number;
  /** 前年同月の最終値 */
  prevYearQty: number;
  prevYearSales: number;
  /** 単純線形外挿: current / elapsedRatio */
  projectedQty: number;
  projectedSales: number;
  /** 前年比予測 % (例: +12, -5, null=前年データ無し) */
  projectedQtyPct: number | null;
  projectedSalesPct: number | null;
};

export type YearlySummary = {
  thisYear: number;
  lastYear: number;
  thisMonth: number;        // 1-12
  // 当年 vs 前年 の月別配列（1〜12）
  monthly: MonthlyPoint[];
  monthlyPrev: MonthlyPoint[];
  /** 出荷データのある年（降順） */
  availableYears: number[];
  /** 年ごとの月別配列 (1〜12 のうち出荷ありの年) */
  monthlyByYear: Record<string, MonthlyPoint[]>;
  /** 全期間の月別（年月で時系列） */
  allTimeMonthly: AllTimePoint[];
  /** 出荷データのある月（"YYYY-MM" 降順） */
  availableMonths: string[];
  /** 月ごとの等級ミックス */
  gradesByMonth: Record<string, GradeStat[]>;
  /** 年ごとの等級ミックス（"YYYY" → GradeStat[]） */
  gradesByYear: Record<string, GradeStat[]>;
  /** 週ごとの等級ミックス（"YYYY-Www" → GradeStat[]） */
  gradesByWeek: Record<string, GradeStat[]>;
  /** 年ごとの週単位ポイント（"YYYY" → WeeklyPoint[]、週番号昇順） */
  weeklyByYear: Record<string, WeeklyPoint[]>;
  /** 出荷データのある週（"YYYY-Www" 降順） */
  availableWeeks: string[];
  // 当月の累計
  thisMonthQty: number;
  thisMonthSales: number;
  prevYearSameMonthQty: number;
  prevYearSameMonthSales: number;
  // 当年累計
  ytdQty: number;
  ytdSales: number;
  prevYearYtdQty: number;       // 前年同期間（1月〜当月まで）
  prevYearYtdSales: number;
  // 等級ミックス（複数スコープ）
  thisMonthGrades: GradeStat[];
  thisYearGrades: GradeStat[];
  allTimeGrades: GradeStat[];
  /** 当月のペース予測 */
  forecast: MonthlyForecast;
};

const GRADES = ["摘果", "ASS", "AS", "AM", "B", "C", "D", "S", "M"] as const;

function emptyMonthly(): MonthlyPoint[] {
  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1, quantity: 0, sales: 0, payment: 0, count: 0,
  }));
}

function emptyGradeAcc(): Record<string, { quantity: number; total: number }> {
  const acc: Record<string, { quantity: number; total: number }> = {};
  GRADES.forEach((g) => (acc[g] = { quantity: 0, total: 0 }));
  return acc;
}

function toGradeStats(acc: Record<string, { quantity: number; total: number }>): GradeStat[] {
  return GRADES.map((g) => {
    const a = acc[g];
    return {
      grade: g,
      quantity: a.quantity,
      total: a.total,
      unitPrice: a.quantity > 0 ? Math.round(a.total / a.quantity) : null,
    };
  }).filter((g) => g.quantity > 0);
}

function daysInMonth(year: number, month: number): number {
  // month: 1-12
  return new Date(year, month, 0).getDate();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * 日曜始まり・土曜終わりの週情報を返す。
 * weekYear = 当該週の日曜が属する年。
 * week = その weekYear の最初の日曜を W1 とした連番(年初の日曜より前の日は前年の最終週)。
 */
function weekInfo(date: Date): { weekYear: number; week: number; isoKey: string; sunday: Date; saturday: Date } {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // その週の日曜
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay()); // getDay: Sun=0
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  const weekYear = sunday.getFullYear();
  // weekYear の 1/1 とその最初の日曜
  const jan1 = new Date(weekYear, 0, 1);
  const firstSunday = new Date(jan1);
  firstSunday.setDate(jan1.getDate() + ((7 - jan1.getDay()) % 7));
  const diffMs = sunday.getTime() - firstSunday.getTime();
  const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;

  return {
    weekYear,
    week,
    isoKey: `${weekYear}-W${pad2(week)}`,
    sunday,
    saturday,
  };
}

function emptyWeekly(weekYear: number, week: number, sunday: Date, saturday: Date): WeeklyPoint {
  return {
    weekYear,
    week,
    isoKey: `${weekYear}-W${pad2(week)}`,
    startDate: ymd(sunday),
    endDate: ymd(saturday),
    quantity: 0, sales: 0, payment: 0, count: 0,
  };
}

export async function GET() {
  try {
    const data = await getShippingData();
    const now = new Date();
    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;
    const thisMonth = now.getMonth() + 1; // 1-12

    const monthly = emptyMonthly();
    const monthlyPrev = emptyMonthly();

    // 全年のmonthly: Map<year, MonthlyPoint[]>
    const monthlyByYearMap = new Map<number, MonthlyPoint[]>();

    const allTimeMap = new Map<string, AllTimePoint>();

    let thisMonthQty = 0;
    let thisMonthSales = 0;
    let prevYearSameMonthQty = 0;
    let prevYearSameMonthSales = 0;
    let ytdQty = 0;
    let ytdSales = 0;
    let prevYearYtdQty = 0;
    let prevYearYtdSales = 0;

    const thisMonthGradeAcc = emptyGradeAcc();
    const thisYearGradeAcc  = emptyGradeAcc();
    const allTimeGradeAcc   = emptyGradeAcc();

    // 月別等級アキュムレータ: {ym: gradeAcc}
    const gradeByMonthAcc = new Map<string, ReturnType<typeof emptyGradeAcc>>();
    // 年別等級アキュムレータ: {year: gradeAcc}
    const gradeByYearAcc = new Map<number, ReturnType<typeof emptyGradeAcc>>();
    // 週別等級アキュムレータ: {isoKey: gradeAcc}
    const gradeByWeekAcc = new Map<string, ReturnType<typeof emptyGradeAcc>>();
    // 週単位ポイント: {weekYear: Map<week, WeeklyPoint>}
    const weeklyByYearMap = new Map<number, Map<number, WeeklyPoint>>();

    for (const r of data) {
      const m = r.shippingDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (!m) continue;
      const y = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10);
      const day = parseInt(m[3], 10);
      if (!Number.isFinite(y) || !Number.isFinite(mo)) continue;

      const qty = r.totalQuantity ?? 0;
      const sales = r.subtotal ?? 0;
      const pay = r.payment ?? 0;

      // 週情報
      const wi = weekInfo(new Date(y, mo - 1, day));
      let weeksMap = weeklyByYearMap.get(wi.weekYear);
      if (!weeksMap) {
        weeksMap = new Map();
        weeklyByYearMap.set(wi.weekYear, weeksMap);
      }
      let wp = weeksMap.get(wi.week);
      if (!wp) {
        wp = emptyWeekly(wi.weekYear, wi.week, wi.sunday, wi.saturday);
        weeksMap.set(wi.week, wp);
      }
      wp.quantity += qty;
      wp.sales += sales;
      wp.payment += pay;
      wp.count += 1;

      let weekAcc = gradeByWeekAcc.get(wi.isoKey);
      if (!weekAcc) {
        weekAcc = emptyGradeAcc();
        gradeByWeekAcc.set(wi.isoKey, weekAcc);
      }
      for (const g of GRADES) {
        const grade = r.grades[g];
        if (grade) {
          weekAcc[g].quantity += grade.quantity ?? 0;
          weekAcc[g].total += grade.total ?? 0;
        }
      }

      const ym = `${y}-${String(mo).padStart(2, "0")}`;
      const at = allTimeMap.get(ym) ?? { ym, year: y, month: mo, quantity: 0, sales: 0, payment: 0 };
      at.quantity += qty;
      at.sales += sales;
      at.payment += pay;
      allTimeMap.set(ym, at);

      // 全年別 monthly
      let yearArr = monthlyByYearMap.get(y);
      if (!yearArr) {
        yearArr = emptyMonthly();
        monthlyByYearMap.set(y, yearArr);
      }
      const yearSlot = yearArr[mo - 1];
      yearSlot.quantity += qty;
      yearSlot.sales += sales;
      yearSlot.payment += pay;
      yearSlot.count += 1;

      // 月別等級
      let monthAcc = gradeByMonthAcc.get(ym);
      if (!monthAcc) {
        monthAcc = emptyGradeAcc();
        gradeByMonthAcc.set(ym, monthAcc);
      }

      let yearAcc = gradeByYearAcc.get(y);
      if (!yearAcc) {
        yearAcc = emptyGradeAcc();
        gradeByYearAcc.set(y, yearAcc);
      }

      for (const g of GRADES) {
        const grade = r.grades[g];
        if (grade) {
          const q = grade.quantity ?? 0;
          const t = grade.total ?? 0;
          allTimeGradeAcc[g].quantity += q;
          allTimeGradeAcc[g].total += t;
          monthAcc[g].quantity += q;
          monthAcc[g].total += t;
          yearAcc[g].quantity += q;
          yearAcc[g].total += t;
        }
      }

      if (y === thisYear) {
        const slot = monthly[mo - 1];
        slot.quantity += qty;
        slot.sales += sales;
        slot.payment += pay;
        slot.count += 1;

        if (mo <= thisMonth) {
          ytdQty += qty;
          ytdSales += sales;
        }

        for (const g of GRADES) {
          const grade = r.grades[g];
          if (grade) {
            thisYearGradeAcc[g].quantity += grade.quantity ?? 0;
            thisYearGradeAcc[g].total += grade.total ?? 0;
          }
        }

        if (mo === thisMonth) {
          thisMonthQty += qty;
          thisMonthSales += sales;
          for (const g of GRADES) {
            const grade = r.grades[g];
            if (grade) {
              thisMonthGradeAcc[g].quantity += grade.quantity ?? 0;
              thisMonthGradeAcc[g].total += grade.total ?? 0;
            }
          }
        }
      } else if (y === lastYear) {
        const slot = monthlyPrev[mo - 1];
        slot.quantity += qty;
        slot.sales += sales;
        slot.payment += pay;
        slot.count += 1;

        if (mo <= thisMonth) {
          prevYearYtdQty += qty;
          prevYearYtdSales += sales;
        }
        if (mo === thisMonth) {
          prevYearSameMonthQty += qty;
          prevYearSameMonthSales += sales;
        }
      }
    }

    const allTimeMonthly = Array.from(allTimeMap.values()).sort((a, b) => a.ym.localeCompare(b.ym));

    // availableMonths: 出荷ありの月のみ（降順）
    const availableMonths = allTimeMonthly
      .filter((p) => p.quantity > 0 || p.sales > 0)
      .map((p) => p.ym)
      .sort((a, b) => b.localeCompare(a));

    // 月ごとの等級ミックス
    const gradesByMonth: Record<string, GradeStat[]> = {};
    for (const [ym, acc] of gradeByMonthAcc.entries()) {
      const stats = toGradeStats(acc);
      if (stats.length > 0) {
        gradesByMonth[ym] = stats;
      }
    }

    // 年ごとの等級ミックス
    const gradesByYear: Record<string, GradeStat[]> = {};
    for (const [y, acc] of gradeByYearAcc.entries()) {
      const stats = toGradeStats(acc);
      if (stats.length > 0) {
        gradesByYear[String(y)] = stats;
      }
    }

    // 週ごとの等級ミックス
    const gradesByWeek: Record<string, GradeStat[]> = {};
    for (const [key, acc] of gradeByWeekAcc.entries()) {
      const stats = toGradeStats(acc);
      if (stats.length > 0) {
        gradesByWeek[key] = stats;
      }
    }

    // 週単位ポイント (年毎、週番号昇順)
    const weeklyByYear: Record<string, WeeklyPoint[]> = {};
    for (const [wy, weeks] of weeklyByYearMap.entries()) {
      weeklyByYear[String(wy)] = Array.from(weeks.values()).sort((a, b) => a.week - b.week);
    }

    const availableWeeks = Object.keys(gradesByWeek).sort((a, b) => b.localeCompare(a));

    // 当月ペース予測
    const dim = daysInMonth(thisYear, thisMonth);
    const elapsedRatio = Math.min(now.getDate() / dim, 1);
    const projectedQty   = elapsedRatio > 0 ? Math.round(thisMonthQty / elapsedRatio) : 0;
    const projectedSales = elapsedRatio > 0 ? Math.round(thisMonthSales / elapsedRatio) : 0;
    const forecast: MonthlyForecast = {
      elapsedRatio,
      currentQty: thisMonthQty,
      currentSales: thisMonthSales,
      prevYearQty: prevYearSameMonthQty,
      prevYearSales: prevYearSameMonthSales,
      projectedQty,
      projectedSales,
      projectedQtyPct:   prevYearSameMonthQty   > 0 ? ((projectedQty   - prevYearSameMonthQty)   / prevYearSameMonthQty)   * 100 : null,
      projectedSalesPct: prevYearSameMonthSales > 0 ? ((projectedSales - prevYearSameMonthSales) / prevYearSameMonthSales) * 100 : null,
    };

    const availableYears = Array.from(monthlyByYearMap.keys()).sort((a, b) => b - a);
    const monthlyByYear: Record<string, MonthlyPoint[]> = {};
    for (const [y, arr] of monthlyByYearMap.entries()) {
      monthlyByYear[String(y)] = arr;
    }

    const result: YearlySummary = {
      thisYear,
      lastYear,
      thisMonth,
      monthly,
      monthlyPrev,
      availableYears,
      monthlyByYear,
      allTimeMonthly,
      availableMonths,
      gradesByMonth,
      gradesByYear,
      gradesByWeek,
      weeklyByYear,
      availableWeeks,
      thisMonthQty,
      thisMonthSales,
      prevYearSameMonthQty,
      prevYearSameMonthSales,
      ytdQty,
      ytdSales,
      prevYearYtdQty,
      prevYearYtdSales,
      thisMonthGrades: toGradeStats(thisMonthGradeAcc),
      thisYearGrades:  toGradeStats(thisYearGradeAcc),
      allTimeGrades:   toGradeStats(allTimeGradeAcc),
      forecast,
    };

    return Response.json(result);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
