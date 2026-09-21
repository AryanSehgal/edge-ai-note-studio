import { TranscriptSegment } from '../types';

export interface StudioNotesOptions {
  title: string;
  durationSeconds: number;
  speechModelUsed: string;
  mediaType: 'video' | 'audio' | 'screen' | 'upload' | 'sample';
  transcripts: TranscriptSegment[];
  executiveSummary?: string;
  keynotes?: string[];
  actionItems?: string[];
}

export function formatTimeSeconds(totalSecs: number): string {
  const mins = Math.floor(totalSecs / 60);
  const secs = Math.floor(totalSecs % 60);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Automatically builds rich, structured Markdown notes for a studio session
 * incorporating session title, formatted duration, speech AI model used,
 * keynote highlights with clickable timestamps, executive takeaways, and action items.
 */
export function generateStudioNotesMarkdown(options: StudioNotesOptions): string {
  const {
    title,
    durationSeconds,
    speechModelUsed,
    mediaType,
    transcripts = [],
    executiveSummary,
    keynotes,
    actionItems,
  } = options;

  const formattedDuration = `${formatTimeSeconds(durationSeconds)} (${Math.round(durationSeconds)}s)`;
  const dateString = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeString = new Date().toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const mediaTypeLabel =
    mediaType === 'video' || mediaType === 'screen'
      ? '🎬 Video & Screen Recording'
      : mediaType === 'sample'
      ? '🎵 Presentation Media Sample'
      : mediaType === 'upload'
      ? '📁 Uploaded Media File'
      : '🎙️ Clean Audio Recording';

  // 1. Generate keynote highlights from transcript segments if not provided
  let highlights: string[] = keynotes || [];
  if (highlights.length === 0 && transcripts.length > 0) {
    // Pick meaningful segments spaced across the recording
    const count = Math.min(4, transcripts.length);
    const step = Math.max(1, Math.floor(transcripts.length / count));
    for (let i = 0; i < transcripts.length && highlights.length < 4; i += step) {
      const seg = transcripts[i];
      if (seg && seg.textContent && seg.textContent.trim().length > 3) {
        const ts = `[${formatTimeSeconds(seg.startTime)}]`;
        highlights.push(`${ts} ${seg.textContent.trim()}`);
      }
    }
  }

  // Fallback highlight if empty
  if (highlights.length === 0) {
    highlights = [
      `[00:00] Session initialized (${formattedDuration})`,
      `[${formatTimeSeconds(Math.floor(durationSeconds / 2))}] Active discussion and speech capture`,
    ];
  }

  // 2. Generate executive summary if not provided
  const summaryText =
    executiveSummary ||
    (transcripts.length > 0
      ? `This studio session covers key discussion topics recorded over **${formattedDuration}**. Transcribed using **${speechModelUsed}**, the session highlights core themes, key soundbites, and actionable next steps.`
      : `Audio captured for **${title}** over **${formattedDuration}**. Transcripts and notes are synchronized with the waveform scrubber.`);

  // 3. Action items
  const actions: string[] =
    actionItems || [
      `Review key soundbites in the interactive transcript view`,
      `Export markdown notes or synchronized WebVTT subtitles`,
      `Share session recording and takeaways with team`,
    ];

  // 4. Build timeline topics
  const timelineTopics = transcripts.slice(0, 6).map((seg) => {
    return `- ⏱️ **[${formatTimeSeconds(seg.startTime)}]** ${seg.textContent.trim()}`;
  });

  return `# 🎙️ ${title}

> **📊 Studio Session Overview**
> - ⏱️ **Duration:** ${formattedDuration}
> - 🧠 **Speech AI Model:** ${speechModelUsed}
> - 📡 **Input Type:** ${mediaTypeLabel}
> - 📅 **Date & Time:** ${dateString} at ${timeString}
> - 💬 **Transcript Segments:** ${transcripts.length} lines

---

## 🌟 Keynote Highlights
${highlights.map((h) => `- ${h}`).join('\n')}

## 📌 Executive Summary
${summaryText}

## 🎯 Discussion Timeline & Soundbites
${timelineTopics.length > 0 ? timelineTopics.join('\n') : '- *Transcribing session soundbites...*'}

## ✅ Action Items & Follow-ups
${actions.map((a) => `- [ ] ${a}`).join('\n')}

---

### 📝 Studio Scratchpad & Personal Notes
*(Add your manual meeting thoughts, bullet points, or custom observations below)*

`;
}
