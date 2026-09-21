import React, { useState } from 'react';
import { SessionSummary } from '../types';
import {
  Folder,
  Trash2,
  Clock,
  FileText,
  Search,
  Plus,
  AudioLines,
  X,
  Film,
} from 'lucide-react';

interface SessionSidebarProps {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewSession: () => void;
  isOpen: boolean;
  onToggle: () => void;
  isTranscribing?: boolean;
}

export const SessionSidebar: React.FC<SessionSidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewSession,
  isOpen,
  onToggle,
  isTranscribing = false,
}) => {
  const [search, setSearch] = useState('');

  const filteredSessions = sessions.filter((s) =>
    (s.title || '').toLowerCase().includes(search.toLowerCase())
  );

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${secs}`;
  };

  const renderContent = (isMobileDrawer = false) => (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Sidebar Header: Compact, balanced grouping of Studio Sessions and New Session */}
      <div className="px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2 bg-white shrink-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <Folder className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="text-xs font-bold text-slate-800 tracking-tight whitespace-nowrap">Studio Sessions</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-mono font-semibold shrink-0">
            {sessions.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            id={isMobileDrawer ? 'mobile-new-session-sidebar-btn' : 'new-session-sidebar-btn'}
            onClick={onNewSession}
            disabled={isTranscribing}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 active:scale-95 border border-blue-200 rounded-lg transition-all cursor-pointer whitespace-nowrap shadow-2xs shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isTranscribing ? 'Transcription in progress...' : 'Create fresh studio session'}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Session</span>
          </button>

          {isMobileDrawer && (
            <button
              onClick={onToggle}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 active:scale-90 transition-all cursor-pointer shrink-0 ml-1"
              title="Close sessions drawer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search box */}
      <div className="p-2 border-b border-slate-200/80 bg-slate-50 shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id={isMobileDrawer ? 'mobile-search-sessions-input' : 'search-sessions-input'}
            type="text"
            placeholder="Search studio sessions..."
            aria-label="Search studio sessions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={isTranscribing}
            className="w-full text-[11px] pl-7 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 disabled:opacity-60"
          />
        </div>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
        {filteredSessions.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <AudioLines className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500 font-medium">No sessions found</p>
            <p className="text-[11px] text-slate-400">
              Click &quot;New Session&quot; to start a fresh note.
            </p>
          </div>
        ) : (
          filteredSessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <div
                key={session.id}
                id={`session-item-${session.id}`}
                onClick={() => {
                  if (isTranscribing) return;
                  onSelectSession(session.id);
                  if (isMobileDrawer) onToggle();
                }}
                className={`group relative p-3 rounded-xl border text-left transition-all ${
                  isTranscribing ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                } ${
                  isActive
                    ? 'bg-blue-50/90 border-blue-400 text-blue-950 shadow-xs ring-1 ring-blue-300'
                    : 'bg-white hover:bg-slate-100/80 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold truncate leading-tight">
                      {session.title || 'Untitled Studio Session'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                      <span className="flex items-center gap-0.5 font-mono">
                        <Clock className="w-2.5 h-2.5 text-slate-400" />
                        {formatDuration(session.duration_seconds || 0)}
                      </span>
                      <span>•</span>
                      <span className="truncate">
                        {new Date(session.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Delete Session Button */}
                  <button
                    id={`delete-session-btn-${session.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isTranscribing) return;
                      onDeleteSession(session.id);
                    }}
                    disabled={isTranscribing}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title={isTranscribing ? 'Locked during transcription' : 'Delete session'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-2 flex items-center gap-1.5 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono font-medium">
                    {session.transcript_count || 0} segments
                  </span>
                  {(session.has_video || session.hasVideo) && (
                    <span className="flex items-center gap-0.5 text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md font-medium border border-indigo-100">
                      <Film className="w-2.5 h-2.5" />
                      <span>Video</span>
                    </span>
                  )}
                  {session.has_notes && (
                    <span className="flex items-center gap-0.5 text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md font-medium border border-emerald-100">
                      <FileText className="w-2.5 h-2.5" />
                      <span>Notes</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Mobile Drawer (Screens < lg): Floating Slide-Over Pane */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
            onClick={onToggle}
          />
          {/* Slide-over floating drawer with generous comfortable width */}
          <div className="relative w-84 max-w-[88vw] bg-white shadow-2xl h-full z-10 flex flex-col">
            {renderContent(true)}
          </div>
        </div>
      )}

      {/* 2. Desktop Permanent Sidebar (Screens >= lg): Always shown on the right side */}
      <aside
        id="session-history-sidebar"
        className="hidden lg:flex relative w-72 xl:w-80 bg-slate-50 border-l border-slate-200 flex-col z-20 shrink-0 h-full"
      >
        {renderContent(false)}
      </aside>
    </>
  );
};
