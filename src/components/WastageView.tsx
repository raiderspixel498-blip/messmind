import React, { useMemo, useState } from 'react';
import { AlertCircle, Search } from 'lucide-react';
import { analyzeWastageHotspots } from '../engine/predictor';
import { EnrichedMealRecord, MealType } from '../types/mess';

interface WastageViewProps {
  history: EnrichedMealRecord[];
}

export const WastageView: React.FC<WastageViewProps> = ({ history }) => {
  const [mealFilter, setMealFilter] = useState<MealType | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHistory = useMemo(
    () => (mealFilter === 'All' ? history : history.filter((h) => h.meal_type === mealFilter)),
    [history, mealFilter]
  );

  const analysis = useMemo(() => analyzeWastageHotspots(filteredHistory), [filteredHistory]);

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return analysis.itemHotspots;
    return analysis.itemHotspots.filter(
      (it) =>
        it.item_name.toLowerCase().includes(q) ||
        it.worst_condition.toLowerCase().includes(q)
    );
  }, [analysis.itemHotspots, searchQuery]);

  const highestWasteItem = analysis.itemHotspots[0];
  const worstCondition = analysis.conditionStats[0];

  return (
    <div className="space-y-6">
      {/* Header + Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Historical Item Audit · Calendar Condition Breakdown · Anomaly Detection
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            Wastage Hotspots & Menu Intelligence
          </h1>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          {(['All', 'Breakfast', 'Lunch', 'Snacks', 'Dinner'] as const).map((mt) => (
            <button
              key={mt}
              type="button"
              onClick={() => setMealFilter(mt)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mealFilter === mt
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {mt}
            </button>
          ))}
        </div>
      </div>

      {/* 4-Metric Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Total Historical Leftover</div>
          <div className="font-display text-2xl font-bold tabular-nums text-slate-900 mt-1">
            {analysis.totalWasteKg.toLocaleString('en-IN')} kg
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across {filteredHistory.length} recorded meals
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Estimated Financial Loss</div>
          <div className="font-display text-2xl font-bold tabular-nums text-red-700 mt-1">
            ₹{analysis.totalLossInr.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Valued at standard mess unit rates
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Highest-Waste Food Item</div>
          <div className="font-display text-lg font-bold text-slate-900 mt-1 truncate">
            {highestWasteItem ? highestWasteItem.item_name : '—'}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-amber-700 mt-1">
            {highestWasteItem ? `${highestWasteItem.avg_waste_pct}% avg unconsumed` : 'No items'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">Worst Calendar Condition</div>
          <div className="font-display text-lg font-bold text-slate-900 mt-1 truncate">
            {worstCondition ? worstCondition.condition : '—'}
          </div>
          <div className="text-[11px] font-mono tabular-nums text-amber-700 mt-1">
            {worstCondition
              ? `${worstCondition.avg_waste_pct}% avg waste (+${worstCondition.avg_over_prep_students} over-planned)`
              : 'No data'}
          </div>
        </div>
      </div>

      {/* Calendar Condition Breakdown + Anomaly Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Wastage by Calendar Condition
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Compares staff expected headcount vs. actual turnout across academic and off-schedule days
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Condition</th>
                  <th className="py-2.5 px-3 text-right">Meals</th>
                  <th className="py-2.5 px-3 text-right">Avg Staff Plan</th>
                  <th className="py-2.5 px-3 text-right">Avg Actual Ate</th>
                  <th className="py-2.5 px-3 text-right">Avg Over-Plan</th>
                  <th className="py-2.5 px-4 text-right">Avg Waste %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {analysis.conditionStats.map((c) => (
                  <tr key={c.condition} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-medium text-slate-900">{c.condition}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">{c.meals_count}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">{c.avg_staff_expected}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 font-medium">{c.avg_actual}</td>
                    <td className={`py-3 px-3 text-right font-mono tabular-nums ${
                      c.avg_over_prep_students > 35 ? 'text-amber-700 font-semibold' : 'text-slate-700'
                    }`}>
                      {c.avg_over_prep_students >= 0 ? `+${c.avg_over_prep_students}` : c.avg_over_prep_students}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <span className={c.avg_waste_pct >= 18 ? 'text-red-700 font-semibold' : 'text-slate-900'}>
                        {c.avg_waste_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Unusual Attendance & Anomaly Log */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Unusual Attendance Anomalies
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Outlier sessions (|z| ≥ 2.0) damped during model training
              </p>
            </div>
            <AlertCircle className="w-4 h-4 text-amber-600" aria-hidden="true" />
          </div>

          {analysis.anomalies.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No extreme attendance anomalies detected in this meal subset.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {analysis.anomalies.map((a) => (
                <div key={`${a.date}-${a.meal_type}`} className="py-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between font-medium text-slate-900">
                    <span>
                      {a.date} · {a.meal_type} ({a.day_of_week})
                    </span>
                    <span className="font-mono tabular-nums text-amber-800">
                      {a.actual_students} ate / {a.expected_students} plan
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">{a.anomaly_reason}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Item-Wise Wastage Hotspot Ranking Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              High-Wastage Food Items Ranking
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sorted by historical leftover percentage across all preparation logs
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter items or conditions..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-700 focus:bg-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">Item Name</th>
                <th className="py-2.5 px-3 text-right">Prepared</th>
                <th className="py-2.5 px-3 text-right">Consumed</th>
                <th className="py-2.5 px-3 text-right">Leftover</th>
                <th className="py-2.5 px-3 text-right">Waste %</th>
                <th className="py-2.5 px-3 text-right">Est. Loss</th>
                <th className="py-2.5 px-4">Peak Waste Condition & Guidance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {visibleItems.map((it) => (
                <tr key={it.item_name} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-medium text-slate-900">
                    {it.item_name}
                    <span className="block text-[11px] font-normal text-slate-500">
                      {it.meal_types.join(' · ')} ({it.appearances} logs)
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                    {it.total_prepared} {it.unit}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                    {it.total_consumed} {it.unit}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-slate-900">
                    {it.total_leftover} {it.unit}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    <div className="inline-flex items-center justify-end gap-2">
                      <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                        <div
                          className={`h-full rounded-full ${
                            it.avg_waste_pct >= 20
                              ? 'bg-red-600'
                              : it.avg_waste_pct >= 14
                              ? 'bg-amber-500'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${Math.min(100, Math.round(it.avg_waste_pct * 2.5))}%` }}
                        />
                      </div>
                      <span
                        className={
                          it.avg_waste_pct >= 20
                            ? 'text-red-700 font-semibold'
                            : it.avg_waste_pct >= 14
                            ? 'text-amber-700 font-semibold'
                            : 'text-blue-800'
                        }
                      >
                        {it.avg_waste_pct}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-800">
                    ₹{it.estimated_loss_inr.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 text-slate-600 max-w-md">
                    <div className="font-medium text-slate-800">{it.worst_condition}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{it.recommendation}</div>
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
