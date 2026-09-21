import React from 'react';
import { Radio, PanelRight, BookOpen } from 'lucide-react';

interface HeaderProps {
  onOpenGuide: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  sessionCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenGuide,
  onToggleSidebar,
  isSidebarOpen,
  sessionCount,
}) => {
  return (
    <header
      id="studio-main-header"
      className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-3 sticky top-0 z-30"
    >
      {/* Brand & Privacy Pill */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-xs shrink-0">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none truncate">
              Edge AI Note Studio
            </h1>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">
              Screen, Video & Audio Notes • 100% Client-Side WebGPU AI
            </p>
          </div>
        </div>

      </div>

      {/* Header Actions: User Guide & Mobile Sessions Drawer Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        {/* User Guide Button */}
        <button
          id="user-guide-header-btn"
          onClick={onOpenGuide}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          title="Open product user guide and shortcuts"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
          <span>User Guide</span>
        </button>

        {/* Right Pane Sessions Toggle (Mobile / Tablet drawer toggle, hidden on lg desktop screens where panel is always open) */}
        <button
          id="toggle-sessions-pane-btn"
          onClick={onToggleSidebar}
          className={`lg:hidden flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
            isSidebarOpen
              ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200'
          }`}
          title="Toggle studio sessions list"
        >
          <PanelRight className="w-4 h-4 text-blue-600" />
          <span className="text-[11px] font-medium">Sessions</span>
          <span className="font-mono text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded-full font-semibold">
            {sessionCount}
          </span>
        </button>
      </div>
    </header>
  );
};
