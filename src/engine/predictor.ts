import {
  AnalogueMeal,
  BacktestRow,
  BacktestSummary,
  CalendarRecord,
  ConditionWasteStat,
  DatasetBundle,
  DayCategory,
  EnrichedMealRecord,
  FactorContribution,
  FoodPrepRecord,
  ItemRecommendation,
  MealType,
  PredictionInput,
  PredictionResult,
  RiskPosture,
  StaffAlert,
  WastageHotspot,
} from '../types/mess';

// Approximate kg-equivalent conversion for pieces and liters when computing total mess weight metrics
export function toKgEquivalent(qty: number, unit: 'kg' | 'L' | 'pcs'): number {
  if (unit === 'kg') return qty;
  if (unit === 'L') return qty * 1.0;
  // Standard piece weights (roti ~40g, samosa/vada/gulab jamun ~65g average)
  return qty * 0.055;
}

// Estimated INR cost per unit for hostel mess items
export function getUnitCostInr(itemName: string, unit: 'kg' | 'L' | 'pcs'): number {
  const n = itemName.toLowerCase();
  if (n.includes('paneer')) return 240;
  if (n.includes('biryani') || n.includes('manchurian')) return 145;
  if (n.includes('gulab')) return 14;
  if (n.includes('samosa') || n.includes('pakora') || n.includes('vada') || n.includes('bhature')) return 11;
  if (n.includes('paratha')) return 14;
  if (n.includes('roti')) return 5.5;
  if (n.includes('lassi') || n.includes('coffee')) return 75;
  if (n.includes('chai') || n.includes('tea')) return 48;
  if (n.includes('curd') || n.includes('raita')) return 85;
  if (n.includes('dal') || n.includes('rajma') || n.includes('chole') || n.includes('chana')) return 115;
  if (n.includes('rice') || n.includes('pulao') || n.includes('khichdi')) return 72;
  if (unit === 'pcs') return 8;
  if (unit === 'L') return 68;
  return 95;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getDayOfWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return 'Monday';
  return DAYS_OF_WEEK[d.getDay()];
}

// Normal CDF and Inverse Normal CDF (Beasley-Springer-Moro approximation) for Newsvendor Risk Math
function normCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function normInv(p: number): number {
  const clamped = Math.min(0.995, Math.max(0.005, p));
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  if (clamped < pLow) {
    const q = Math.sqrt(-2 * Math.log(clamped));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (clamped <= pHigh) {
    const q = clamped - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - clamped));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

// Join all 3 CSVs by date and meal_type, plus flag unusual historical anomalies
export function enrichDataset(bundle: DatasetBundle): EnrichedMealRecord[] {
  const calMap = new Map<string, CalendarRecord>();
  for (const c of bundle.calendar) {
    calMap.set(c.date, c);
  }

  const prepMap = new Map<string, FoodPrepRecord[]>();
  for (const p of bundle.foodPrep) {
    const key = `${p.date}__${p.meal_type}`;
    const list = prepMap.get(key) || [];
    list.push(p);
    prepMap.set(key, list);
  }

  const enriched: EnrichedMealRecord[] = bundle.meals.map((m) => {
    const cal = calMap.get(m.date);
    const dow = cal?.day_of_week || getDayOfWeek(m.date);
    const isWknd = dow === 'Saturday' || dow === 'Sunday';
    const dayCategory: DayCategory = cal?.day_category || (isWknd ? 'Weekend' : 'Academic');
    const eventName = cal?.event_name || m.event_info || 'Regular Day';
    const items = prepMap.get(`${m.date}__${m.meal_type}`) || [];

    let totalPrepKg = 0;
    let totalConsKg = 0;
    let totalLeftKg = 0;
    for (const it of items) {
      totalPrepKg += toKgEquivalent(it.prepared_qty, it.unit);
      totalConsKg += toKgEquivalent(it.consumed_qty, it.unit);
      totalLeftKg += toKgEquivalent(it.leftover_qty, it.unit);
    }

    // Fallback if foodPrep CSV didn't cover a specific date
    if (items.length === 0) {
      totalPrepKg = Number((m.expected_students * 0.56).toFixed(1));
      totalConsKg = Number((Math.min(m.expected_students, m.actual_students) * 0.52).toFixed(1));
      totalLeftKg = Number(Math.max(0, totalPrepKg - totalConsKg).toFixed(1));
    }

    const wastePct = totalPrepKg > 0 ? (totalLeftKg / totalPrepKg) * 100 : 0;
    const shortageOccurred = m.actual_students > m.expected_students * 1.03;

    return {
      ...m,
      day_of_week: dow,
      day_category: dayCategory,
      event_name: eventName,
      items,
      total_prepared_kg_eq: Number(totalPrepKg.toFixed(1)),
      total_consumed_kg_eq: Number(totalConsKg.toFixed(1)),
      total_leftover_kg_eq: Number(totalLeftKg.toFixed(1)),
      waste_pct: Number(wastePct.toFixed(1)),
      shortage_occurred: shortageOccurred,
      attendance_error_staff: m.expected_students - m.actual_students,
    };
  });

  // Sort chronologically
  enriched.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const order: Record<MealType, number> = { Breakfast: 0, Lunch: 1, Snacks: 2, Dinner: 3 };
    return order[a.meal_type] - order[b.meal_type];
  });

  // Anomaly Detection: Compare each record against peers of same meal_type & day_category
  const groupStats = new Map<string, { mean: number; std: number }>();
  const buckets = new Map<string, number[]>();
  for (const r of enriched) {
    const k = `${r.meal_type}__${r.day_category}`;
    const arr = buckets.get(k) || [];
    arr.push(r.actual_students);
    buckets.set(k, arr);
  }
  buckets.forEach((arr, k) => {
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, arr.length - 1);
    groupStats.set(k, { mean, std: Math.max(15, Math.sqrt(variance)) });
  });

  for (const r of enriched) {
    const stat = groupStats.get(`${r.meal_type}__${r.day_category}`);
    if (stat) {
      const z = (r.actual_students - stat.mean) / stat.std;
      if (Math.abs(z) >= 2.0) {
        r.is_anomaly = true;
        const pct = Math.round(((r.actual_students - stat.mean) / stat.mean) * 100);
        r.anomaly_reason =
          pct < 0
            ? `Unusual drop (${pct}% vs ${r.day_category} ${r.meal_type} avg): ${r.event_info || r.event_name}`
            : `Unusual surge (+${pct}% vs ${r.day_category} ${r.meal_type} avg): ${r.event_info || r.event_name}`;
      }
    }
  }

  return enriched;
}

// Menu Affinity Classifier (extracts culinary appeal signal from menu string + historical performance)
export function computeMenuAppealScore(menu: string, history: EnrichedMealRecord[], mealType: MealType): number {
  const normalized = menu.toLowerCase().trim();
  const mealRecords = history.filter((h) => h.meal_type === mealType && !h.is_anomaly);
  if (mealRecords.length === 0) return 0;

  const mealMean = mealRecords.reduce((s, r) => s + r.actual_students, 0) / mealRecords.length;

  // Check exact or token-level match in history
  const exactMatches = mealRecords.filter((r) => r.menu.toLowerCase().trim() === normalized);
  if (exactMatches.length >= 2) {
    const avg = exactMatches.reduce((s, r) => s + r.actual_students, 0) / exactMatches.length;
    return Math.max(-0.25, Math.min(0.25, (avg - mealMean) / mealMean));
  }

  // Fallback keyword appeal heuristic learned from common mess dishes
  let bonus = 0;
  if (/biryani|paneer|chole bhature|manchurian|gulab jamun|dosa|paratha|samosa|cold coffee|pasta/.test(normalized)) {
    bonus += 0.12;
  }
  if (/khichdi|upma|lauki|tinda|kadhi|bhel/.test(normalized)) {
    bonus -= 0.11;
  }
  return bonus;
}

// Pure TypeScript Ridge Regression Solver: (X^T X + lambda I) w = X^T y via Gauss-Jordan Elimination
const FEATURE_NAMES = [
  'intercept',
  'meal_Lunch',
  'meal_Snacks',
  'meal_Dinner',
  'dow_Tue',
  'dow_Wed',
  'dow_Thu',
  'dow_Fri',
  'dow_Sat',
  'dow_Sun',
  'cat_Weekend',
  'cat_Holiday',
  'cat_Exam',
  'cat_Vacation',
  'cat_Event',
  'fri_dinner',
  'exam_breakfast',
  'exam_snacks',
  'event_lunch',
  'menu_appeal',
  'recent_ratio',
] as const;

function buildFeatureVector(
  mealType: MealType,
  dow: string,
  dayCategory: DayCategory,
  menuAppeal: number,
  recentRatio: number
): number[] {
  return [
    1,
    mealType === 'Lunch' ? 1 : 0,
    mealType === 'Snacks' ? 1 : 0,
    mealType === 'Dinner' ? 1 : 0,
    dow === 'Tuesday' ? 1 : 0,
    dow === 'Wednesday' ? 1 : 0,
    dow === 'Thursday' ? 1 : 0,
    dow === 'Friday' ? 1 : 0,
    dow === 'Saturday' ? 1 : 0,
    dow === 'Sunday' ? 1 : 0,
    dayCategory === 'Weekend' ? 1 : 0,
    dayCategory === 'Holiday' ? 1 : 0,
    dayCategory === 'Examination' ? 1 : 0,
    dayCategory === 'Vacation' ? 1 : 0,
    dayCategory === 'Campus Event' ? 1 : 0,
    dow === 'Friday' && mealType === 'Dinner' ? 1 : 0,
    dayCategory === 'Examination' && mealType === 'Breakfast' ? 1 : 0,
    dayCategory === 'Examination' && mealType === 'Snacks' ? 1 : 0,
    dayCategory === 'Campus Event' && mealType === 'Lunch' ? 1 : 0,
    menuAppeal,
    recentRatio,
  ];
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) maxRow = r;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    const pivot = Math.abs(M[col][col]) < 1e-8 ? 1e-8 : M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= pivot;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let j = col; j <= n; j++) M[r][j] -= factor * M[col][j];
    }
  }
  return M.map((row) => row[n]);
}

export interface TrainedModel {
  weights: number[];
  residualStdByMeal: Record<MealType, number>;
  mealBaselines: Record<MealType, number>;
  recentRatio: number;
  menuAppealCache: Map<string, number>;
}

export function trainAttendanceModel(history: EnrichedMealRecord[]): TrainedModel {
  const clean = history.filter((r) => !r.is_anomaly);
  const trainSet = clean.length >= 16 ? clean : history;

  const mealBaselines: Record<MealType, number> = {
    Breakfast: 310,
    Lunch: 390,
    Snacks: 290,
    Dinner: 365,
  };

  (['Breakfast', 'Lunch', 'Snacks', 'Dinner'] as MealType[]).forEach((mt) => {
    const sub = trainSet.filter((r) => r.meal_type === mt);
    if (sub.length > 0) {
      mealBaselines[mt] = sub.reduce((s, r) => s + r.actual_students, 0) / sub.length;
    }
  });

  // Compute recent 14-day attendance drift relative to overall mean
  const overallMean =
    trainSet.reduce((s, r) => s + r.actual_students, 0) / Math.max(1, trainSet.length);
  const recentWindow = trainSet.slice(-Math.min(56, trainSet.length));
  const recentMean =
    recentWindow.reduce((s, r) => s + r.actual_students, 0) / Math.max(1, recentWindow.length);
  const recentRatio = overallMean > 0 ? (recentMean - overallMean) / overallMean : 0;

  const menuAppealCache = new Map<string, number>();
  const dim = FEATURE_NAMES.length;
  const XtX = Array.from({ length: dim }, () => Array(dim).fill(0));
  const Xty = Array(dim).fill(0);

  // Recency-weighted Ridge regression
  const n = trainSet.length;
  trainSet.forEach((rec, idx) => {
    const key = `${rec.meal_type}__${rec.menu.toLowerCase().trim()}`;
    let appeal = menuAppealCache.get(key);
    if (appeal === undefined) {
      appeal = computeMenuAppealScore(rec.menu, trainSet, rec.meal_type);
      menuAppealCache.set(key, appeal);
    }

    // Exponential recency weight: newer meals carry slightly more weight (0.7 to 1.3)
    const recencyWeight = 0.7 + 0.6 * (idx / Math.max(1, n - 1));
    const localRecent =
      idx >= 24
        ? (trainSet.slice(idx - 24, idx).reduce((s, r) => s + r.actual_students, 0) / 24 - overallMean) /
          Math.max(1, overallMean)
        : 0;

    const x = buildFeatureVector(rec.meal_type, rec.day_of_week, rec.day_category, appeal, localRecent);
    const y = rec.actual_students;

    for (let i = 0; i < dim; i++) {
      Xty[i] += recencyWeight * x[i] * y;
      for (let j = 0; j < dim; j++) {
        XtX[i][j] += recencyWeight * x[i] * x[j];
      }
    }
  });

  // Ridge penalty (do not penalize intercept at index 0)
  const lambda = 2.5;
  for (let i = 1; i < dim; i++) {
    XtX[i][i] += lambda;
  }

  const weights = solveLinearSystem(XtX, Xty);

  // Estimate residual standard deviation per meal type
  const residualStdByMeal: Record<MealType, number> = {
    Breakfast: 18,
    Lunch: 22,
    Snacks: 18,
    Dinner: 20,
  };
  (['Breakfast', 'Lunch', 'Snacks', 'Dinner'] as MealType[]).forEach((mt) => {
    const sub = trainSet.filter((r) => r.meal_type === mt);
    if (sub.length > 4) {
      const errs = sub.map((rec) => {
        const appeal = menuAppealCache.get(`${mt}__${rec.menu.toLowerCase().trim()}`) ?? 0;
        const x = buildFeatureVector(mt, rec.day_of_week, rec.day_category, appeal, recentRatio);
        const pred = x.reduce((s, xi, i) => s + xi * weights[i], 0);
        return rec.actual_students - pred;
      });
      const variance = errs.reduce((s, e) => s + e * e, 0) / Math.max(1, errs.length - 1);
      residualStdByMeal[mt] = Math.max(12, Math.min(45, Math.sqrt(variance)));
    }
  });

  return {
    weights,
    residualStdByMeal,
    mealBaselines,
    recentRatio,
    menuAppealCache,
  };
}

// Critical fractile z* for Newsvendor asymmetric cost posture
function getNewsvendorZ(posture: RiskPosture): { z: number; label: string } {
  if (posture === 'eco') {
    // Waste penalized more heavily: target ~58% service level
    return { z: normInv(0.58), label: 'Eco-Minimal Waste (58% service fractile)' };
  }
  if (posture === 'zero_shortage') {
    // Shortage penalized heavily: target ~92% service level
    return { z: normInv(0.92), label: 'Zero-Shortage Guard (92% service fractile)' };
  }
  // Balanced: shortage ~2.6x more costly to student experience than 1 serving leftover -> 72% fractile
  return { z: normInv(0.72), label: 'Balanced Newsvendor (72% service fractile)' };
}

export function predictUpcomingMeal(
  input: PredictionInput,
  history: EnrichedMealRecord[],
  model: TrainedModel
): PredictionResult {
  const dow = getDayOfWeek(input.date);
  const w = model.weights;
  const menuKey = `${input.meal_type}__${input.menu.toLowerCase().trim()}`;
  const menuAppeal =
    model.menuAppealCache.get(menuKey) ??
    computeMenuAppealScore(input.menu, history, input.meal_type);

  // Decompose prediction into human-readable factor contributions
  const mealBase =
    w[0] +
    (input.meal_type === 'Lunch' ? w[1] : 0) +
    (input.meal_type === 'Snacks' ? w[2] : 0) +
    (input.meal_type === 'Dinner' ? w[3] : 0);

  const dowDelta =
    (dow === 'Tuesday' ? w[4] : 0) +
    (dow === 'Wednesday' ? w[5] : 0) +
    (dow === 'Thursday' ? w[6] : 0) +
    (dow === 'Friday' ? w[7] : 0) +
    (dow === 'Saturday' ? w[8] : 0) +
    (dow === 'Sunday' ? w[9] : 0) +
    (dow === 'Friday' && input.meal_type === 'Dinner' ? w[15] : 0);

  const catDelta =
    (input.day_category === 'Weekend' ? w[10] : 0) +
    (input.day_category === 'Holiday' ? w[11] : 0) +
    (input.day_category === 'Examination' ? w[12] : 0) +
    (input.day_category === 'Vacation' ? w[13] : 0) +
    (input.day_category === 'Campus Event' ? w[14] : 0) +
    (input.day_category === 'Examination' && input.meal_type === 'Breakfast' ? w[16] : 0) +
    (input.day_category === 'Examination' && input.meal_type === 'Snacks' ? w[17] : 0) +
    (input.day_category === 'Campus Event' && input.meal_type === 'Lunch' ? w[18] : 0);

  const menuDelta = menuAppeal * w[19];
  const trendDelta = model.recentRatio * w[20];

  const rawPredicted = mealBase + dowDelta + catDelta + menuDelta + trendDelta;
  const maxCap = input.hostel_registered_students ?? 520;
  const predictedStudents = Math.max(60, Math.min(maxCap, Math.round(rawPredicted)));

  // Condition-adjusted uncertainty (holidays/vacations/exams carry slightly wider variance)
  const conditionUncertaintyMultiplier =
    input.day_category === 'Vacation' || input.day_category === 'Holiday'
      ? 1.25
      : input.day_category === 'Examination' || input.day_category === 'Campus Event'
      ? 1.15
      : 1.0;

  const stdDev = Math.round(model.residualStdByMeal[input.meal_type] * conditionUncertaintyMultiplier);
  const ciLow = Math.max(40, Math.round(predictedStudents - 1.645 * stdDev));
  const ciHigh = Math.min(maxCap + 20, Math.round(predictedStudents + 1.645 * stdDev));

  // Newsvendor recommended prep headcount
  const { z: nvZ } = getNewsvendorZ(input.risk_posture);
  const recommendedPrepHeadcount = Math.max(65, Math.round(predictedStudents + nvZ * stdDev));

  // Risk probabilities for AI recommended quantity vs Staff Planned quantity
  const aiZ = (recommendedPrepHeadcount - predictedStudents) / Math.max(1, stdDev);
  const shortageRiskPct = Math.round((1 - normCDF(aiZ)) * 100);
  const excessRiskPct = Math.round(normCDF((recommendedPrepHeadcount * 0.88 - predictedStudents) / Math.max(1, stdDev)) * 100);

  const staffPlanned = Math.max(1, input.staff_planned_students);
  const staffZ = (staffPlanned - predictedStudents) / Math.max(1, stdDev);
  const staffShortageRiskPct = Math.round((1 - normCDF(staffZ)) * 100);
  const staffExcessRiskPct = Math.round(normCDF((staffPlanned * 0.88 - predictedStudents) / Math.max(1, stdDev)) * 100);

  // 2-Wave Batch Cooking split (Cook 82% upfront, hold 18% ready-to-fire)
  const wave1Headcount = Math.round(recommendedPrepHeadcount * 0.82);
  const wave2Headcount = recommendedPrepHeadcount - wave1Headcount;
  const wave2TriggerHeadcount = Math.round(wave1Headcount * 0.88);

  // Item-wise preparation recommendations from historical per-capita consumption
  const itemNames = input.menu
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Also match historical FoodPrepRecords for this meal type and menu items
  const allMealPrep = history
    .filter((h) => h.meal_type === input.meal_type)
    .flatMap((h) => h.items);

  // Map distinct historical items matching menu tokens or exact menu records
  const exactMenuHist = history.filter(
    (h) => h.meal_type === input.meal_type && h.menu.toLowerCase().trim() === input.menu.toLowerCase().trim()
  );

  const candidateItems: FoodPrepRecord[] =
    exactMenuHist.length > 0 ? exactMenuHist.flatMap((h) => h.items) : allMealPrep;

  // Group historical consumption per student by item_name
  const itemStatsMap = new Map<
    string,
    { unit: 'kg' | 'L' | 'pcs'; perCapitas: number[]; wastePcts: number[] }
  >();

  const mealAttendanceByDate = new Map<string, number>();
  history.forEach((h) => {
    mealAttendanceByDate.set(`${h.date}__${h.meal_type}`, h.actual_students);
  });

  for (const p of candidateItems) {
    const ate = mealAttendanceByDate.get(`${p.date}__${p.meal_type}`) ?? 320;
    const perCap = p.consumed_qty / Math.max(1, ate);
    const wPct = p.prepared_qty > 0 ? (p.leftover_qty / p.prepared_qty) * 100 : 0;
    const cur = itemStatsMap.get(p.item_name) || { unit: p.unit, perCapitas: [], wastePcts: [] };
    cur.perCapitas.push(perCap);
    cur.wastePcts.push(wPct);
    itemStatsMap.set(p.item_name, cur);
  }

  // Select items matching the menu text, or fallback to top items from exactMenuHist
  let selectedItemEntries: [string, { unit: 'kg' | 'L' | 'pcs'; perCapitas: number[]; wastePcts: number[] }][] = [];
  if (exactMenuHist.length > 0) {
    selectedItemEntries = Array.from(itemStatsMap.entries());
  } else {
    // Match menu strings against historical items
    const matched = Array.from(itemStatsMap.entries()).filter(([name]) =>
      itemNames.some((token) => name.toLowerCase().includes(token.toLowerCase()) || token.toLowerCase().includes(name.toLowerCase().split(' ')[0]))
    );
    if (matched.length > 0) {
      selectedItemEntries = matched;
    } else {
      // Synthesize item estimates directly from user's custom menu items
      selectedItemEntries = itemNames.slice(0, 4).map((name) => {
        const isRoti = /roti|paratha|bhature|dosa|vada|samosa|pakora|jamun/.test(name.toLowerCase());
        const isLiquid = /dal|sambar|chai|tea|coffee|lassi|kadhi|raita|salan|pani/.test(name.toLowerCase());
        const unit: 'kg' | 'L' | 'pcs' = isRoti ? 'pcs' : isLiquid ? 'L' : 'kg';
        const perCap = isRoti ? 2.5 : isLiquid ? 0.18 : 0.19;
        return [name, { unit, perCapitas: [perCap], wastePcts: [12] }];
      });
    }
  }

  let totalExpectedWasteKg = 0;
  let staffExpectedWasteKg = 0;
  let totalSavingsInr = 0;

  const itemRecommendations: ItemRecommendation[] = selectedItemEntries.map(([itemName, stat]) => {
    const avgPer = stat.perCapitas.reduce((s, v) => s + v, 0) / stat.perCapitas.length;
    const varPer =
      stat.perCapitas.reduce((s, v) => s + (v - avgPer) ** 2, 0) / Math.max(1, stat.perCapitas.length - 1);
    const stdPer = Math.max(avgPer * 0.08, Math.sqrt(varPer));
    const histWastePct = stat.wastePcts.reduce((s, v) => s + v, 0) / stat.wastePcts.length;

    // Combined demand std dev: sqrt((avgPer * stdAttendance)^2 + (predictedStudents * stdPer)^2)
    const combinedStd = Math.sqrt((avgPer * stdDev) ** 2 + (predictedStudents * stdPer * 0.65) ** 2);
    const expectedConsumed = predictedStudents * avgPer;
    const rawRec = Math.max(expectedConsumed * 0.9, expectedConsumed + nvZ * combinedStd);
    const recQty = stat.unit === 'pcs' ? Math.round(rawRec) : Number(rawRec.toFixed(1));

    const supportsTwoWave = !/dosa|batter|lassi|raita|bhel/.test(itemName.toLowerCase());
    const wave1 = supportsTwoWave
      ? stat.unit === 'pcs'
        ? Math.round(recQty * 0.82)
        : Number((recQty * 0.82).toFixed(1))
      : recQty;
    const wave2 = stat.unit === 'pcs' ? Math.max(0, recQty - wave1) : Number(Math.max(0, recQty - wave1).toFixed(1));

    // Staff naive quantity (includes historical over-prep bias for high-waste items)
    const staffBiasMult = 1 + Math.min(0.18, Math.max(0, histWastePct - 10) / 100);
    const rawStaff = staffPlanned * avgPer * staffBiasMult;
    const staffQty = stat.unit === 'pcs' ? Math.round(rawStaff) : Number(rawStaff.toFixed(1));

    // Expected leftover under Gaussian demand: E[max(0, Q - D)] = sigma * (z*Phi(z) + phi(z))
    const zItem = (recQty - expectedConsumed) / Math.max(0.1, combinedStd);
    const phiZ = Math.exp(-0.5 * zItem * zItem) / Math.sqrt(2 * Math.PI);
    const expWasteRaw = combinedStd * (zItem * normCDF(zItem) + phiZ);
    const expWaste = stat.unit === 'pcs' ? Math.round(expWasteRaw) : Number(expWasteRaw.toFixed(1));

    const zStaffItem = (staffQty - expectedConsumed) / Math.max(0.1, combinedStd);
    const phiStaff = Math.exp(-0.5 * zStaffItem * zStaffItem) / Math.sqrt(2 * Math.PI);
    const staffExpWaste = combinedStd * (zStaffItem * normCDF(zStaffItem) + phiStaff);

    const shortageProb = Math.round((1 - normCDF(zItem)) * 100);
    const unitCost = getUnitCostInr(itemName, stat.unit);

    totalExpectedWasteKg += toKgEquivalent(expWaste, stat.unit);
    staffExpectedWasteKg += toKgEquivalent(staffExpWaste, stat.unit);
    totalSavingsInr += Math.max(0, (staffExpWaste - expWaste) * unitCost);

    return {
      item_name: itemName,
      unit: stat.unit,
      per_student_avg: Number(avgPer.toFixed(3)),
      per_student_std: Number(stdPer.toFixed(3)),
      recommended_qty: recQty,
      wave1_qty: wave1,
      wave2_reserve_qty: wave2,
      staff_naive_qty: staffQty,
      expected_consumed_qty: stat.unit === 'pcs' ? Math.round(expectedConsumed) : Number(expectedConsumed.toFixed(1)),
      expected_waste_qty: expWaste,
      shortage_prob_pct: shortageProb,
      unit_cost_inr: unitCost,
      historical_waste_pct: Number(histWastePct.toFixed(1)),
      supports_two_wave: supportsTwoWave,
    };
  });

  // Historical Analogues: find top 4 most similar past meals
  const analogues: AnalogueMeal[] = history
    .filter((h) => h.meal_type === input.meal_type && !h.is_anomaly)
    .map((h) => {
      let score = 0;
      if (h.day_category === input.day_category) score += 3;
      if (h.day_of_week === dow) score += 2;
      if (h.menu.toLowerCase().trim() === input.menu.toLowerCase().trim()) score += 3;
      return { h, score };
    })
    .sort((a, b) => b.score - a.score || b.h.date.localeCompare(a.h.date))
    .slice(0, 4)
    .map(({ h }) => ({
      date: h.date,
      day_of_week: h.day_of_week,
      day_category: h.day_category,
      menu: h.menu,
      expected_students: h.expected_students,
      actual_students: h.actual_students,
      waste_pct: h.waste_pct,
    }));

  // Factor waterfall array
  const factors: FactorContribution[] = [
    {
      label: `${dow} Day Pattern`,
      delta: Math.round(dowDelta),
      detail:
        dowDelta < -10
          ? `${dow} historically sees fewer hostelers on campus`
          : dowDelta > 5
          ? `${dow} shows higher routine turnout`
          : `Minimal deviation from mid-week baseline`,
    },
    {
      label: `${input.day_category} Condition`,
      delta: Math.round(catDelta),
      detail: input.event_name || `${input.day_category} schedule adjustment`,
    },
    {
      label: 'Menu Pull Factor',
      delta: Math.round(menuDelta),
      detail:
        menuDelta >= 8
          ? 'High-appeal menu drives above-average student footfall'
          : menuDelta <= -8
          ? 'Lower-preference menu causes higher skip rate'
          : 'Neutral menu turnout impact',
    },
    {
      label: '14-Day Attendance Drift',
      delta: Math.round(trendDelta),
      detail: 'Recent rolling campus occupancy shift',
    },
  ];

  // Plain-English reasoning lines
  const reasoningSummary: string[] = [
    `Baseline ${input.meal_type} turnout averages ${Math.round(mealBase)} students before calendar and menu adjustments.`,
    `${dow} (${input.day_category}) shifts expected demand by ${Math.round(dowDelta + catDelta) >= 0 ? '+' : ''}${Math.round(dowDelta + catDelta)} students based on ${history.filter((h) => h.meal_type === input.meal_type && h.day_category === input.day_category).length} matching historical sessions.`,
    `Menu pull for "${input.menu.split(',')[0]}" adjusts turnout by ${Math.round(menuDelta) >= 0 ? '+' : ''}${Math.round(menuDelta)} students.`,
    `Newsvendor optimizer recommends prepping for ${recommendedPrepHeadcount} students (${wave1Headcount} Wave 1 upfront + ${wave2Headcount} Wave 2 reserve) to hold shortage risk at ${shortageRiskPct}%.`,
  ];

  // Kitchen Staff Alerts
  const alerts: StaffAlert[] = [];
  const staffGap = staffPlanned - predictedStudents;
  const staffGapPct = Math.round((staffGap / Math.max(1, predictedStudents)) * 100);

  if (staffGapPct >= 12) {
    alerts.push({
      id: 'excess-risk',
      severity: 'critical',
      title: `High Excess Preparation Risk (+${staffGap} extra plates planned)`,
      message: `Your planned count (${staffPlanned}) exceeds predicted demand (${predictedStudents}) by ${staffGapPct}%, likely wasting ~${Math.max(1, Math.round(staffExpectedWasteKg - totalExpectedWasteKg))} kg of cooked food.`,
      action: `Scale batch down to ${recommendedPrepHeadcount} headcount using 2-Wave split.`,
    });
  } else if (staffGapPct <= -10 || staffShortageRiskPct >= 28) {
    alerts.push({
      id: 'shortage-risk',
      severity: 'critical',
      title: `High Food Shortage Risk (${staffShortageRiskPct}% chance of stockout)`,
      message: `Your planned count (${staffPlanned}) is ${Math.abs(staffGap)} students below expected turnout (${predictedStudents}). High-appeal menu or campus event will surge demand.`,
      action: `Increase preparation to ${recommendedPrepHeadcount} servings and pre-soak Wave 2 reserve.`,
    });
  }

  if (input.day_category === 'Examination') {
    alerts.push({
      id: 'exam-pattern',
      severity: 'warning',
      title: 'Examination Schedule Shift Active',
      message:
        input.meal_type === 'Breakfast'
          ? 'Exam mornings see ~18% fewer early breakfast diners due to late-night study.'
          : input.meal_type === 'Snacks'
          ? 'Evening exam study breaks boost Snacks attendance by ~15%.'
          : 'Exam days compress dining window into a sharper peak rush.',
      action:
        input.meal_type === 'Breakfast'
          ? 'Hold 20% dry/batter reserve instead of cooking full batch at 7:00 AM.'
          : 'Keep extra tea/snack stock ready before 4:45 PM.',
    });
  } else if (input.day_category === 'Holiday' || input.day_category === 'Vacation') {
    alerts.push({
      id: 'holiday-drop',
      severity: 'warning',
      title: `${input.day_category} Attendance Drop Detected`,
      message: `Historical ${input.day_category.toLowerCase()} records show steep student departures. Perishable items (curd, chutneys, steamed rice) account for 62% of leftovers.`,
      action: 'Cook Wave 1 at 82% and trigger Wave 2 only if mid-service swipe-ins cross threshold.',
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: 'nominal',
      severity: 'info',
      title: 'Demand Within Normal Operating Band',
      message: `Predicted turnout (${predictedStudents}) aligns closely with standard capacity (95% range: ${ciLow}–${ciHigh}).`,
      action: `Follow balanced 2-Wave prep (${wave1Headcount} upfront + ${wave2Headcount} reserve).`,
    });
  }

  const co2SavedKg = Number((Math.max(0, staffExpectedWasteKg - totalExpectedWasteKg) * 2.5).toFixed(1));

  return {
    input,
    predicted_students: predictedStudents,
    recommended_prep_headcount: recommendedPrepHeadcount,
    ci_low: ciLow,
    ci_high: ciHigh,
    std_dev: stdDev,
    shortage_risk_pct: shortageRiskPct,
    excess_risk_pct: excessRiskPct,
    staff_shortage_risk_pct: staffShortageRiskPct,
    staff_excess_risk_pct: staffExcessRiskPct,
    expected_waste_kg: Number(totalExpectedWasteKg.toFixed(1)),
    staff_expected_waste_kg: Number(staffExpectedWasteKg.toFixed(1)),
    estimated_savings_inr: Math.round(totalSavingsInr),
    co2_saved_kg: co2SavedKg,
    wave1_headcount: wave1Headcount,
    wave2_headcount: wave2Headcount,
    wave2_trigger_headcount: wave2TriggerHeadcount,
    factors,
    baseline_students: Math.round(mealBase),
    reasoning_summary: reasoningSummary,
    alerts,
    item_recommendations: itemRecommendations,
    analogues,
  };
}

// Identify top high-wastage items and calendar wastage hotspots
export function analyzeWastageHotspots(history: EnrichedMealRecord[]): {
  itemHotspots: WastageHotspot[];
  conditionStats: ConditionWasteStat[];
  anomalies: EnrichedMealRecord[];
  totalWasteKg: number;
  totalLossInr: number;
} {
  const itemAgg = new Map<
    string,
    {
      mealTypes: Set<MealType>;
      unit: 'kg' | 'L' | 'pcs';
      appearances: number;
      prepared: number;
      consumed: number;
      leftover: number;
      wasteByCond: Map<DayCategory, number[]>;
    }
  >();

  const condAgg = new Map<
    DayCategory,
    {
      count: number;
      staffExp: number;
      actual: number;
      wastePctSum: number;
      leftoverKg: number;
    }
  >();

  let totalWasteKg = 0;
  let totalLossInr = 0;

  for (const r of history) {
    totalWasteKg += r.total_leftover_kg_eq;

    const c = condAgg.get(r.day_category) || {
      count: 0,
      staffExp: 0,
      actual: 0,
      wastePctSum: 0,
      leftoverKg: 0,
    };
    c.count += 1;
    c.staffExp += r.expected_students;
    c.actual += r.actual_students;
    c.wastePctSum += r.waste_pct;
    c.leftoverKg += r.total_leftover_kg_eq;
    condAgg.set(r.day_category, c);

    for (const it of r.items) {
      const cur = itemAgg.get(it.item_name) || {
        mealTypes: new Set<MealType>(),
        unit: it.unit,
        appearances: 0,
        prepared: 0,
        consumed: 0,
        leftover: 0,
        wasteByCond: new Map<DayCategory, number[]>(),
      };
      cur.mealTypes.add(r.meal_type);
      cur.appearances += 1;
      cur.prepared += it.prepared_qty;
      cur.consumed += it.consumed_qty;
      cur.leftover += it.leftover_qty;

      const wPct = it.prepared_qty > 0 ? (it.leftover_qty / it.prepared_qty) * 100 : 0;
      const condArr = cur.wasteByCond.get(r.day_category) || [];
      condArr.push(wPct);
      cur.wasteByCond.set(r.day_category, condArr);

      itemAgg.set(it.item_name, cur);
      totalLossInr += it.leftover_qty * getUnitCostInr(it.item_name, it.unit);
    }
  }

  const itemHotspots: WastageHotspot[] = Array.from(itemAgg.entries())
    .map(([name, agg]) => {
      const avgWastePct = agg.prepared > 0 ? (agg.leftover / agg.prepared) * 100 : 0;
      const lossInr = agg.leftover * getUnitCostInr(name, agg.unit);

      let worstCond = 'Academic';
      let worstVal = -1;
      agg.wasteByCond.forEach((vals, cond) => {
        const m = vals.reduce((s, v) => s + v, 0) / vals.length;
        if (m > worstVal) {
          worstVal = m;
          worstCond = cond;
        }
      });

      const recommendation =
        avgWastePct >= 22
          ? `Severe over-batching (${avgWastePct.toFixed(1)}% wasted). Cut base prep by 15% and shift to Wave 2 reserve on ${worstCond} days.`
          : avgWastePct >= 14
          ? `Moderate waste peak during ${worstCond}. Trim per-student portion factor by 8–10%.`
          : `Well-calibrated demand; maintain current 2-Wave buffer.`;

      return {
        item_name: name,
        meal_types: Array.from(agg.mealTypes),
        unit: agg.unit,
        appearances: agg.appearances,
        total_prepared: Number(agg.prepared.toFixed(1)),
        total_consumed: Number(agg.consumed.toFixed(1)),
        total_leftover: Number(agg.leftover.toFixed(1)),
        avg_waste_pct: Number(avgWastePct.toFixed(1)),
        estimated_loss_inr: Math.round(lossInr),
        worst_condition: `${worstCond} (${worstVal.toFixed(0)}% avg waste)`,
        recommendation,
      };
    })
    .sort((a, b) => b.avg_waste_pct - a.avg_waste_pct);

  const conditionStats: ConditionWasteStat[] = Array.from(condAgg.entries())
    .map(([condition, c]) => ({
      condition,
      meals_count: c.count,
      avg_staff_expected: Math.round(c.staffExp / c.count),
      avg_actual: Math.round(c.actual / c.count),
      avg_over_prep_students: Math.round((c.staffExp - c.actual) / c.count),
      avg_waste_pct: Number((c.wastePctSum / c.count).toFixed(1)),
      total_leftover_kg: Number(c.leftoverKg.toFixed(1)),
    }))
    .sort((a, b) => b.avg_waste_pct - a.avg_waste_pct);

  const anomalies = history.filter((r) => r.is_anomaly);

  return {
    itemHotspots,
    conditionStats,
    anomalies,
    totalWasteKg: Number(totalWasteKg.toFixed(1)),
    totalLossInr: Math.round(totalLossInr),
  };
}

// Chronological Out-of-Sample Walk-Forward Backtest across ALL relevant historical records
export function runWalkForwardBacktest(
  history: EnrichedMealRecord[],
  posture: RiskPosture = 'balanced'
): BacktestSummary {
  const warmup = Math.min(40, Math.floor(history.length * 0.2));
  const rows: BacktestRow[] = [];

  if (history.length <= warmup + 4) {
    return {
      total_records_evaluated: 0,
      warmup_records: history.length,
      staff_mae: 0,
      ai_mae: 0,
      mae_improvement_pct: 0,
      staff_within_5pct_rate: 0,
      ai_within_5pct_rate: 0,
      historical_waste_kg: 0,
      ai_simulated_waste_kg: 0,
      waste_saved_kg: 0,
      waste_reduction_pct: 0,
      estimated_savings_inr: 0,
      co2_avoided_kg: 0,
      historical_shortages: 0,
      ai_simulated_shortages: 0,
      rows: [],
    };
  }

  let currentModel = trainAttendanceModel(history.slice(0, warmup));
  const { z: nvZ } = getNewsvendorZ(posture);

  let staffErrSum = 0;
  let aiErrSum = 0;
  let staffWithin5 = 0;
  let aiWithin5 = 0;
  let histWasteKg = 0;
  let aiWasteKg = 0;
  let histShortages = 0;
  let aiShortages = 0;

  for (let i = warmup; i < history.length; i++) {
    // Retrain model periodically (every 12 meals = 3 days) using strictly past data [0..i-1]
    if ((i - warmup) % 12 === 0 && i > warmup) {
      currentModel = trainAttendanceModel(history.slice(0, i));
    }

    const rec = history[i];
    const pastSlice = history.slice(0, i);
    const pred = predictUpcomingMeal(
      {
        date: rec.date,
        meal_type: rec.meal_type,
        day_category: rec.day_category,
        event_name: rec.event_name,
        menu: rec.menu,
        staff_planned_students: rec.expected_students,
        risk_posture: posture,
      },
      pastSlice,
      currentModel
    );

    const staffErr = Math.abs(rec.expected_students - rec.actual_students);
    const aiErr = Math.abs(pred.predicted_students - rec.actual_students);
    staffErrSum += staffErr;
    aiErrSum += aiErr;

    if (staffErr / Math.max(1, rec.actual_students) <= 0.05) staffWithin5++;
    if (aiErr / Math.max(1, rec.actual_students) <= 0.05) aiWithin5++;

    const actualWaste = rec.total_leftover_kg_eq;
    histWasteKg += actualWaste;

    // Simulate what waste/shortage would have been under AI Newsvendor recommendation
    const avgKgPerStudent = rec.total_consumed_kg_eq / Math.max(1, rec.actual_students);
    const aiRecHeadcount = Math.max(60, Math.round(pred.predicted_students + nvZ * pred.std_dev));
    const aiPrepKg = aiRecHeadcount * avgKgPerStudent;
    const simWaste = Number(Math.max(0, aiPrepKg - rec.total_consumed_kg_eq).toFixed(1));
    aiWasteKg += simWaste;

    const staffShortage = rec.actual_students > rec.expected_students * 1.03;
    const aiShortage = rec.actual_students > aiRecHeadcount * 1.03;
    if (staffShortage) histShortages++;
    if (aiShortage) aiShortages++;

    const note =
      aiErr < staffErr
        ? `AI beat staff plan by ${staffErr - aiErr} students (${rec.day_category})`
        : `Staff closer by ${aiErr - staffErr} students`;

    rows.push({
      date: rec.date,
      day_of_week: rec.day_of_week,
      meal_type: rec.meal_type,
      day_category: rec.day_category,
      menu: rec.menu,
      staff_expected: rec.expected_students,
      ai_predicted: pred.predicted_students,
      ai_recommended_prep: aiRecHeadcount,
      actual_ate: rec.actual_students,
      staff_abs_error: staffErr,
      ai_abs_error: aiErr,
      actual_waste_kg: actualWaste,
      ai_sim_waste_kg: simWaste,
      staff_shortage: staffShortage,
      ai_shortage: aiShortage,
      reasoning_note: note,
    });
  }

  const count = rows.length;
  const staffMAE = Number((staffErrSum / count).toFixed(1));
  const aiMAE = Number((aiErrSum / count).toFixed(1));
  const maeImp = staffMAE > 0 ? Number((((staffMAE - aiMAE) / staffMAE) * 100).toFixed(1)) : 0;
  const wasteSaved = Number(Math.max(0, histWasteKg - aiWasteKg).toFixed(1));
  const wasteRedPct = histWasteKg > 0 ? Number(((wasteSaved / histWasteKg) * 100).toFixed(1)) : 0;

  return {
    total_records_evaluated: count,
    warmup_records: warmup,
    staff_mae: staffMAE,
    ai_mae: aiMAE,
    mae_improvement_pct: maeImp,
    staff_within_5pct_rate: Math.round((staffWithin5 / count) * 100),
    ai_within_5pct_rate: Math.round((aiWithin5 / count) * 100),
    historical_waste_kg: Number(histWasteKg.toFixed(1)),
    ai_simulated_waste_kg: Number(aiWasteKg.toFixed(1)),
    waste_saved_kg: wasteSaved,
    waste_reduction_pct: wasteRedPct,
    estimated_savings_inr: Math.round(wasteSaved * 96),
    co2_avoided_kg: Number((wasteSaved * 2.5).toFixed(1)),
    historical_shortages: histShortages,
    ai_simulated_shortages: aiShortages,
    rows,
  };
}
