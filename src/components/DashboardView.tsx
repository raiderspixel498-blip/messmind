import React, { useMemo } from 'react';
import {
  ArrowRight,
  Calendar,
  Flame,
  Layers,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  analyzeWastageHotspots,
  predictUpcomingMeal,
  runWalkForwardBacktest,
  TrainedModel,
} from '../engine/predictor';
import { MENU_TEMPLATES } from '../data/syntheticGenerator';
import { AppTab } from './TopBar';
import { CalendarRecord, EnrichedMealRecord, MealType } from '../types/mess';

interface DashboardViewProps {
  history: EnrichedMealRecord[];
  calendar: CalendarRecord[];
  model: TrainedModel;
  onNavigate: (tab: AppTab) => void;
}

const MEAL_ORDER: MealType[] = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];

export const DashboardView: React.FC<DashboardViewProps> = ({
  history,
  calendar,
  model,
  onNavigate,
}) => {
  const wastage = useMemo(() => analyzeWastageHotspots(history), [history]);
  const backtest = useMemo(() => runWalkForwardBacktest(history, 'balanced'), [history]);

  // Meal session summary stats
  const mealSessionStats = useMemo(() => {
    return MEAL_ORDER.map((mt) => {
      const rows = history.filter((h) => h.meal_type === mt);
      const count = Math.max(1, rows.length);
      const avgExpected = Math.round(rows.reduce((s, r) => s + r.expected_students, 0) / count);
      const avgActual = Math.round(rows.reduce((s, r) => s + r.actual_students, 0) / count);
      const avgWastePct = Number(
        (rows.reduce((s, r) => s + r.waste_pct, 0) / count).toFixed(1)
      );
      const totalLeftKg = Number(
        rows.reduce((s, r) => s + r.total_leftover_kg_eq, 0).toFixed(1)
      );
      return {
        mealType: mt,
        count: rows.length,
        avgExpected,
        avgActual,
        bias: avgExpected - avgActual,
        avgWastePct,
        totalLeftKg,
      };
    });
  }, [history]);

  // Daily aggregated attendance (last 21 days)
  const dailyTrend = useMemo(() => {
    const byDate = new Map<string, { expected: number; actual: number; wasteKg: number }>();
    for (const r of history) {
      const cur = byDate.get(r.date) || { expected: 0, actual: 0, wasteKg: 0 };
      cur.expected += r.expected_students;
      cur.actual += r.actual_students;
      cur.wasteKg += r.total_leftover_kg_eq;
      byDate.set(r.date, cur);
    }
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-21)
      .map(([date, val]) => ({ date, ...val }));
  }, [history]);

  // Next meal snapshot prediction
  const nextLunchSnapshot = useMemo(() => {
    const lastDate = history.length ? history[history.length - 1].date : '2026-11-24';
    const d = new Date(`${lastDate}T00:00:00`);
    d.setDate(d.getDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    const cal = calendar.find((c) => c.date === iso);
    return predictUpcomingMeal(
      {
        date: iso,
        meal_type: 'Lunch',
        day_category: cal?.day_category ?? 'Academic',
        event_name: cal?.event_name ?? 'Regular Classes',
        menu: MENU_TEMPLATES.Lunch[0].name,
        staff_planned_students: 435,
        risk_posture: 'balanced',
      },
      history,
      model
    );
  }, [history, calendar, model]);

  const maxDailyVal = Math.max(
    1800,
    ...dailyTrend.map((d) => Math.max(d.expected, d.actual))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Executive Operations Overview · {history.length} Meals Joined Across 3 CSV Sources
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 mt-1">
            Mess Demand & Waste Command Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('architecture')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Layers className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
            View Architecture
          </button>
          <button
            type="button"
            onClick={() => onNavigate('planner')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
          >
            Open Meal Planner
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 4-Column Executive KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] rounded-xl p-5">
          <div className="text-xs text-slate-500">AI Forecast Error (MAE)</div>
          <div className="font-display text-2xl sm:text-3xl font-bold tabular-nums text-blue-700 mt-1">
            ±{backtest.ai_mae}
            <span className="text-xs font-normal text-slate-500 ml-1.5">students</span>
          </div>
          <div className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums text-teal-700 mt-1.5">
            <TrendingDown className="w-3 h-3" aria-hidden="true" />
            {backtest.mae_improvement_pct}% more accurate than staff (±{backtest.staff_mae})
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] rounded-xl p-5">
          <div className="text-xs text-slate-500">Projected Waste Reduction</div>
          <div className="font-display text-2xl sm:text-3xl font-bold tabular-nums text-slate-950 mt-1">
            {backtest.waste_reduction_pct}%
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-1.5">
            {backtest.waste_saved_kg.toLocaleString('en-IN')} kg food saved in backtest
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] rounded-xl p-5">
          <div className="text-xs text-slate-500">Historical Mess Leftover</div>
          <div className="font-display text-2xl sm:text-3xl font-bold tabular-nums text-amber-700 mt-1">
            {wastage.totalWasteKg.toLocaleString('en-IN')} kg
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-1.5">
            ₹{wastage.totalLossInr.toLocaleString('en-IN')} total estimated loss
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] rounded-xl p-5">
          <div className="text-xs text-slate-500">Shortage Prevention</div>
          <div className="font-display text-2xl sm:text-3xl font-bold tabular-nums text-slate-950 mt-1">
            {backtest.ai_simulated_shortages}
            <span className="text-xs font-normal text-slate-500 ml-1.5">incidents</span>
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-1.5">
            vs {backtest.historical_shortages} historical · {backtest.co2_avoided_kg} kg CO₂e saved
          </div>
        </div>
      </div>

      {/* Main Dashboard 2-Column Grid: Daily Demand Gap Chart + Next Meal Action Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Planned vs Actual Gap (Last 21 Days) */}
        <section className="lg:col-span-8 bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                21-Day Daily Turnout vs. Staff Planned Capacity
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Sum of all 4 daily meals showing persistent over-preparation gaps
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 inline-block" /> Staff Planned
              </span>
              <span className="inline-flex items-center gap-1.5 text-blue-800 font-medium">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" /> Actual Ate
              </span>
            </div>
          </div>

          <div className="pt-2">
            <div className="grid grid-cols-21 gap-1.5 items-end h-44 border-b border-slate-200 pb-2">
              {dailyTrend.map((d) => {
                const expH = Math.max(8, Math.round((d.expected / maxDailyVal) * 100));
                const actH = Math.max(8, Math.round((d.actual / maxDailyVal) * 100));
                return (
                  <div
                    key={d.date}
                    className="group relative flex items-end justify-center gap-0.5 h-full"
                    title={`${d.date}: Planned ${d.expected} · Ate ${d.actual} · Waste ${d.wasteKg.toFixed(1)} kg`}
                  >
                    <div
                      className="w-1/2 bg-slate-200 rounded-t-xs transition-colors group-hover:bg-slate-300"
                      style={{ height: `${expH}%` }}
                    />
                    <div
                      className="w-1/2 bg-blue-600 rounded-t-xs transition-colors group-hover:bg-blue-700"
                      style={{ height: `${actH}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400 pt-2">
              <span>{dailyTrend[0]?.date ?? ''}</span>
              <span>{dailyTrend[Math.floor(dailyTrend.length / 2)]?.date ?? ''}</span>
              <span>{dailyTrend[dailyTrend.length - 1]?.date ?? ''}</span>
            </div>
          </div>
        </section>

        {/* Next Meal Snapshot */}
        <section className="lg:col-span-4 bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Next Scheduled Lunch</span>
              <Calendar className="w-4 h-4 text-blue-700" aria-hidden="true" />
            </div>
            <div>
              <div className="font-display text-3xl font-bold tabular-nums text-slate-950">
                {nextLunchSnapshot.predicted_students}
                <span className="text-sm font-normal text-slate-500 ml-1.5">predicted</span>
              </div>
              <p className="text-xs font-mono text-slate-500 mt-1">
                {nextLunchSnapshot.input.date} · {nextLunchSnapshot.input.day_category}
              </p>
            </div>

            <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-lg space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-blue-950">
                <span>AI Recommended Prep</span>
                <span className="font-mono tabular-nums">{nextLunchSnapshot.recommended_prep_headcount} servings</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-blue-800">
                <span>Wave 1: {nextLunchSnapshot.wave1_headcount}</span>
                <span>Wave 2 Reserve: {nextLunchSnapshot.wave2_headcount}</span>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed">
              Menu: <span className="font-medium text-slate-800">{nextLunchSnapshot.input.menu}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('planner')}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-blue-800 transition-colors"
          >
            Customize Next Meal Plan
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </section>
      </div>

      {/* Meal Session Performance + Top Wastage Hotspots */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Meal Session Calibration
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Historical averages across Breakfast, Lunch, Snacks, and Dinner
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('backtest')}
              className="text-xs font-medium text-blue-700 hover:text-blue-900 whitespace-nowrap"
            >
              View Backtest →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Meal</th>
                  <th className="py-2.5 px-3 text-right">Avg Staff Plan</th>
                  <th className="py-2.5 px-3 text-right">Avg Actual</th>
                  <th className="py-2.5 px-3 text-right">Over-Plan Bias</th>
                  <th className="py-2.5 px-3 text-right">Avg Waste %</th>
                  <th className="py-2.5 px-4 text-right">Total Leftover</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mealSessionStats.map((m) => (
                  <tr key={m.mealType} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-semibold text-slate-900">{m.mealType}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">{m.avgExpected}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-slate-900">{m.avgActual}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-700">
                      {m.bias >= 0 ? `+${m.bias}` : m.bias}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-800">{m.avgWastePct}%</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 font-medium">
                      {m.totalLeftKg} kg
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Top Wastage Hotspots
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Items driving the highest historical over-production
              </p>
            </div>
            <Flame className="w-4 h-4 text-amber-600" aria-hidden="true" />
          </div>

          <div className="divide-y divide-slate-100">
            {wastage.itemHotspots.slice(0, 4).map((it) => (
              <div key={it.item_name} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{it.item_name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{it.worst_condition}</div>
                </div>
                <div className="text-right font-mono tabular-nums shrink-0">
                  <div className="font-semibold text-red-700">{it.avg_waste_pct}% waste</div>
                  <div className="text-[11px] text-slate-500">₹{it.estimated_loss_inr.toLocaleString('en-IN')}</div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('wastage')}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-800 bg-blue-50/70 border border-blue-200 rounded-lg hover:bg-blue-100/70 transition-colors"
          >
            <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
            Inspect Full Item Intelligence
          </button>
        </section>
      </div>
    </div>
  );
};
