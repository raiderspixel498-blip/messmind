import React, { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { runWalkForwardBacktest } from '../engine/predictor';
import { DayCategory, EnrichedMealRecord, MealType, RiskPosture } from '../types/mess';

interface BacktestViewProps {
  history: EnrichedMealRecord[];
}

export const BacktestView: React.FC<BacktestViewProps> = ({ history }) => {
  const [posture, setPosture] = useState<RiskPosture>('balanced');
  const [mealFilter, setMealFilter] = useState<MealType | 'All'>('Lunch');
  const [catFilter, setCatFilter] = useState<DayCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const summary = useMemo(
    () => runWalkForwardBacktest(history, posture),
    [history, posture]
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return summary.rows.filter((r) => {
      if (mealFilter !== 'All' && r.meal_type !== mealFilter) return false;
      if (catFilter !== 'All' && r.day_category !== catFilter) return false;
      if (
        q &&
        !r.date.includes(q) &&
        !r.menu.toLowerCase().includes(q) &&
        !r.day_category.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [summary.rows, mealFilter, catFilter, searchQuery]);

  // Chart data (take up to latest 45 points of the filtered meal type for crisp visual legibility)
  const chartPoints = useMemo(() => {
    const pts = filteredRows.slice(-45);
    return pts;
  }, [filteredRows]);

  const exportBacktestCSV = () => {
    const header =
      'date,day_of_week,meal_type,day_category,menu,staff_expected,ai_predicted,ai_recommended_prep,actual_ate,staff_abs_error,ai_abs_error,actual_waste_kg,ai_sim_waste_kg,staff_shortage,ai_shortage';
    const lines = summary.rows.map((r) =>
      [
        r.date,
        r.day_of_week,
        r.meal_type,
        r.day_category,
        `"${r.menu}"`,
        r.staff_expected,
        r.ai_predicted,
        r.ai_recommended_prep,
        r.actual_ate,
        r.staff_abs_error,
        r.ai_abs_error,
        r.actual_waste_kg,
        r.ai_sim_waste_kg,
        r.staff_shortage,
        r.ai_shortage,
      ].join(',')
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `platewise_backtest_${summary.total_records_evaluated}_records.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // SVG chart coordinate math
  const svgW = 860;
  const svgH = 240;
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const yVals = chartPoints.flatMap((p) => [p.actual_ate, p.staff_expected, p.ai_predicted]);
  const yMin = yVals.length ? Math.max(0, Math.floor((Math.min(...yVals) - 25) / 20) * 20) : 100;
  const yMax = yVals.length ? Math.ceil((Math.max(...yVals) + 25) / 20) * 20 : 480;

  const toX = (idx: number) =>
    chartPoints.length <= 1 ? padL : padL + (idx / (chartPoints.length - 1)) * plotW;
  const toY = (val: number) =>
    padT + plotH - ((val - yMin) / Math.max(1, yMax - yMin)) * plotH;

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const buildPath = (getter: (p: typeof chartPoints[0]) => number) =>
    chartPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(getter(p)).toFixed(1)}`)
      .join(' ');

  const hoveredPoint = hoveredIdx !== null && chartPoints[hoveredIdx] ? chartPoints[hoveredIdx] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Chronological Out-of-Sample Walk-Forward Evaluation · {summary.total_records_evaluated} Test Meals (after {summary.warmup_records}-meal warm-up)
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Historical Backtest & Model Proof
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['eco', 'balanced', 'zero_shortage'] as RiskPosture[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPosture(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  posture === p
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p === 'eco' ? 'Eco' : p === 'balanced' ? 'Balanced' : 'Zero-Shortage'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={exportBacktestCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Export Results CSV
          </button>
        </div>
      </div>

      {/* 4-Column Benchmark Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] rounded-xl p-4">
          <div className="text-xs text-slate-500">Forecast Accuracy (MAE)</div>
          <div className="font-display text-2xl font-bold tabular-nums text-blue-800 mt-1">
            ±{summary.ai_mae} students
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-1">
            vs ±{summary.staff_mae} staff plan ({summary.mae_improvement_pct}% better)
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] rounded-xl p-4">
          <div className="text-xs text-slate-500">Food Waste Saved</div>
          <div className="font-display text-2xl font-bold tabular-nums text-blue-800 mt-1">
            {summary.waste_saved_kg.toLocaleString('en-IN')} kg
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-1">
            {summary.waste_reduction_pct}% reduction ({summary.ai_simulated_waste_kg} vs {summary.historical_waste_kg} kg)
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] rounded-xl p-4">
          <div className="text-xs text-slate-500">Simulated Cost & CO₂ Savings</div>
          <div className="font-display text-2xl font-bold tabular-nums text-slate-900 mt-1">
            ₹{summary.estimated_savings_inr.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-1">
            {summary.co2_avoided_kg.toLocaleString('en-IN')} kg CO₂e avoided
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] rounded-xl p-4">
          <div className="text-xs text-slate-500">Shortage Incidents (&gt;3% short)</div>
          <div className="font-display text-2xl font-bold tabular-nums text-slate-900 mt-1">
            {summary.ai_simulated_shortages} meals
          </div>
          <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-1">
            vs {summary.historical_shortages} historical · {summary.ai_within_5pct_rate}% within ±5%
          </div>
        </div>
      </div>

      {/* Time-Series Comparison Chart */}
      <section className="bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Actual Turnout vs. Staff Planned vs. AI Predicted
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {hoveredPoint
                ? `${hoveredPoint.date} (${hoveredPoint.meal_type} · ${hoveredPoint.day_category}) — Actual: ${hoveredPoint.actual_ate} · AI: ${hoveredPoint.ai_predicted} · Staff: ${hoveredPoint.staff_expected}`
                : `Hover over chart points to inspect · Showing ${chartPoints.length} ${mealFilter === 'All' ? 'meals' : `${mealFilter} sessions`}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 text-slate-700">
              <span className="w-3 h-0.5 bg-slate-900 inline-block" /> Actual Ate
            </span>
            <span className="inline-flex items-center gap-1.5 text-blue-800">
              <span className="w-3 h-0.5 bg-blue-600 inline-block" /> AI Predicted
            </span>
            <span className="inline-flex items-center gap-1.5 text-amber-700">
              <span className="w-3 h-0.5 bg-amber-500 inline-block border-t border-dashed" /> Staff Expected
            </span>
          </div>
        </div>

        {chartPoints.length > 1 ? (
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="w-full min-w-[600px] h-60 select-none"
              role="img"
              aria-label="Backtest attendance comparison chart"
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Horizontal grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const val = Math.round(yMin + t * (yMax - yMin));
                const y = toY(val);
                return (
                  <g key={t}>
                    <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                    <text
                      x={padL - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Staff expected line (dashed amber) */}
              <path
                d={buildPath((p) => p.staff_expected)}
                fill="none"
                stroke="#d97706"
                strokeWidth="1.75"
                strokeDasharray="4 3"
                opacity="0.8"
              />

              {/* Actual ate line (solid dark slate) */}
              <path
                d={buildPath((p) => p.actual_ate)}
                fill="none"
                stroke="#0f172a"
                strokeWidth="2"
              />

              {/* AI predicted line (solid emerald) */}
              <path
                d={buildPath((p) => p.ai_predicted)}
                fill="none"
                stroke="#1d4ed8"
                strokeWidth="2.25"
              />

              {/* Hover crosshair & active dots */}
              {hoveredPoint && hoveredIdx !== null && (
                <g pointerEvents="none">
                  <line
                    x1={toX(hoveredIdx)}
                    y1={padT}
                    x2={toX(hoveredIdx)}
                    y2={svgH - padB}
                    stroke="#94a3b8"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <circle cx={toX(hoveredIdx)} cy={toY(hoveredPoint.staff_expected)} r="3.5" fill="#d97706" />
                  <circle cx={toX(hoveredIdx)} cy={toY(hoveredPoint.actual_ate)} r="4" fill="#0f172a" />
                  <circle cx={toX(hoveredIdx)} cy={toY(hoveredPoint.ai_predicted)} r="4" fill="#1d4ed8" />
                </g>
              )}

              {/* Invisible hover columns for smooth scrubbing */}
              {chartPoints.map((_, i) => {
                const colW = plotW / Math.max(1, chartPoints.length - 1);
                return (
                  <rect
                    key={i}
                    x={Math.max(padL, toX(i) - colW / 2)}
                    y={padT}
                    width={colW}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHoveredIdx(i)}
                  />
                );
              })}

              {/* X-axis sparse date ticks */}
              {chartPoints.map((p, i) => {
                if (i % Math.max(1, Math.floor(chartPoints.length / 7)) !== 0 && i !== chartPoints.length - 1) {
                  return null;
                }
                return (
                  <text
                    key={`${p.date}-${p.meal_type}-${i}`}
                    x={toX(i)}
                    y={svgH - 6}
                    textAnchor="middle"
                    className="fill-slate-400 text-[10px] font-mono"
                  >
                    {p.date.slice(5)}
                  </text>
                );
              })}
            </svg>
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-8 text-center">
            Select a filter with at least 2 records to display the trend chart.
          </p>
        )}
      </section>

      {/* Per-Meal Test Record Verification Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['All', 'Breakfast', 'Lunch', 'Snacks', 'Dinner'] as const).map((mt) => (
                <button
                  key={mt}
                  type="button"
                  onClick={() => setMealFilter(mt)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    mealFilter === mt ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {mt}
                </button>
              ))}
            </div>

            <select
              aria-label="Filter by calendar condition"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value as DayCategory | 'All')}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="All">All Conditions</option>
              <option value="Academic">Academic</option>
              <option value="Weekend">Weekend</option>
              <option value="Examination">Examination</option>
              <option value="Holiday">Holiday</option>
              <option value="Vacation">Vacation</option>
              <option value="Campus Event">Campus Event</option>
            </select>
          </div>

          <div className="relative w-full lg:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search date or dish..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[460px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 z-10">
              <tr>
                <th className="py-2.5 px-4">Date & Meal</th>
                <th className="py-2.5 px-3">Condition & Menu</th>
                <th className="py-2.5 px-3 text-right">Staff Plan</th>
                <th className="py-2.5 px-3 text-right">AI Pred</th>
                <th className="py-2.5 px-3 text-right">AI Prep</th>
                <th className="py-2.5 px-3 text-right">Actual Ate</th>
                <th className="py-2.5 px-3 text-right">Staff Waste</th>
                <th className="py-2.5 px-4 text-right">AI Sim Waste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRows.map((r) => (
                <tr key={`${r.date}-${r.meal_type}`} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-4 font-mono tabular-nums text-slate-900 whitespace-nowrap">
                    {r.date}
                    <span className="block text-[11px] font-sans text-slate-500">
                      {r.day_of_week.slice(0, 3)} · {r.meal_type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 max-w-xs">
                    <div className="font-medium text-slate-800">{r.day_category}</div>
                    <div className="text-[11px] text-slate-500 truncate">{r.menu}</div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                    {r.staff_expected}
                    <span className="block text-[10px] text-slate-400">err {r.staff_abs_error}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-blue-800">
                    {r.ai_predicted}
                    <span className="block text-[10px] font-normal text-slate-500">err {r.ai_abs_error}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                    {r.ai_recommended_prep}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {r.actual_ate}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-700">
                    {r.actual_waste_kg} kg
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-blue-800 font-medium">
                    {r.ai_sim_waste_kg} kg
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
