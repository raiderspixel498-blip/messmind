import { useMemo, useState } from 'react';
import { ArchitectureView } from './components/ArchitectureView';
import { BacktestView } from './components/BacktestView';
import { DashboardView } from './components/DashboardView';
import { DataCSVView } from './components/DataCSVView';
import { PlannerView } from './components/PlannerView';
import { AppTab, TopBar } from './components/TopBar';
import { WastageView } from './components/WastageView';
import { generateSyntheticDataset } from './data/syntheticGenerator';
import { enrichDataset, trainAttendanceModel } from './engine/predictor';
import { DatasetBundle } from './types/mess';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [dataset, setDataset] = useState<DatasetBundle>(() => generateSyntheticDataset(90));

  const enrichedHistory = useMemo(() => enrichDataset(dataset), [dataset]);
  const trainedModel = useMemo(() => trainAttendanceModel(enrichedHistory), [enrichedHistory]);

  const handleResetSynthetic = () => {
    setDataset(generateSyntheticDataset(90));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8FB] text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenUpload={() => setActiveTab('data')}
      />

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
        {activeTab === 'dashboard' && (
          <DashboardView
            history={enrichedHistory}
            calendar={dataset.calendar}
            model={trainedModel}
            onNavigate={setActiveTab}
          />
        )}
        {activeTab === 'planner' && (
          <PlannerView
            history={enrichedHistory}
            calendar={dataset.calendar}
            model={trainedModel}
          />
        )}
        {activeTab === 'wastage' && <WastageView history={enrichedHistory} />}
        {activeTab === 'backtest' && <BacktestView history={enrichedHistory} />}
        {activeTab === 'data' && (
          <DataCSVView
            dataset={dataset}
            onUpdateDataset={setDataset}
            onResetSynthetic={handleResetSynthetic}
          />
        )}
        {activeTab === 'architecture' && (
          <ArchitectureView dataset={dataset} enrichedCount={enrichedHistory.length} />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>PlateWise · Client-side hostel mess demand & waste predictor (zero backend, zero API keys)</span>
          <span className="font-mono tabular-nums">
            {enrichedHistory.length} historical meals · {dataset.foodPrep.length} item prep logs · {dataset.calendar.length} calendar days
          </span>
        </div>
      </footer>
    </div>
  );
}
