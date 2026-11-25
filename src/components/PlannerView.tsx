import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Download,
  Flame,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import { MENU_TEMPLATES } from '../data/syntheticGenerator';
import {
  getDayOfWeek,
  predictUpcomingMeal,
  TrainedModel,
} from '../engine/predictor';
import {
  CalendarRecord,
  DayCategory,
  EnrichedMealRecord,
  MealType,
  PredictionInput,
  RiskPosture,
} from '../types/mess';

interface PlannerViewProps {
  history: EnrichedMealRecord[];
  calendar: CalendarRecord[];
  model: TrainedModel;
}

const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];
const DAY_CATEGORIES: DayCategory[] = [
  'Academic',
  'Weekend',
  'Examination',
  'Holiday',
  'Vacation',
  'Campus Event',
];

const POSTURE_OPTIONS: { id: RiskPosture; label: string; desc: string }[] = [
  { id: 'eco', label: 'Eco-Minimal Waste', desc: '58% fractile · Cuts leftovers' },
  { id: 'balanced', label: 'Balanced Newsvendor', desc: '72% fractile · Optimal cost' },
  { id: 'zero_shortage', label: 'Zero-Shortage Guard', desc: '92% fractile · Peak buffer' },
];

export const PlannerView: React.FC<PlannerViewProps> = ({ history, calendar, model }) => {
  // Default to the day after the last historical date
  const defaultNextDate = useMemo(() => {
    if (history.length === 0) return '2026-11-25';
    const last = history[history.length - 1].date;
    const d = new Date(`${last}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, [history]);

  const [date, setDate] = useState<string>(defaultNextDate);
  const [mealType, setMealType] = useState<MealType>('Lunch');
  const [dayCategory, setDayCategory] = useState<DayCategory>('Academic');
  const [eventName, setEventName] = useState<string>('Regular Classes');
  const [menu, setMenu] = useState<string>(MENU_TEMPLATES.Lunch[0].name);
  const [staffPlanned, setStaffPlanned] = useState<number>(435);
  const [riskPosture, setRiskPosture] = useState<RiskPosture>('balanced');

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    const calMatch = calendar.find((c) => c.date === newDate);
    if (calMatch) {
      setDayCategory(calMatch.day_category);
      setEventName(calMatch.event_name);
    } else {
      const dow = getDayOfWeek(newDate);
      const isWknd = dow === 'Saturday' || dow === 'Sunday';
      setDayCategory(isWknd ? 'Weekend' : 'Academic');
      setEventName(isWknd ? `${dow} Weekend` : 'Regular Classes');
    }
  };

  const handleMealTypeChange = (mt: MealType) => {
    setMealType(mt);
    setMenu(MENU_TEMPLATES[mt][0].name);
    const defaultStaff: Record<MealType, number> = {
      Breakfast: 355,
      Lunch: 435,
      Snacks: 325,
      Dinner: 410,
    };
    setStaffPlanned(defaultStaff[mt]);
  };

  const applyQuickScenario = (scenario: 'exam_bf' | 'wknd_dinner' | 'fest_biryani' | 'holiday_khichdi') => {
    if (scenario === 'exam_bf') {
      setDate('2026-11-26');
      setMealType('Breakfast');
      setDayCategory('Examination');
      setEventName('End-Semester Examinations');
      setMenu(MENU_TEMPLATES.Breakfast[3].name); // Rava Upma
      setStaffPlanned(355);
    } else if (scenario === 'wknd_dinner') {
      setDate('2026-11-28');
      setMealType('Dinner');
      setDayCategory('Weekend');
      setEventName('Saturday Weekend');
      setMenu(MENU_TEMPLATES.Dinner[1].name); // Dal Tadka, Lauki
      setStaffPlanned(390);
    } else if (scenario === 'fest_biryani') {
      setDate('2026-11-27');
      setMealType('Lunch');
      setDayCategory('Campus Event');
      setEventName('Annual Tech & Cultural Fest');
      setMenu(MENU_TEMPLATES.Lunch[1].name); // Veg Biryani
      setStaffPlanned(410);
    } else {
      setDate('2026-11-30');
      setMealType('Dinner');
      setDayCategory('Holiday');
      setEventName('Public Holiday');
      setMenu(MENU_TEMPLATES.Dinner[3].name); // Khichdi
      setStaffPlanned(380);
    }
  };

  const prediction = useMemo(() => {
    const input: PredictionInput = {
      date,
      meal_type: mealType,
      day_category: dayCategory,
      event_name: eventName,
      menu,
      staff_planned_students: staffPlanned,
      risk_posture: riskPosture,
    };
    return predictUpcomingMeal(input, history, model);
  }, [date, mealType, dayCategory, eventName, menu, staffPlanned, riskPosture, history, model]);

  // 7-day rolling forecast starting from selected date
  const sevenDayForecast = useMemo(() => {
    const baseDate = new Date(`${date}T00:00:00`);
    if (isNaN(baseDate.getTime())) return [];
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const cal = calendar.find((c) => c.date === iso);
      const dow = getDayOfWeek(iso);
      const isWknd = dow === 'Saturday' || dow === 'Sunday';
      const cat: DayCategory = cal?.day_category ?? (isWknd ? 'Weekend' : 'Academic');
      const tpl = MENU_TEMPLATES[mealType][i % MENU_TEMPLATES[mealType].length];
      const res = predictUpcomingMeal(
        {
          date: iso,
          meal_type: mealType,
          day_category: cat,
          event_name: cal?.event_name ?? cat,
          menu: tpl.name,
          staff_planned_students: staffPlanned,
          risk_posture: riskPosture,
        },
        history,
        model
      );
      out.push({
        date: iso,
        dow: dow.slice(0, 3),
        category: cat,
        dish: tpl.name.split(',')[0],
        predicted: res.predicted_students,
        recommended: res.recommended_prep_headcount,
        wasteKg: res.expected_waste_kg,
      });
    }
    return out;
  }, [date, mealType, calendar, staffPlanned, riskPosture, history, model]);

  const exportPrepSheetCSV = () => {
    const headers = 'date,meal_type,day_category,item_name,unit,recommended_qty,wave1_upfront,wave2_reserve,staff_naive_qty,expected_waste_qty,shortage_prob_pct';
    const lines = prediction.item_recommendations.map((it) =>
      [
        prediction.input.date,
        prediction.input.meal_type,
        prediction.input.day_category,
        `"${it.item_name}"`,
        it.unit,
        it.recommended_qty,
        it.wave1_qty,
        it.wave2_reserve_qty,
        it.staff_naive_qty,
        it.expected_waste_qty,
        it.shortage_prob_pct,
      ].join(',')
    );
    const blob = new Blob([[headers, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kitchen_prep_${prediction.input.date}_${prediction.input.meal_type.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dow = getDayOfWeek(date);
  const headcountDiff = prediction.recommended_prep_headcount - staffPlanned;
  const maxFactorAbs = Math.max(
    15,
    ...prediction.factors.map((f) => Math.abs(f.delta))
  );

  return (
    <div className="space-y-6">
      {/* Page Title & Quick Scenario Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Upcoming Demand Forecast · Newsvendor Batch Optimizer
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Meal Preparation Planner
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 mr-1">Test scenario:</span>
          <button
            type="button"
            onClick={() => applyQuickScenario('exam_bf')}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Exam Breakfast
          </button>
          <button
            type="button"
            onClick={() => applyQuickScenario('wknd_dinner')}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Weekend Dinner
          </button>
          <button
            type="button"
            onClick={() => applyQuickScenario('fest_biryani')}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Fest Biryani Surge
          </button>
          <button
            type="button"
            onClick={() => applyQuickScenario('holiday_khichdi')}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Holiday Low-Appeal
          </button>
        </div>
      </div>

      {/* Main 2-Column Operational Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Configuration Column */}
        <aside className="lg:col-span-4 bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Upcoming Meal Inputs
            </h2>
            <SlidersHorizontal className="w-4 h-4 text-slate-400" aria-hidden="true" />
          </div>

          <div className="space-y-4">
            {/* Date */}
            <div>
              <label htmlFor="meal-date" className="block text-xs font-medium text-slate-700 mb-1.5">
                Target Date ({dow})
              </label>
              <div className="relative">
                <input
                  id="meal-date"
                  type="date"
                  value={date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Meal Type Segmented Control */}
            <div>
              <span className="block text-xs font-medium text-slate-700 mb-1.5">
                Meal Session
              </span>
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
                {MEAL_TYPES.map((mt) => (
                  <button
                    key={mt}
                    type="button"
                    onClick={() => handleMealTypeChange(mt)}
                    className={`py-1.5 text-xs font-medium rounded-md transition-all duration-150 whitespace-nowrap shrink-0 ${
                      mealType === mt
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mt}
                  </button>
                ))}
              </div>
            </div>

            {/* Calendar Condition */}
            <div>
              <label htmlFor="day-category" className="block text-xs font-medium text-slate-700 mb-1.5">
                Calendar Condition
              </label>
              <select
                id="day-category"
                value={dayCategory}
                onChange={(e) => setDayCategory(e.target.value as DayCategory)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white transition-colors"
              >
                {DAY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Event / Context Note */}
            <div>
              <label htmlFor="event-note" className="block text-xs font-medium text-slate-700 mb-1.5">
                Campus Event / Context
              </label>
              <input
                id="event-note"
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="e.g., Mid-Sem Exam Day 2"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white transition-colors"
              />
            </div>

            {/* Menu Preset & Custom Input */}
            <div>
              <label htmlFor="menu-preset" className="block text-xs font-medium text-slate-700 mb-1.5">
                Planned Menu Preset
              </label>
              <select
                id="menu-preset"
                value={MENU_TEMPLATES[mealType].some((t) => t.name === menu) ? menu : 'custom'}
                onChange={(e) => {
                  if (e.target.value !== 'custom') setMenu(e.target.value);
                }}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white mb-2 transition-colors"
              >
                {MENU_TEMPLATES[mealType].map((tpl) => (
                  <option key={tpl.name} value={tpl.name}>
                    {tpl.name}
                  </option>
                ))}
                <option value="custom">Custom Menu Items</option>
              </select>
              <input
                type="text"
                aria-label="Menu items comma separated"
                value={menu}
                onChange={(e) => setMenu(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white transition-colors"
              />
            </div>

            {/* Staff Planned Headcount */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="staff-planned" className="text-xs font-medium text-slate-700">
                  Staff Usual Expected Headcount
                </label>
                <span className="font-mono text-xs font-semibold tabular-nums text-slate-900">
                  {staffPlanned} students
                </span>
              </div>
              <input
                id="staff-planned"
                type="range"
                min={120}
                max={520}
                step={5}
                value={staffPlanned}
                onChange={(e) => setStaffPlanned(Number(e.target.value))}
                className="w-full accent-blue-700 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mt-1">
                <span>120</span>
                <span>320</span>
                <span>520</span>
              </div>
            </div>

            {/* Newsvendor Risk Posture */}
            <div>
              <span className="block text-xs font-medium text-slate-700 mb-1.5">
                Waste vs. Shortage Strategy
              </span>
              <div className="space-y-1.5">
                {POSTURE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRiskPosture(opt.id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition-all duration-150 ${
                      riskPosture === opt.id
                        ? 'bg-blue-50/70 border-blue-700 text-slate-900 shadow-[0_1px_2px_rgba(4,120,87,0.06)]'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-semibold">{opt.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Right Forecast & Action Column */}
        <div className="lg:col-span-8 space-y-6">
          {/* Dominant Focal Anchor: Attendance Forecast & Risk Comparison */}
          <section className="bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] rounded-xl p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-5">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  {date} · {dow} · {mealType} · {dayCategory}
                </p>
                <div className="flex items-baseline gap-3 mt-2">
                  <span className="font-display text-4xl sm:text-5xl font-bold tracking-tight tabular-nums text-slate-950">
                    {prediction.predicted_students}
                  </span>
                  <span className="text-sm font-medium text-slate-600">
                    predicted students
                  </span>
                </div>
                <p className="text-xs font-mono tabular-nums text-slate-500 mt-1.5">
                  90% Confidence Interval: {prediction.ci_low} – {prediction.ci_high} students (±{Math.round(prediction.std_dev * 1.645)})
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 md:text-right">
                <div className="px-4 py-3 bg-blue-50/70 border border-blue-200/90 rounded-lg">
                  <div className="text-xs font-medium text-blue-900">
                    AI Prep Target
                  </div>
                  <div className="font-display text-2xl font-bold tabular-nums text-blue-950 mt-0.5">
                    {prediction.recommended_prep_headcount}
                    <span className="text-xs font-normal text-blue-800 ml-1">servings</span>
                  </div>
                  <div className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums text-blue-800 mt-1">
                    {headcountDiff <= 0 ? (
                      <>
                        <ArrowDownRight className="w-3 h-3" aria-hidden="true" />
                        {Math.abs(headcountDiff)} fewer than staff plan
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                        +{headcountDiff} above staff plan
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Demand Calibration Range Bar */}
            <div className="py-4 border-y border-slate-100 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>Demand Range vs. Planned Capacity (0–520 students)</span>
                <div className="flex items-center gap-4 font-mono tabular-nums">
                  <span className="text-blue-800 font-medium">
                    AI Prep: {prediction.recommended_prep_headcount}
                  </span>
                  <span className="text-amber-700 font-medium">
                    Staff Plan: {staffPlanned}
                  </span>
                </div>
              </div>
              <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                {/* 90% Confidence Band */}
                <div
                  className="absolute top-0 bottom-0 bg-blue-200/80 rounded-full"
                  style={{
                    left: `${Math.max(0, (prediction.ci_low / 520) * 100)}%`,
                    width: `${Math.min(100, ((prediction.ci_high - prediction.ci_low) / 520) * 100)}%`,
                  }}
                />
                {/* Predicted Mean Marker */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-slate-900"
                  style={{ left: `${Math.min(99, (prediction.predicted_students / 520) * 100)}%` }}
                  title={`Predicted Mean: ${prediction.predicted_students}`}
                />
                {/* AI Recommended Prep Marker */}
                <div
                  className="absolute top-0 bottom-0 w-1.5 bg-blue-700"
                  style={{ left: `${Math.min(99, (prediction.recommended_prep_headcount / 520) * 100)}%` }}
                  title={`AI Recommended Prep: ${prediction.recommended_prep_headcount}`}
                />
                {/* Staff Planned Marker */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-amber-600"
                  style={{ left: `${Math.min(99, (staffPlanned / 520) * 100)}%` }}
                  title={`Staff Planned: ${staffPlanned}`}
                />
              </div>
            </div>

            {/* 4-Metric Risk & Impact Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5">
              <div>
                <div className="text-xs text-slate-500">Shortage Risk</div>
                <div className={`font-mono text-xl font-semibold tabular-nums mt-1 ${
                  prediction.shortage_risk_pct > 25 ? 'text-red-700' : 'text-slate-900'
                }`}>
                  {prediction.shortage_risk_pct}%
                </div>
                <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                  vs {prediction.staff_shortage_risk_pct}% staff plan
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Excess Prep Risk</div>
                <div className={`font-mono text-xl font-semibold tabular-nums mt-1 ${
                  prediction.excess_risk_pct > 30 ? 'text-amber-700' : 'text-slate-900'
                }`}>
                  {prediction.excess_risk_pct}%
                </div>
                <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                  vs {prediction.staff_excess_risk_pct}% staff plan
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Expected Leftover</div>
                <div className="font-mono text-xl font-semibold tabular-nums text-slate-900 mt-1">
                  {prediction.expected_waste_kg} kg
                </div>
                <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                  vs {prediction.staff_expected_waste_kg} kg staff plan
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500">Meal Savings</div>
                <div className="font-mono text-xl font-semibold tabular-nums text-blue-800 mt-1">
                  ₹{prediction.estimated_savings_inr.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                  {prediction.co2_saved_kg} kg CO₂e avoided
                </div>
              </div>
            </div>
          </section>

          {/* Kitchen Staff Alerts */}
          <section className="space-y-3" aria-label="Kitchen alerts">
            {prediction.alerts.map((alert) => {
              const styles =
                alert.severity === 'critical'
                  ? 'bg-red-50/70 border-red-200 text-red-950'
                  : alert.severity === 'warning'
                  ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                  : 'bg-blue-50/50 border-blue-200 text-blue-950';
              const Icon =
                alert.severity === 'critical'
                  ? AlertTriangle
                  : alert.severity === 'warning'
                  ? Flame
                  : CheckCircle2;
              const labelText =
                alert.severity === 'critical'
                  ? 'Action Required'
                  : alert.severity === 'warning'
                  ? 'Condition Alert'
                  : 'Nominal';

              return (
                <div
                  key={alert.id}
                  className={`border rounded-xl p-4 flex items-start gap-3 ${styles}`}
                >
                  <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span>{labelText}</span>
                      <span aria-hidden="true">·</span>
                      <span>{alert.title}</span>
                    </div>
                    <p className="text-xs opacity-90 mt-1 leading-relaxed">{alert.message}</p>
                    <p className="text-xs font-medium mt-1.5">
                      Recommended Action: {alert.action}
                    </p>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Two-Column: Factor Decomposition Reasoning + 2-Wave Batch Cooking Protocol */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Explainable Reasoning Waterfall */}
            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Prediction Reasoning Breakdown
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ridge regression factor contributions from {history.length} meal records
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                  <span className="font-medium text-slate-700">{mealType} Base Turnout</span>
                  <span className="font-mono font-semibold tabular-nums text-slate-900">
                    {prediction.baseline_students} students
                  </span>
                </div>

                {prediction.factors.map((f) => {
                  const pctWidth = Math.min(100, Math.round((Math.abs(f.delta) / maxFactorAbs) * 100));
                  const isPos = f.delta >= 0;
                  return (
                    <div key={f.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">{f.label}</span>
                        <span
                          className={`font-mono font-semibold tabular-nums ${
                            f.delta > 0
                              ? 'text-blue-700'
                              : f.delta < 0
                              ? 'text-amber-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {isPos ? `+${f.delta}` : f.delta}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            f.delta >= 0 ? 'bg-blue-600' : 'bg-amber-600'
                          }`}
                          style={{ width: `${Math.max(4, pctWidth)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">{f.detail}</p>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200 font-semibold">
                  <span className="text-slate-900">Final Predicted Attendance</span>
                  <span className="font-mono tabular-nums text-blue-800">
                    {prediction.predicted_students} students
                  </span>
                </div>
              </div>
            </section>

            {/* Innovative Feature: 2-Wave Batch Cooking Protocol & Plain-English Rationale */}
            <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    2-Wave Batch Cooking Protocol
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Eliminate end-of-service waste without risking late-comer shortages
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[11px] font-medium text-slate-500">Wave 1 · Cook Upfront</div>
                    <div className="font-mono text-xl font-bold tabular-nums text-slate-900 mt-1">
                      {prediction.wave1_headcount}
                      <span className="text-xs font-normal text-slate-500 ml-1">plates</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">82% of recommended</div>
                  </div>
                  <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg">
                    <div className="text-[11px] font-medium text-blue-900">Wave 2 · Dry Reserve</div>
                    <div className="font-mono text-xl font-bold tabular-nums text-blue-900 mt-1">
                      {prediction.wave2_headcount}
                      <span className="text-xs font-normal text-blue-700 ml-1">plates</span>
                    </div>
                    <div className="text-[11px] text-blue-800 mt-0.5">
                      Fire if &gt;{prediction.wave2_trigger_headcount} swipe-ins
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <Info className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    Why this recommendation?
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-600 leading-relaxed">
                    {prediction.reasoning_summary.map((line, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-mono text-[11px] text-slate-400 mt-0.5">{idx + 1}.</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          </div>

          {/* Item-Wise Preparation Table */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Item-Wise Preparation Schedule
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scaled from historical per-student consumption and item variance
                </p>
              </div>
              <button
                type="button"
                onClick={exportPrepSheetCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                Export Prep Sheet CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-600">
                    <th className="py-2.5 px-4">Food Item</th>
                    <th className="py-2.5 px-3 text-right">Per Student</th>
                    <th className="py-2.5 px-3 text-right">Staff Usual</th>
                    <th className="py-2.5 px-3 text-right">AI Target</th>
                    <th className="py-2.5 px-3 text-right">Wave 1 Cook</th>
                    <th className="py-2.5 px-3 text-right">Wave 2 Reserve</th>
                    <th className="py-2.5 px-3 text-right">Exp. Leftover</th>
                    <th className="py-2.5 px-4 text-right">Shortage Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {prediction.item_recommendations.map((item) => (
                    <tr key={item.item_name} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {item.item_name}
                        <span className="block text-[11px] font-normal text-slate-500">
                          Hist. waste {item.historical_waste_pct}% · ₹{item.unit_cost_inr}/{item.unit}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                        {item.per_student_avg} {item.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500">
                        {item.staff_naive_qty} {item.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums text-blue-800">
                        {item.recommended_qty} {item.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900">
                        {item.wave1_qty} {item.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                        {item.supports_two_wave ? `${item.wave2_reserve_qty} ${item.unit}` : 'Single batch'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                        {item.expected_waste_qty} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span
                          className={
                            item.shortage_prob_pct > 25
                              ? 'text-red-700 font-semibold'
                              : item.shortage_prob_pct > 15
                              ? 'text-amber-700'
                              : 'text-slate-700'
                          }
                        >
                          {item.shortage_prob_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Historical Analogues + 7-Day Rolling Forecast */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Closest Historical Analogue Meals
              </h2>
              <div className="divide-y divide-slate-100">
                {prediction.analogues.map((a) => (
                  <div key={`${a.date}-${a.menu}`} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 truncate">
                        {a.date} · {a.day_of_week} · {a.day_category}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{a.menu}</div>
                    </div>
                    <div className="text-right font-mono tabular-nums shrink-0">
                      <div className="font-semibold text-slate-900">{a.actual_students} ate</div>
                      <div className="text-[11px] text-slate-500">
                        plan {a.expected_students} · {a.waste_pct}% waste
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-slate-900">
                  7-Day {mealType} Outlook
                </h2>
                <Calendar className="w-4 h-4 text-slate-400" aria-hidden="true" />
              </div>
              <div className="divide-y divide-slate-100">
                {sevenDayForecast.map((f) => (
                  <div key={f.date} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="font-mono text-slate-500 mr-2">{f.date.slice(5)} ({f.dow})</span>
                      <span className="font-medium text-slate-800">{f.category}</span>
                      <span className="text-slate-400 mx-1">·</span>
                      <span className="text-slate-500 truncate">{f.dish}</span>
                    </div>
                    <div className="font-mono tabular-nums text-right shrink-0">
                      <span className="font-semibold text-slate-900">{f.predicted}</span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-blue-800">{f.recommended} prep</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
