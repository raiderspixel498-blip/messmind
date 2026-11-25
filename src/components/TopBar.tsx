import React from 'react';
import { Upload } from 'lucide-react';

export type AppTab = 'dashboard' | 'planner' | 'wastage' | 'backtest' | 'architecture' | 'data';

interface TopBarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onOpenUpload: () => void;
}

const NAV_ITEMS: { id: AppTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'planner', label: 'Meal Planner' },
  { id: 'wastage', label: 'Wastage Hotspots' },
  { id: 'backtest', label: 'Backtest' },
  { id: 'architecture', label: 'Architecture' },
];

export const TopBar: React.FC<TopBarProps> = ({ activeTab, onSelectTab, onOpenUpload }) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          className="inline-flex items-center gap-2.5 font-display text-[17px] font-bold tracking-[-0.02em] text-slate-950 whitespace-nowrap shrink-0 hover:text-blue-800 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 rounded-md"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-blue-700 shrink-0"
          >
            <rect x="2" y="3" width="20" height="18" rx="4" stroke="currentColor" strokeWidth="1.75" />
            <path d="M7 15V11M12 15V8M17 15V12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          PlateWise
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7 overflow-x-auto" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-5 text-[13.5px] tracking-[-0.01em] whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-blue-700 ${
                  isActive
                    ? 'font-semibold text-slate-950'
                    : 'font-medium text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
                <span
                  className={`absolute inset-x-0 bottom-0 h-[2px] rounded-full transition-opacity duration-150 ${
                    isActive ? 'bg-blue-700 opacity-100' : 'bg-slate-300 opacity-0'
                  }`}
                />
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary CTA */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenUpload}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors duration-150 shadow-[0_1px_2px_rgba(15,23,42,0.08)] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
              activeTab === 'data' ? 'bg-blue-700 hover:bg-blue-800' : 'bg-slate-900 hover:bg-blue-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            Import CSVs
          </button>
        </div>
      </div>

      {/* Mobile navigation strip */}
      <nav
        className="flex md:hidden items-center gap-5 px-4 overflow-x-auto border-t border-slate-100 bg-slate-50/60"
        aria-label="Mobile navigation"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative py-2.5 text-xs whitespace-nowrap shrink-0 transition-colors duration-150 ${
                isActive
                  ? 'font-semibold text-blue-800 border-b-2 border-blue-700'
                  : 'font-medium text-slate-500 hover:text-slate-900 border-b-2 border-transparent'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
