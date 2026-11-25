import React, { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { DatasetBundle } from '../types/mess';

interface ArchitectureViewProps {
  dataset: DatasetBundle;
  enrichedCount: number;
}

type StageId = 'csv' | 'join' | 'ridge' | 'newsvendor' | 'outputs';

interface StageDetail {
  id: StageId;
  step: string;
  title: string;
  subtitle: string;
  inputs: string[];
  mechanics: string;
  outputs: string[];
}

const STAGE_DETAILS: Record<StageId, StageDetail> = {
  csv: {
    id: 'csv',
    step: '01',
    title: '3-CSV Browser Ingestion Layer',
    subtitle: 'Zero-backend RFC-4180 CSV parser + deterministic 90-day synthetic engine',
    inputs: ['meals.csv (date, meal_type, menu, expected, actual)', 'food_preparation.csv (item, unit, prepared, consumed, leftover)', 'calendar.csv (date, day_category, event_name)'],
    mechanics: 'Parses uploaded user CSVs directly via browser FileReader or loads the seeded 90-day Mulberry32 synthetic dataset with header-alias normalization.',
    outputs: ['Validated in-memory typed record arrays'],
  },
  join: {
    id: 'join',
    step: '02',
    title: 'Relational Join & Z-Score Anomaly Guard',
    subtitle: 'Joins all 3 tables on (date, meal_type) and isolates outlier shocks',
    inputs: ['MealRecord[]', 'FoodPrepRecord[]', 'CalendarRecord[]'],
    mechanics: 'Left-joins calendar events on date and preparation items on (date, meal_type). Computes peer-group mean/std per (meal_type, day_category) and flags |z| ≥ 2.0 anomalies so freak disruptions do not corrupt routine forecasts.',
    outputs: ['EnrichedMealRecord[]', 'Anomaly Log', 'Historical Wastage Hotspots'],
  },
  ridge: {
    id: 'ridge',
    step: '03',
    title: 'Recency-Weighted Ridge Regression',
    subtitle: 'Pure TypeScript linear algebra solved via Gauss-Jordan elimination',
    inputs: ['21-feature vector (meal, weekday, calendar, interactions, menu pull, 14-day drift)'],
    mechanics: 'Solves (XᵀWX + λI)w = XᵀWy in <5ms directly in the browser. Decomposes every prediction into additive human-readable factor deltas and estimates residual σ for 90% confidence intervals.',
    outputs: ['Predicted Headcount μ', '90% CI [P10, P90]', 'Factor Waterfall'],
  },
  newsvendor: {
    id: 'newsvendor',
    step: '04',
    title: 'Newsvendor & 2-Wave Batch Optimizer',
    subtitle: 'Asymmetric cost fractile scaling + split-batch kitchen execution',
    inputs: ['Predicted μ & σ', 'Item per-capita distribution (μ_item, σ_item)', 'Risk Posture'],
    mechanics: 'Applies critical fractile z* = Φ⁻¹(Cs / (Cs + Cw)) across Eco (58%), Balanced (72%), and Zero-Shortage (92%) postures. Splits cookable dishes into Wave 1 (82% upfront) + Wave 2 (18% dry reserve) with a live swipe-in trigger.',
    outputs: ['Item-wise kg / L / pcs targets', 'Shortage & Excess Risk %', 'Kitchen Staff Alerts'],
  },
  outputs: {
    id: 'outputs',
    step: '05',
    title: 'Walk-Forward Backtest & Kitchen Exports',
    subtitle: 'Chronological out-of-sample validation across all historical meals',
    inputs: ['Expanding historical window [0..t-1]'],
    mechanics: 'Re-trains sequentially on strictly past meals to benchmark AI Predictor vs. Staff Expected Plan across MAE, food waste kg saved, financial ₹ savings, CO₂e avoided, and shortage incidents.',
    outputs: ['Kitchen Prep Sheet CSV', 'Backtest Verification CSV', 'SVG Architecture Diagram'],
  },
};

export const ArchitectureView: React.FC<ArchitectureViewProps> = ({
  dataset,
  enrichedCount,
}) => {
  const [selectedStage, setSelectedStage] = useState<StageId>('ridge');
  const svgRef = useRef<SVGSVGElement | null>(null);

  const exportDiagramSVG = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgRef.current);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'platewise_system_architecture.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const active = STAGE_DETAILS[selectedStage];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            100% Client-Side Pipeline · Zero Backend · Click Any Stage to Inspect Mechanics
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 mt-1">
            System Architecture & Modeling Assumptions
          </h1>
        </div>

        <button
          type="button"
          onClick={exportDiagramSVG}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 self-start"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          Export Diagram SVG
        </button>
      </div>

      {/* Interactive System Architecture Diagram */}
      <section className="bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              End-to-End Predictive Architecture Diagram
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Interactive browser-native dataflow from 3 CSV files to Newsvendor batch recommendations
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-blue-700 font-medium">
            {enrichedCount} meals · {dataset.foodPrep.length} prep logs · {dataset.calendar.length} days
          </span>
        </div>

        <div className="w-full overflow-x-auto pb-2">
          <svg
            ref={svgRef}
            viewBox="0 0 1120 350"
            className="w-full min-w-[820px] h-auto select-none"
            role="img"
            aria-label="PlateWise System Architecture Diagram"
          >
            <defs>
              <marker
                id="arrow-blue"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
              </marker>
            </defs>

            {/* Subtle background grid */}
            <rect x="0" y="0" width="1120" height="350" rx="12" fill="#f8fafc" />

            {/* Column 1: 3 CSV Inputs */}
            <g
              onClick={() => setSelectedStage('csv')}
              className="cursor-pointer"
            >
              <rect
                x="24"
                y="26"
                width="200"
                height="298"
                rx="10"
                fill="#ffffff"
                stroke={selectedStage === 'csv' ? '#1d4ed8' : '#cbd5e1'}
                strokeWidth={selectedStage === 'csv' ? '2.5' : '1.25'}
              />
              <text x="40" y="52" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="11" fontWeight="700" fill="#1d4ed8">
                01. DATA SOURCES
              </text>

              {/* CSV 1 Box */}
              <rect x="38" y="72" width="172" height="66" rx="7" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
              <text x="50" y="96" fontFamily="JetBrains Mono, monospace" fontSize="12" fontWeight="600" fill="#0f172a">
                meals.csv
              </text>
              <text x="50" y="114" fontFamily="Public Sans, sans-serif" fontSize="10.5" fill="#475569">
                {dataset.meals.length} historical meals
              </text>
              <text x="50" y="128" fontFamily="Public Sans, sans-serif" fontSize="10" fill="#64748b">
                menu · expected · actual
              </text>

              {/* CSV 2 Box */}
              <rect x="38" y="152" width="172" height="66" rx="7" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
              <text x="50" y="176" fontFamily="JetBrains Mono, monospace" fontSize="12" fontWeight="600" fill="#0f172a">
                food_prep.csv
              </text>
              <text x="50" y="194" fontFamily="Public Sans, sans-serif" fontSize="10.5" fill="#475569">
                {dataset.foodPrep.length} item prep rows
              </text>
              <text x="50" y="208" fontFamily="Public Sans, sans-serif" fontSize="10" fill="#64748b">
                prepared · consumed · left
              </text>

              {/* CSV 3 Box */}
              <rect x="38" y="232" width="172" height="66" rx="7" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
              <text x="50" y="256" fontFamily="JetBrains Mono, monospace" fontSize="12" fontWeight="600" fill="#0f172a">
                calendar.csv
              </text>
              <text x="50" y="274" fontFamily="Public Sans, sans-serif" fontSize="10.5" fill="#475569">
                {dataset.calendar.length} campus days
              </text>
              <text x="50" y="288" fontFamily="Public Sans, sans-serif" fontSize="10" fill="#64748b">
                exams · holidays · fests
              </text>
            </g>

            {/* Connectors 1 -> 2 */}
            <path d="M 224 105 L 266 150" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrow-blue)" />
            <path d="M 224 185 L 266 175" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrow-blue)" />
            <path d="M 224 265 L 266 200" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrow-blue)" />

            {/* Column 2: Join & Anomaly Guard */}
            <g onClick={() => setSelectedStage('join')} className="cursor-pointer">
              <rect
                x="272"
                y="62"
                width="190"
                height="226"
                rx="10"
                fill="#ffffff"
                stroke={selectedStage === 'join' ? '#1d4ed8' : '#cbd5e1'}
                strokeWidth={selectedStage === 'join' ? '2.5' : '1.25'}
              />
              <text x="288" y="88" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="11" fontWeight="700" fill="#1d4ed8">
                02. JOIN &amp; AUDIT
              </text>
              <text x="288" y="114" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="13.5" fontWeight="700" fill="#0f172a">
                Relational Joiner
              </text>
              <text x="288" y="132" fontFamily="JetBrains Mono, monospace" fontSize="10.5" fill="#475569">
                key: (date, meal_type)
              </text>

              <line x1="288" y1="150" x2="446" y2="150" stroke="#e2e8f0" strokeWidth="1" />

              <text x="288" y="174" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="12.5" fontWeight="600" fill="#0f172a">
                Z-Score Anomaly Guard
              </text>
              <text x="288" y="192" fontFamily="Public Sans, sans-serif" fontSize="10.5" fill="#475569">
                Flags |z| ≥ 2.0 shocks
              </text>
              <text x="288" y="210" fontFamily="Public Sans, sans-serif" fontSize="10.5" fill="#475569">
                Computes item hotspots
              </text>
              <rect x="288" y="232" width="158" height="36" rx="6" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
              <text x="367" y="254" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="600" fill="#1e40af">
                {enrichedCount} Enriched Rows
              </text>
            </g>

            {/* Connector 2 -> 3 */}
            <path d="M 462 175 L 504 175" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrow-blue)" />

            {/* Column 3: Ridge Regression ML Core */}
            <g onClick={() => setSelectedStage('ridge')} className="cursor-pointer">
              <rect
                x="510"
                y="46"
                width="200"
                height="258"
                rx="10"
                fill="#0f172a"
                stroke={selectedStage === 'ridge' ? '#3b82f6' : '#1e293b'}
                strokeWidth={selectedStage === 'ridge' ? '3' : '1.5'}
              />
              <text x="528" y="74" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="11" fontWeight="700" fill="#60a5fa">
                03. IN-BROWSER ML
              </text>
              <text x="528" y="98" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="14" fontWeight="700" fill="#ffffff">
                Ridge Regression
              </text>
              <text x="528" y="118" fontFamily="JetBrains Mono, monospace" fontSize="10.5" fill="#cbd5e1">
                (XᵀWX + λI)w = XᵀWy
              </text>

              <rect x="528" y="136" width="164" height="72" rx="6" fill="#1e293b" stroke="#334155" strokeWidth="1" />
              <text x="540" y="156" fontFamily="Public Sans, sans-serif" fontSize="10.5" fill="#e2e8f0">
                • 21 Engineered Features
              </text>
              <text x="540" y="174" fontFamily="Public Sans, sans-serif" fontSize="10.5" fill="#e2e8f0">
                • Menu Pull + 14d Drift
              </text>
              <text x="540" y="192" fontFamily="Public Sans, sans-serif" fontSize="10.5" fill="#e2e8f0">
                • Exam × Meal Interactions
              </text>

              <rect x="528" y="222" width="164" height="62" rx="6" fill="#1d4ed8" />
              <text x="610" y="247" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="11.5" fontWeight="700" fill="#ffffff">
                Explainable Forecast
              </text>
              <text x="610" y="266" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="10.5" fill="#dbeafe">
                μ ± 1.645σ (90% CI)
              </text>
            </g>

            {/* Connector 3 -> 4 */}
            <path d="M 710 175 L 752 175" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrow-blue)" />

            {/* Column 4: Newsvendor & 2-Wave Optimizer */}
            <g onClick={() => setSelectedStage('newsvendor')} className="cursor-pointer">
              <rect
                x="758"
                y="62"
                width="176"
                height="226"
                rx="10"
                fill="#ffffff"
                stroke={selectedStage === 'newsvendor' ? '#1d4ed8' : '#cbd5e1'}
                strokeWidth={selectedStage === 'newsvendor' ? '2.5' : '1.25'}
              />
              <text x="774" y="88" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="11" fontWeight="700" fill="#1d4ed8">
                04. OPTIMIZER
              </text>
              <text x="774" y="114" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="13.5" fontWeight="700" fill="#0f172a">
                Newsvendor Split
              </text>
              <text x="774" y="132" fontFamily="JetBrains Mono, monospace" fontSize="10.5" fill="#475569">
                q* = Φ⁻¹(Cs/(Cs+Cw))
              </text>

              <line x1="774" y1="150" x2="918" y2="150" stroke="#e2e8f0" strokeWidth="1" />

              <text x="774" y="174" fontFamily="Public Sans, sans-serif" fontSize="11" fontWeight="600" fill="#0f172a">
                Wave 1 (82% Cook)
              </text>
              <text x="774" y="192" fontFamily="Public Sans, sans-serif" fontSize="11" fontWeight="600" fill="#1d4ed8">
                Wave 2 (18% Reserve)
              </text>
              <text x="774" y="214" fontFamily="Public Sans, sans-serif" fontSize="10.5" fill="#475569">
                Item-wise kg / L / pcs
              </text>
              <text x="774" y="232" fontFamily="Public Sans, sans-serif" fontSize="10.5" fill="#475569">
                Shortage &amp; Waste Risk %
              </text>
              <text x="774" y="250" fontFamily="Public Sans, sans-serif" fontSize="10.5" fill="#b45309" fontWeight="600">
                Staff Action Alerts
              </text>
            </g>

            {/* Connectors 4 -> 5 */}
            <path d="M 934 130 L 966 110" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrow-blue)" />
            <path d="M 934 220 L 966 240" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrow-blue)" />

            {/* Column 5: Outputs & Validation */}
            <g onClick={() => setSelectedStage('outputs')} className="cursor-pointer">
              <rect
                x="972"
                y="46"
                width="126"
                height="120"
                rx="10"
                fill="#ffffff"
                stroke={selectedStage === 'outputs' ? '#1d4ed8' : '#cbd5e1'}
                strokeWidth={selectedStage === 'outputs' ? '2.5' : '1.25'}
              />
              <text x="986" y="72" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="10.5" fontWeight="700" fill="#1d4ed8">
                05A. KITCHEN
              </text>
              <text x="986" y="96" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="12" fontWeight="700" fill="#0f172a">
                Prep Schedule
              </text>
              <text x="986" y="116" fontFamily="Public Sans, sans-serif" fontSize="10.5" fill="#475569">
                Item targets &amp;
              </text>
              <text x="986" y="132" fontFamily="Public Sans, sans-serif" fontSize="10.5" fill="#475569">
                CSV export
              </text>

              <rect
                x="972"
                y="184"
                width="126"
                height="120"
                rx="10"
                fill="#ffffff"
                stroke={selectedStage === 'outputs' ? '#1d4ed8' : '#cbd5e1'}
                strokeWidth={selectedStage === 'outputs' ? '2.5' : '1.25'}
              />
              <text x="986" y="210" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="10.5" fontWeight="700" fill="#0d9488">
                05B. PROOF
              </text>
              <text x="986" y="234" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="12" fontWeight="700" fill="#0f172a">
                Walk-Forward
              </text>
              <text x="986" y="252" fontFamily="Public Sans, sans-serif" fontSize="10.5" fill="#475569">
                Out-of-sample
              </text>
              <text x="986" y="268" fontFamily="Public Sans, sans-serif" fontSize="10.5" fill="#475569">
                AI vs Staff MAE
              </text>
            </g>
          </svg>
        </div>

        {/* Interactive Stage Inspector */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 space-y-1.5">
            <div className="font-mono text-xs font-semibold text-blue-700">
              Stage {active.step} Selected
            </div>
            <h3 className="font-display text-base font-bold text-slate-950">{active.title}</h3>
            <p className="text-xs text-slate-600">{active.subtitle}</p>
          </div>
          <div className="lg:col-span-4 space-y-1.5">
            <div className="text-xs font-semibold text-slate-800">Core Mechanics</div>
            <p className="text-xs text-slate-600 leading-relaxed">{active.mechanics}</p>
          </div>
          <div className="lg:col-span-4 space-y-2">
            <div>
              <div className="text-xs font-semibold text-slate-800">Inputs</div>
              <ul className="mt-1 space-y-0.5 text-[11px] font-mono text-slate-600">
                {active.inputs.map((inp) => (
                  <li key={inp}>· {inp}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800">Outputs</div>
              <ul className="mt-1 space-y-0.5 text-[11px] font-mono text-blue-800">
                {active.outputs.map((out) => (
                  <li key={out}>→ {out}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Stated Modeling & Data Assumptions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] rounded-xl p-6 space-y-3">
          <h2 className="font-display text-base font-semibold text-slate-900">
            01. Stated Synthetic & Operational Assumptions
          </h2>
          <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600 list-disc pl-5 leading-relaxed">
            <li>
              <strong>Hostel Capacity:</strong> Synthetic dataset models a 500-student residential hostel mess across 90 continuous days (360 meals, 1,242 item logs) covering academic weeks, mid-sem/end-sem exams, holidays, a 3-day vacation, and an annual campus fest.
            </li>
            <li>
              <strong>Per-Capita Scaling:</strong> Item preparation quantities scale linearly with predicted attendance using item-specific historical mean and variance of <span className="font-mono">consumed_qty / actual_students</span>.
            </li>
            <li>
              <strong>Unit Equivalence:</strong> Aggregate waste metrics convert liters at 1.0 kg/L and discrete piece items (rotis, samosas, parathas) at 0.055 kg/piece, valued at standard Indian hostel catering unit costs and 2.5 kg CO₂e per kg waste avoided.
            </li>
          </ul>
        </section>

        <section className="bg-white border border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.03)] rounded-xl p-6 space-y-3">
          <h2 className="font-display text-base font-semibold text-slate-900">
            02. Mathematical Formulation Notes
          </h2>
          <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600 list-disc pl-5 leading-relaxed">
            <li>
              <strong>Ridge Regularization (λ = 2.5):</strong> Prevents overfitting on sparse calendar categories (e.g., rare vacations or campus fests) while retaining sensitivity to day-of-week and meal interaction terms.
            </li>
            <li>
              <strong>Unseen Custom Menus:</strong> When staff enter a brand-new menu item absent from the Food Preparation CSV, the engine falls back to category-matched portion norms (pieces vs. gravies/liquids vs. rice/dry dishes).
            </li>
            <li>
              <strong>Walk-Forward Integrity:</strong> Every backtest prediction uses strictly past meal records (<span className="font-mono">[0..t-1]</span>), ensuring zero future data leakage.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
};
