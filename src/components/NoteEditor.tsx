import React, { useState, useRef, useId } from 'react';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Clock,
  Download,
  Copy,
  Check,
  Columns,
  Eye,
  Edit3,
  Sparkles,
} from 'lucide-react';

interface NoteEditorProps {
  markdown: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  currentTime: number;
  onJumpToTime: (time: number) => void;
  isSaving?: boolean;
  lastSavedAt?: string | null;
  onGenerateAIKeynotes?: () => void;
  isGeneratingKeynotes?: boolean;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  markdown,
  onChange,
  onSave,
  currentTime,
  onJumpToTime,
  isSaving = false,
  lastSavedAt,
  onGenerateAIKeynotes,
  isGeneratingKeynotes = false,
}) => {
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const uniqueId = useId();

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const insertText = (before: string, after = '', defaultPlaceholder = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = markdown.substring(start, end) || defaultPlaceholder;

    const newContent = markdown.substring(0, start) + before + selected + after + markdown.substring(end);
    onChange(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const insertTimestamp = () => {
    const ts = `[${formatTimestamp(currentTime)}]`;
    insertText(`${ts} `);
  };

  const insertMeetingTemplate = () => {
    const template = `\n## 📋 Meeting & Session Summary\n- **Date:** ${new Date().toLocaleDateString()}\n- **Duration:** ${formatTimestamp(currentTime)}\n\n### 🎯 Key Objectives\n1. \n2. \n\n### 💡 Main Discussion Points\n- [${formatTimestamp(0)}] \n- \n\n### ✅ Action Items\n- [ ] Task 1 (Assignee: )\n- [ ] Task 2 (Assignee: )\n\n### 📝 Detailed Notes\n\n`;
    onChange((markdown.trim() ? markdown + '\n\n' : '') + template);
  };

  const copyMarkdown = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportMarkdownFile = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Simple Markdown renderer with interactive timestamp buttons
  const renderMarkdownPreview = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="prose prose-sm max-w-none text-slate-800 space-y-2 text-xs leading-relaxed">
        {lines.map((line, i) => {
          // Headers
          if (line.startsWith('# ')) {
            return (
              <h1 key={i} className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-1 mt-3">
                {line.slice(2)}
              </h1>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <h2 key={i} className="text-base font-semibold text-slate-900 mt-2.5">
                {line.slice(3)}
              </h2>
            );
          }
          if (line.startsWith('### ')) {
            return (
              <h3 key={i} className="text-sm font-semibold text-slate-800 mt-2">
                {line.slice(4)}
              </h3>
            );
          }
          // Checklists
          if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
            const checked = line.startsWith('- [x] ');
            const label = line.slice(6);
            return (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="rounded border-slate-300 text-blue-600 focus:ring-0"
                />
                <span className={checked ? 'line-through text-slate-400' : 'text-slate-700'}>
                  {renderLineWithTimestamps(label)}
                </span>
              </div>
            );
          }
          // Bullet list
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <li key={i} className="ml-4 list-disc text-slate-700">
                {renderLineWithTimestamps(line.slice(2))}
              </li>
            );
          }
          // Numbered list
          const numMatch = line.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            return (
              <li key={i} className="ml-4 list-decimal text-slate-700">
                {renderLineWithTimestamps(numMatch[2])}
              </li>
            );
          }
          // Blockquote
          if (line.startsWith('> ')) {
            return (
              <blockquote
                key={i}
                className="border-l-3 border-blue-500 bg-blue-50/50 pl-3 py-1 my-1 text-slate-600 italic"
              >
                {renderLineWithTimestamps(line.slice(2))}
              </blockquote>
            );
          }
          // Code block indicator or inline
          if (line.startsWith('```')) {
            return (
              <div key={i} className="font-mono text-[11px] bg-slate-900 text-slate-100 p-2 rounded-md">
                {line}
              </div>
            );
          }
          // Blank line
          if (!line.trim()) {
            return <div key={i} className="h-2" />;
          }

          return <p key={i}>{renderLineWithTimestamps(line)}</p>;
        })}
      </div>
    );
  };

  // Convert timestamp tags like [01:23] into clickable audio scrub triggers
  const renderLineWithTimestamps = (text: string) => {
    const timestampRegex = /\[(\d{1,2}:\d{2})\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = timestampRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const timeStr = match[1];
      const [m, s] = timeStr.split(':').map(Number);
      const totalSeconds = m * 60 + s;

      parts.push(
        <button
          key={match.index}
          onClick={() => onJumpToTime(totalSeconds)}
          className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-blue-100 hover:bg-blue-200 text-blue-800 transition-colors"
          title={`Jump audio to ${timeStr}`}
        >
          <Clock className="w-2.5 h-2.5 inline" />
          {timeStr}
        </button>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  const wordCount = markdown.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div id="note-editor-card" className="flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Header bar */}
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight whitespace-nowrap">
            Studio Notes
          </h2>
          <span className="text-[10px] sm:text-[11px] text-slate-500 font-mono whitespace-nowrap hidden sm:inline">
            {wordCount} words • {markdown.length} chars
          </span>
          {isSaving ? (
            <span className="text-[10px] text-blue-600 animate-pulse font-medium whitespace-nowrap">
              Saving...
            </span>
          ) : lastSavedAt ? (
            <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap hidden md:inline">
              Synced {new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-slate-600 shadow-2xs">
            <button
              id="view-edit-btn"
              onClick={() => setViewMode('edit')}
              className={`px-1.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'edit' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
              }`}
              title="Editor only"
              aria-label="Editor only view"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              id="view-split-btn"
              onClick={() => setViewMode('split')}
              className={`px-1.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'split' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
              }`}
              title="Split view (Editor + Preview)"
              aria-label="Split view (Editor + Preview)"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
            <button
              id="view-preview-btn"
              onClick={() => setViewMode('preview')}
              className={`px-1.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'preview' ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
              }`}
              title="Preview only"
              aria-label="Preview only view"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Copy Button */}
          <button
            id="copy-markdown-btn"
            onClick={copyMarkdown}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Copy Markdown"
            aria-label="Copy Markdown"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Export Markdown file */}
          <button
            id="export-markdown-btn"
            onClick={exportMarkdownFile}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Download .md file"
            aria-label="Download .md file"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Formatting Toolbar */}
      {viewMode !== 'preview' && (
        <div className="px-2.5 py-1.5 border-b border-slate-100 bg-white flex items-center flex-wrap gap-1 text-slate-600 text-xs shrink-0">
          <button
            onClick={() => insertText('**', '**', 'bold text')}
            className="p-1 hover:bg-slate-100 rounded transition-colors shrink-0 cursor-pointer"
            title="Bold (**text**)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertText('*', '*', 'italic text')}
            className="p-1 hover:bg-slate-100 rounded transition-colors shrink-0 cursor-pointer"
            title="Italic (*text*)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <div className="h-3 w-px bg-slate-200 mx-0.5 shrink-0" />
          <button
            onClick={() => insertText('# ', '', 'Heading 1')}
            className="p-1 hover:bg-slate-100 rounded transition-colors shrink-0 cursor-pointer"
            title="Heading 1"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertText('## ', '', 'Heading 2')}
            className="p-1 hover:bg-slate-100 rounded transition-colors shrink-0 cursor-pointer"
            title="Heading 2"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <div className="h-3 w-px bg-slate-200 mx-0.5 shrink-0" />
          <button
            onClick={() => insertText('- ', '', 'List item')}
            className="p-1 hover:bg-slate-100 rounded transition-colors shrink-0 cursor-pointer"
            title="Bullet List"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertText('1. ', '', 'First item')}
            className="p-1 hover:bg-slate-100 rounded transition-colors shrink-0 cursor-pointer"
            title="Numbered List"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertText('- [ ] ', '', 'Action item')}
            className="p-1 hover:bg-slate-100 rounded transition-colors shrink-0 cursor-pointer"
            title="Task Checklist"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertText('> ', '', 'Quoted thought')}
            className="p-1 hover:bg-slate-100 rounded transition-colors shrink-0 cursor-pointer"
            title="Blockquote"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertText('`', '`', 'code')}
            className="p-1 hover:bg-slate-100 rounded transition-colors shrink-0 cursor-pointer"
            title="Code"
          >
            <Code className="w-3.5 h-3.5" />
          </button>

          <div className="h-3 w-px bg-slate-200 mx-0.5 shrink-0" />

          {/* Timestamp insertion button */}
          <button
            id="insert-timestamp-btn"
            onClick={insertTimestamp}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors shrink-0 text-[11px] cursor-pointer"
            title="Insert audio timestamp"
          >
            <Clock className="w-3 h-3" />
            <span>[{formatTimestamp(currentTime)}]</span>
          </button>

          {/* Quick template button */}
          <button
            id="insert-template-btn"
            onClick={insertMeetingTemplate}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors shrink-0 text-[11px] cursor-pointer"
            title="Insert structured meeting notes template"
          >
            <span>Template</span>
          </button>

          {/* AI Keynotes generator button */}
          {onGenerateAIKeynotes && (
            <button
              id="generate-ai-keynotes-btn"
              onClick={onGenerateAIKeynotes}
              disabled={isGeneratingKeynotes}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium transition-colors shrink-0 text-[11px] cursor-pointer disabled:opacity-50"
              title="Auto-generate keynote highlights, executive summary, and action items from transcripts"
            >
              <Sparkles className={`w-3 h-3 text-indigo-600 ${isGeneratingKeynotes ? 'animate-spin' : ''}`} />
              <span>{isGeneratingKeynotes ? 'Edge LLM Running...' : 'Edge LLM Title & Notes'}</span>
            </button>
          )}
        </div>
      )}

      {/* Editor & Preview Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Pane */}
        {viewMode !== 'preview' && (
          <div className={`flex-1 flex flex-col h-full ${viewMode === 'split' ? 'border-r border-slate-200' : ''}`}>
            <textarea
              ref={textareaRef}
              id={`markdown-textarea-${uniqueId}`}
              value={markdown}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Write your session notes in Markdown... Click [01:23] buttons to jump audio playback to that moment!"
              className="flex-1 p-3 text-xs font-mono leading-relaxed resize-none focus:outline-hidden text-slate-800 bg-white placeholder-slate-400"
            />
          </div>
        )}

        {/* Live Preview Pane */}
        {viewMode !== 'edit' && (
          <div id="markdown-preview-pane" className="flex-1 p-3 overflow-y-auto bg-slate-50/40">
            {markdown.trim() ? (
              renderMarkdownPreview(markdown)
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Markdown preview will appear here as you type
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
