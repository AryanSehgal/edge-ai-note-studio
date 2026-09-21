import React, { useState, useMemo } from 'react';
import { TranscriptSegment } from '../types';
import { Search, Download, Copy, Check, Clock, Edit2, Sparkles, RefreshCw } from 'lucide-react';

interface TranscriptViewProps {
  segments: TranscriptSegment[];
  currentTime: number;
  onJumpToTime: (time: number) => void;
  onUpdateSegment: (segmentId: string, newText: string) => void;
  onSendToNotes?: (text: string) => void;
  hasAudio?: boolean;
  isTranscribing?: boolean;
  onTriggerTranscription?: () => void;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  segments,
  currentTime,
  onJumpToTime,
  onUpdateSegment,
  onSendToNotes,
  hasAudio = false,
  isTranscribing = false,
  onTriggerTranscription,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [copied, setCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  // Active segment identification based on current audio playback time
  const activeSegmentIndex = useMemo(() => {
    return segments.findIndex((seg) => currentTime >= seg.startTime && currentTime <= seg.endTime);
  }, [segments, currentTime]);

  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return segments;
    const q = searchQuery.toLowerCase();
    return segments.filter((s) => s.textContent.toLowerCase().includes(q));
  }, [segments, searchQuery]);

  const totalWords = useMemo(() => {
    return segments.reduce((sum, s) => sum + s.textContent.trim().split(/\s+/).filter(Boolean).length, 0);
  }, [segments]);

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleStartEdit = (seg: TranscriptSegment) => {
    setEditingId(seg.id);
    setEditText(seg.textContent);
  };

  const handleSaveEdit = (id: string) => {
    if (editText.trim()) {
      onUpdateSegment(id, editText.trim());
    }
    setEditingId(null);
  };

  const copyFullTranscript = () => {
    const fullText = segments
      .map((s) => `[${formatTimestamp(s.startTime)} - ${formatTimestamp(s.endTime)}] ${s.textContent}`)
      .join('\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportAs = (format: 'txt' | 'srt' | 'vtt' | 'json') => {
    let content = '';
    let mimeType = 'text/plain';
    let filename = `transcript_${Date.now()}.${format}`;

    if (format === 'txt') {
      content = segments.map((s) => `[${formatTimestamp(s.startTime)}] ${s.textContent}`).join('\n\n');
    } else if (format === 'srt') {
      content = segments
        .map((s, idx) => {
          const start = formatSrtTime(s.startTime);
          const end = formatSrtTime(s.endTime);
          return `${idx + 1}\n${start} --> ${end}\n${s.textContent}\n`;
        })
        .join('\n');
    } else if (format === 'vtt') {
      content =
        'WEBVTT\n\n' +
        segments
          .map((s, idx) => {
            const start = formatVttTime(s.startTime);
            const end = formatVttTime(s.endTime);
            return `${idx + 1}\n${start} --> ${end}\n${s.textContent}\n`;
          })
          .join('\n');
    } else if (format === 'json') {
      mimeType = 'application/json';
      content = JSON.stringify(segments, null, 2);
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  function formatSrtTime(secs: number) {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 1000);
    return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
  }

  function formatVttTime(secs: number) {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 1000);
    return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(s, 2)}.${pad(ms, 3)}`;
  }

  function pad(num: number, size: number) {
    let s = num + '';
    while (s.length < size) s = '0' + s;
    return s;
  }

  return (
    <div id="transcript-view-container" className="flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Header bar */}
      <div className="px-3 py-2.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/60 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 shrink">
          <h2 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight whitespace-nowrap">
            Edge Transcript
          </h2>
          <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200/60 whitespace-nowrap shrink-0">
            {segments.length} <span className="hidden sm:inline">segments</span><span className="sm:hidden">segs</span>
            <span className="hidden xl:inline"> • {totalWords} words</span>
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-1.5 shrink-0">
          {/* Transcribe / Re-transcribe Action Button */}
          {onTriggerTranscription && (
            <button
              id="trigger-transcription-btn"
              onClick={onTriggerTranscription}
              disabled={!hasAudio || isTranscribing}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 font-semibold rounded-lg shadow-2xs transition-all ${
                isTranscribing
                  ? 'bg-blue-100 text-blue-800 border border-blue-200 cursor-not-allowed'
                  : !hasAudio
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white cursor-pointer shadow-xs'
              }`}
              title={
                isTranscribing
                  ? 'Transcription in progress...'
                  : !hasAudio
                  ? 'Record or load audio first to transcribe'
                  : 'Generate or re-run Speech AI transcription'
              }
            >
              {isTranscribing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>Transcribing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{segments.length > 0 ? 'Re-transcribe' : 'Transcribe'}</span>
                </>
              )}
            </button>
          )}

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              id="transcript-search-input"
              type="text"
              placeholder="Search..."
              aria-label="Search transcript segments"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs pl-7 pr-2 py-1 w-20 sm:w-28 focus:w-36 transition-all duration-150 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 shadow-2xs"
            />
          </div>

          {/* Copy button */}
          <button
            id="copy-transcript-btn"
            onClick={copyFullTranscript}
            disabled={segments.length === 0 || isTranscribing}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
            title="Copy full transcript"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Export dropdown */}
          <div className="relative group">
            <button
              id="export-transcript-btn"
              disabled={segments.length === 0 || isTranscribing}
              onClick={() => setExportOpen((v) => !v)}
              className="flex items-center gap-1 text-xs px-2 py-1 text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-40 cursor-pointer shadow-2xs font-medium"
              title="Export transcript (.txt, .srt, .vtt, .json)"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
            </button>
            <div
              className={`absolute right-0 top-full mt-1 w-28 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20 text-xs ${
                exportOpen ? 'block' : 'hidden group-hover:block'
              }`}
            >
              <button
                onClick={() => { exportAs('txt'); setExportOpen(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 cursor-pointer"
              >
                Text (.txt)
              </button>
              <button
                onClick={() => { exportAs('srt'); setExportOpen(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 cursor-pointer"
              >
                SubRip (.srt)
              </button>
              <button
                onClick={() => { exportAs('vtt'); setExportOpen(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 cursor-pointer"
              >
                WebVTT (.vtt)
              </button>
              <button
                onClick={() => { exportAs('json'); setExportOpen(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 cursor-pointer"
              >
                JSON (.json)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Segments List */}
      <div id="transcript-segments-scroll" className="flex-1 overflow-y-auto p-3 space-y-2">
        {isTranscribing ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-blue-100 flex items-center justify-center bg-blue-50/70">
                <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
              </div>
              <Sparkles className="w-4 h-4 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">Transcribing Audio...</p>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Speech AI pipeline is generating sentence-level timestamps. Studio controls and media switching are locked.
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-[11px] text-blue-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
              <span>Edge WebGPU / Speech Engine Active</span>
            </div>
          </div>
        ) : filteredSegments.length === 0 ? (
          hasAudio ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3.5 text-slate-500">
              <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800">Audio Recorded & Ready</p>
                <p className="text-xs text-slate-500 max-w-xs">
                  Your audio recording is loaded. Click the button below to generate full timestamped transcripts.
                </p>
              </div>
              {onTriggerTranscription && (
                <button
                  id="empty-state-transcribe-btn"
                  onClick={onTriggerTranscription}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Generate Transcripts Now</span>
                </button>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <Clock className="w-8 h-8 mb-2 stroke-1 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No transcript segments yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Start screen/mic recording or load sample audio. Speech AI will transcribe spoken audio into synchronized segments.
              </p>
            </div>
          )
        ) : (
          filteredSegments.map((segment, idx) => {
            const isActive = activeSegmentIndex === idx;
            const isEditing = editingId === segment.id;

            return (
              <div
                key={segment.id || idx}
                id={`transcript-segment-${segment.id}`}
                onClick={() => onJumpToTime(segment.startTime)}
                className={`group relative rounded-lg p-2.5 transition-all duration-150 cursor-pointer border ${
                  isActive
                    ? 'bg-blue-50/80 border-blue-300 text-slate-900 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-transparent hover:border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Timestamp Pill */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onJumpToTime(segment.startTime);
                    }}
                    className={`shrink-0 font-mono text-[11px] px-2 py-0.5 rounded-md font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                    }`}
                    title="Jump audio scrubber here"
                  >
                    {formatTimestamp(segment.startTime)}
                  </button>

                  {/* Text Content */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="space-y-1.5"
                      >
                        <textarea
                          id={`edit-segment-input-${segment.id}`}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={2}
                          className="w-full text-xs p-2 bg-white border border-blue-400 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-[11px] px-2 py-0.5 text-slate-600 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEdit(segment.id)}
                            className="text-[11px] px-2 py-0.5 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={`text-xs leading-relaxed ${isActive ? 'font-medium text-slate-900' : 'text-slate-700'}`}>
                        {segment.textContent}
                      </p>
                    )}
                  </div>

                  {/* Actions (visible on hover on desktop, always visible on touch) */}
                  {!isEditing && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 transition-opacity shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <button
                        onClick={() => handleStartEdit(segment)}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded"
                        title="Edit text"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {onSendToNotes && (
                        <button
                          onClick={() => onSendToNotes(`- [${formatTimestamp(segment.startTime)}] ${segment.textContent}`)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Send to Notes"
                        >
                          <Sparkles className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
