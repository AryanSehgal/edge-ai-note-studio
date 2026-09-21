import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  Radio,
  Upload,
  Shield,
  Cpu,
  Clock,
  FileText,
  Sparkles,
  Keyboard,
  ChevronRight,
  FolderOpen,
  CheckCircle2,
  Video,
  Music,
  ExternalLink,
} from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type GuideTab = 'getting-started' | 'recording-upload' | 'transcripts-notes' | 'privacy-edge' | 'shortcuts';

export const UserGuideModal: React.FC<UserGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<GuideTab>('getting-started');

  // Close modal on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="user-guide-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="user-guide-dialog"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 id="guide-title" className="text-base font-bold text-slate-900 leading-tight">
                User Guide & Documentation
              </h2>
              <p className="text-xs text-slate-500">
                Master edge transcription, live screen recording, and synchronized note-taking
              </p>
            </div>
          </div>

          <button
            id="close-guide-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Close Guide (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 bg-white border-b border-slate-100 flex items-center gap-1 overflow-x-auto text-xs font-medium text-slate-600">
          <button
            id="guide-tab-started"
            onClick={() => setActiveTab('getting-started')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'getting-started'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
            title="Overview and quick start"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Getting Started</span>
          </button>

          <button
            id="guide-tab-media"
            onClick={() => setActiveTab('recording-upload')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'recording-upload'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
            title="How to record or upload files"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Recording & Uploads</span>
          </button>

          <button
            id="guide-tab-sync"
            onClick={() => setActiveTab('transcripts-notes')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'transcripts-notes'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
            title="Transcript sync and Markdown editor"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Transcripts & Notes</span>
          </button>

          <button
            id="guide-tab-privacy"
            onClick={() => setActiveTab('privacy-edge')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'privacy-edge'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
            title="WebGPU on-device architecture"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Privacy & WebGPU</span>
          </button>

          <button
            id="guide-tab-shortcuts"
            onClick={() => setActiveTab('shortcuts')}
            className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'shortcuts'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
            title="Keyboard shortcuts"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Shortcuts</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-slate-700 text-xs sm:text-sm leading-relaxed">
          {/* TAB 1: GETTING STARTED */}
          {activeTab === 'getting-started' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-xl">
                <h3 className="text-sm font-bold text-blue-950 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Welcome to Edge AI Screen & Audio Note Studio
                </h3>
                <p className="mt-1 text-xs text-blue-900/80 leading-normal">
                  A high-speed, 100% private audio & video transcription workspace that runs local AI models
                  directly in your web browser. No audio is ever uploaded to external cloud servers.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-1.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h4 className="font-bold text-xs text-slate-900">Add or Record Media</h4>
                  <p className="text-[11px] text-slate-500">
                    Record live screen & audio, drop an audio/video file, or click <strong>Sample Audio</strong> or <strong>Sample Video</strong>.
                  </p>
                </div>

                <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-1.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h4 className="font-bold text-xs text-slate-900">On-Device AI Transcription</h4>
                  <p className="text-[11px] text-slate-500">
                    OpenAI Whisper ONNX runs in a background Web Worker accelerated by your computer&apos;s GPU via WebGPU.
                  </p>
                </div>

                <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/50 space-y-1.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <h4 className="font-bold text-xs text-slate-900">Interactive Notes & Sync</h4>
                  <p className="text-[11px] text-slate-500">
                    Click any transcript line or timestamp pill to jump playback. Write and format notes with markdown.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h4 className="text-xs font-bold text-slate-900 mb-2">Key Areas of the Studio:</h4>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span><strong>Top Header:</strong> Quick access to Upload File, Record Live, User Guide, and Model Hardware Status.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span><strong>Waveform Scrubber:</strong> Zoomable audio waveform with scrubbing, speed controls (0.75x–2x), and synced video preview.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span><strong>Transcript View (Left):</strong> Searchable, editable speech segments with timestamps and &quot;Send to Notes&quot; button.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span><strong>Studio Notes (Right):</strong> Split-view Markdown editor with auto-save, timestamp insertion, and .md download.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span><strong>Studio Sessions (Right Pane):</strong> Manage all your past and new note sessions securely.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: RECORDING & UPLOADS */}
          {activeTab === 'recording-upload' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-blue-600" />
                  Live Recording Studio
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Capture high-quality audio directly from your browser with no software installation required.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50/50">
                  <span className="font-bold text-xs text-slate-900 block">🖥️ Screen + Mic</span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Records your display (presentation, meeting, browser tab) while capturing your voice commentary simultaneously.
                  </p>
                </div>
                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50/50">
                  <span className="font-bold text-xs text-slate-900 block">🔊 Screen Audio Only</span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Captures system audio or video conference audio directly from a tab or window without background microphone noise.
                  </p>
                </div>
                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50/50">
                  <span className="font-bold text-xs text-slate-900 block">🎤 Mic Only</span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Ideal for rapid voice memos, personal dictation, or lecture recordings.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-600" />
                  Uploading Existing Files
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Click <strong>Upload File</strong> or drag and drop any media file:
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {['MP3', 'WAV', 'M4A', 'FLAC', 'AAC', 'WebM', 'MP4', 'MOV'].map((fmt) => (
                    <span
                      key={fmt}
                      className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-mono text-[11px] font-medium"
                    >
                      .{fmt.toLowerCase()}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Audio tracks are extracted and resampled client-side to standard 16kHz float arrays ready for the Whisper model.
                </p>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Music className="w-4 h-4 text-blue-600" />
                  Instant Testing Samples
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Don&apos;t have an audio file ready? Use the <strong>Sample Audio</strong> or <strong>Sample Video</strong> buttons in the action bar or dialogs to immediately test transcription without recording!
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: TRANSCRIPTS & NOTES */}
          {activeTab === 'transcripts-notes' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Two-Way Bidirectional Synchronization
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Audio playback and notes work together seamlessly:
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50/50 flex items-start gap-2.5">
                  <div className="p-1 rounded bg-blue-100 text-blue-700 shrink-0 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">Clicking Transcripts:</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Click any sentence in the transcript list to instantly jump the audio scrubber (and synchronized video) to that exact point in time.
                    </p>
                  </div>
                </div>

                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50/50 flex items-start gap-2.5">
                  <div className="p-1 rounded bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">Inserting Timestamps in Notes:</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      In the Markdown Note Editor toolbar, click the timestamp button <code className="bg-blue-50 text-blue-700 px-1 py-0.5 rounded font-mono text-[10px] font-bold">[00:15]</code> to insert the current playback time into your notes. In preview mode, clicking that pill jumps the audio!
                    </p>
                  </div>
                </div>

                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50/50 flex items-start gap-2.5">
                  <div className="p-1 rounded bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900">Send Segment to Notes:</span>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Hover over any transcript segment and click the <strong>+ Notes</strong> button to append that text into your active Markdown note.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h4 className="text-xs font-bold text-slate-900 mb-1">Exporting & Saving:</h4>
                <p className="text-xs text-slate-500">
                  Notes auto-save continuously in local storage and backend sync. Use the toolbar buttons to <strong>Copy Markdown</strong> or <strong>Download .md</strong> at any time.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: PRIVACY & WEBGPU */}
          {activeTab === 'privacy-edge' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-xl">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  100% Client-Side Privacy Guarantee
                </h3>
                <p className="mt-1 text-xs text-emerald-900/80 leading-normal">
                  Traditional transcription services stream your audio, meetings, and confidential presentations to third-party cloud servers. Edge AI Note Studio processes everything locally inside your browser sandbox.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2.5 p-2.5 border border-slate-100 rounded-lg">
                  <Cpu className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900">WebGPU Hardware Acceleration:</span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      If supported by your browser (Chrome, Edge, Brave), neural network tensor operations are executed directly on your graphics card for maximum speed.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 border border-slate-100 rounded-lg">
                  <Cpu className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900">WebAssembly (WASM) Fallback:</span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      On devices without WebGPU, the studio seamlessly runs on your multi-threaded CPU using WebAssembly.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 border border-slate-100 rounded-lg">
                  <FolderOpen className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900">Browser Cache & IndexedDB:</span>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      Model weights (~75MB for Whisper Tiny) are cached in browser CacheStorage so subsequent visits load instantly without redownloading.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: KEYBOARD SHORTCUTS */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-blue-600" />
                  Keyboard Shortcuts & Controls
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Boost your note-taking speed with integrated shortcuts:
                </p>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-slate-50/50">
                  <span className="text-xs font-medium text-slate-700">Play / Pause Audio</span>
                  <kbd className="px-2.5 py-1 bg-white border border-slate-300 rounded shadow-2xs text-[11px] font-mono font-semibold text-slate-800">
                    Space
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-3 bg-white">
                  <span className="text-xs font-medium text-slate-700">Close Any Modal / Dialog</span>
                  <kbd className="px-2.5 py-1 bg-white border border-slate-300 rounded shadow-2xs text-[11px] font-mono font-semibold text-slate-800">
                    Esc
                  </kbd>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50/50">
                  <span className="text-xs font-medium text-slate-700">Jump 5 Seconds Backward</span>
                  <span className="text-xs text-slate-500">Click &quot;↺ 5s&quot; button</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-white">
                  <span className="text-xs font-medium text-slate-700">Jump 5 Seconds Forward</span>
                  <span className="text-xs text-slate-500">Click &quot;↻ 5s&quot; button</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50/50">
                  <span className="text-xs font-medium text-slate-700">Adjust Waveform Zoom</span>
                  <span className="text-xs text-slate-500">Click + / - zoom buttons</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-white">
                  <span className="text-xs font-medium text-slate-700">Variable Playback Speed</span>
                  <span className="text-xs text-slate-500">Select 0.75x, 1x, 1.25x, 1.5x, 2x</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <a
            id="creator-guide-footer-link"
            href="https://github.com/AryanSehgal"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 group cursor-pointer"
            title="Product built by Aryan Sehgal • Visit GitHub Profile"
          >
            <img
              src="/creator-aryan.png"
              alt="Aryan Sehgal"
              className="w-6 h-6 rounded-full object-cover border border-blue-500 group-hover:scale-105 transition-transform shrink-0"
            />
            <div className="text-xs">
              <span className="text-slate-500">Built by </span>
              <span className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">Aryan Sehgal</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" />
          </a>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>Zero server data transfer • 100% browser execution</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer"
              title="Got it, back to studio"
            >
              Got It
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
