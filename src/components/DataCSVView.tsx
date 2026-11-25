import React, { useState } from 'react';
import { CheckCircle2, Download, RotateCcw, Upload } from 'lucide-react';
import {
  parseCalendarCSV,
  parseFoodPrepCSV,
  parseMealsCSV,
  serializeCalendarCSV,
  serializeFoodPrepCSV,
  serializeMealsCSV,
} from '../data/syntheticGenerator';
import { DatasetBundle } from '../types/mess';

interface DataCSVViewProps {
  dataset: DatasetBundle;
  onUpdateDataset: (next: DatasetBundle) => void;
  onResetSynthetic: () => void;
}

type CsvTab = 'meals' | 'food_prep' | 'calendar';

export const DataCSVView: React.FC<DataCSVViewProps> = ({
  dataset,
  onUpdateDataset,
  onResetSynthetic,
}) => {
  const [activeCsv, setActiveCsv] = useState<CsvTab>('meals');
  const [uploadStatus, setUploadStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = (kind: CsvTab, file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        if (kind === 'meals') {
          const parsed = parseMealsCSV(text);
          onUpdateDataset({
            ...dataset,
            meals: parsed,
            sourceLabel: `Custom Upload (${parsed.length} meals · ${dataset.foodPrep.length} prep · ${dataset.calendar.length} calendar)`,
          });
          setUploadStatus({ type: 'ok', msg: `Loaded ${parsed.length} meal records from ${file.name}.` });
        } else if (kind === 'food_prep') {
          const parsed = parseFoodPrepCSV(text);
          onUpdateDataset({
            ...dataset,
            foodPrep: parsed,
            sourceLabel: `Custom Upload (${dataset.meals.length} meals · ${parsed.length} prep · ${dataset.calendar.length} calendar)`,
          });
          setUploadStatus({ type: 'ok', msg: `Loaded ${parsed.length} food preparation rows from ${file.name}.` });
        } else {
          const parsed = parseCalendarCSV(text);
          onUpdateDataset({
            ...dataset,
            calendar: parsed,
            sourceLabel: `Custom Upload (${dataset.meals.length} meals · ${dataset.foodPrep.length} prep · ${parsed.length} calendar)`,
          });
          setUploadStatus({ type: 'ok', msg: `Loaded ${parsed.length} calendar days from ${file.name}.` });
        }
      } catch (err) {
        setUploadStatus({
          type: 'err',
          msg: err instanceof Error ? err.message : 'Failed to parse CSV file.',
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Active Source: {dataset.sourceLabel}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mt-1">
            3-CSV Data Studio & Import
          </h1>
        </div>

        <button
          type="button"
          onClick={() => {
            onResetSynthetic();
            setUploadStatus({ type: 'ok', msg: 'Restored built-in 90-day synthetic dataset (360 meals).' });
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 self-start"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Reset Synthetic Data
        </button>
      </div>

      {uploadStatus && (
        <div
          className={`border rounded-xl px-4 py-3 text-xs flex items-center gap-2 ${
            uploadStatus.type === 'ok'
              ? 'bg-blue-50 border-blue-200 text-blue-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{uploadStatus.msg}</span>
        </div>
      )}

      {/* 3 CSV Upload & Download Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CSV 1: Meals */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-slate-900">1. Meals CSV</h2>
              <span className="font-mono text-xs tabular-nums text-slate-500">{dataset.meals.length} rows</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Columns: <span className="font-mono text-[11px]">date, meal_type, menu, expected_students, actual_students, event_info</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-800 rounded-lg hover:bg-blue-900 cursor-pointer transition-colors whitespace-nowrap">
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              Upload Meals
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => handleUpload('meals', e.target.files?.[0])}
              />
            </label>
            <button
              type="button"
              onClick={() => downloadFile('meals.csv', serializeMealsCSV(dataset.meals))}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              CSV
            </button>
          </div>
        </div>

        {/* CSV 2: Food Prep */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-slate-900">2. Food Preparation CSV</h2>
              <span className="font-mono text-xs tabular-nums text-slate-500">{dataset.foodPrep.length} rows</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Columns: <span className="font-mono text-[11px]">date, meal_type, item_name, unit, prepared_qty, consumed_qty, leftover_qty</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-800 rounded-lg hover:bg-blue-900 cursor-pointer transition-colors whitespace-nowrap">
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              Upload Prep
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => handleUpload('food_prep', e.target.files?.[0])}
              />
            </label>
            <button
              type="button"
              onClick={() => downloadFile('food_preparation.csv', serializeFoodPrepCSV(dataset.foodPrep))}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              CSV
            </button>
          </div>
        </div>

        {/* CSV 3: Calendar */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-slate-900">3. Calendar CSV</h2>
              <span className="font-mono text-xs tabular-nums text-slate-500">{dataset.calendar.length} rows</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Columns: <span className="font-mono text-[11px]">date, day_of_week, day_category, event_name, attendance_impact</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-800 rounded-lg hover:bg-blue-900 cursor-pointer transition-colors whitespace-nowrap">
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              Upload Calendar
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => handleUpload('calendar', e.target.files?.[0])}
              />
            </label>
            <button
              type="button"
              onClick={() => downloadFile('calendar.csv', serializeCalendarCSV(dataset.calendar))}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Live CSV Preview Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveCsv('meals')}
              className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                activeCsv === 'meals' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              meals.csv ({dataset.meals.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveCsv('food_prep')}
              className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                activeCsv === 'food_prep' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              food_preparation.csv ({dataset.foodPrep.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveCsv('calendar')}
              className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                activeCsv === 'calendar' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              calendar.csv ({dataset.calendar.length})
            </button>
          </div>
          <span className="text-xs text-slate-500 hidden sm:inline">Showing first 50 rows</span>
        </div>

        <div className="overflow-x-auto max-h-96">
          {activeCsv === 'meals' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                <tr>
                  <th className="py-2 px-4">date</th>
                  <th className="py-2 px-3">meal_type</th>
                  <th className="py-2 px-3">menu</th>
                  <th className="py-2 px-3 text-right">expected_students</th>
                  <th className="py-2 px-3 text-right">actual_students</th>
                  <th className="py-2 px-4">event_info</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dataset.meals.slice(0, 50).map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-2 px-4 font-mono tabular-nums">{m.date}</td>
                    <td className="py-2 px-3">{m.meal_type}</td>
                    <td className="py-2 px-3 max-w-xs truncate">{m.menu}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{m.expected_students}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-medium">{m.actual_students}</td>
                    <td className="py-2 px-4 text-slate-500">{m.event_info}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeCsv === 'food_prep' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                <tr>
                  <th className="py-2 px-4">date</th>
                  <th className="py-2 px-3">meal_type</th>
                  <th className="py-2 px-3">item_name</th>
                  <th className="py-2 px-3">unit</th>
                  <th className="py-2 px-3 text-right">prepared_qty</th>
                  <th className="py-2 px-3 text-right">consumed_qty</th>
                  <th className="py-2 px-4 text-right">leftover_qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dataset.foodPrep.slice(0, 50).map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-2 px-4 font-mono tabular-nums">{p.date}</td>
                    <td className="py-2 px-3">{p.meal_type}</td>
                    <td className="py-2 px-3 font-medium">{p.item_name}</td>
                    <td className="py-2 px-3 font-mono">{p.unit}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{p.prepared_qty}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{p.consumed_qty}</td>
                    <td className="py-2 px-4 text-right font-mono tabular-nums text-amber-700">{p.leftover_qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeCsv === 'calendar' && (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                <tr>
                  <th className="py-2 px-4">date</th>
                  <th className="py-2 px-3">day_of_week</th>
                  <th className="py-2 px-3">day_category</th>
                  <th className="py-2 px-3">event_name</th>
                  <th className="py-2 px-4">attendance_impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dataset.calendar.slice(0, 50).map((c, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-2 px-4 font-mono tabular-nums">{c.date}</td>
                    <td className="py-2 px-3">{c.day_of_week}</td>
                    <td className="py-2 px-3 font-medium">{c.day_category}</td>
                    <td className="py-2 px-3">{c.event_name}</td>
                    <td className="py-2 px-4 text-slate-500">{c.attendance_impact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};
