import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Session,
  SessionSummary,
  ModelLoadProgress,
  TranscriptSegment,
  HardwareDevice,
} from './types';
import { transcriptionService } from './lib/transcriptionService';
import { llmService } from './lib/llmService';
import {
  saveAudioBlob,
  getAudioBlob,
  deleteAudioBlob,
  saveVideoBlob,
  getVideoBlob,
  deleteVideoBlob,
  saveSession,
  getSession,
  getAllSessionSummaries,
  deleteSession as deleteSessionRecord,
} from './lib/indexedDb';
import { generateStudioNotesMarkdown } from './lib/studioNotesGenerator';
import {
  loadKeynoteSample,
  loadSampleVideo,
} from './lib/sampleAudio';
import { decodeAndResampleBlob } from './lib/audioResampler';

import { Header } from './components/Header';
import { ModelStatusBar } from './components/ModelStatusBar';
import { SessionSidebar } from './components/SessionSidebar';
import { WaveformScrubber } from './components/WaveformScrubber';
import { TranscriptView } from './components/TranscriptView';
import { NoteEditor } from './components/NoteEditor';
import { RecordingStudioModal } from './components/RecordingStudioModal';
import { MediaUploadModal } from './components/MediaUploadModal';
import { UserGuideModal } from './components/UserGuideModal';
import { Footer } from './components/Footer';

import {
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Upload,
  Music,
  Video,
  Film,
  Sparkles,
  Lock,
} from 'lucide-react';

export default function App() {
  // Model state (on-device Whisper speech engine)
  const [modelProgress, setModelProgress] = useState<ModelLoadProgress>(
    transcriptionService.getProgress()
  );
  // Model state (on-device pretrained LLM used for headings & summaries)
  const [llmProgress, setLlmProgress] = useState<ModelLoadProgress>(
    llmService.getProgress()
  );

  // Sessions state
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [currentAudioBlob, setCurrentAudioBlob] = useState<Blob | null>(null);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

  // Transcription process state & lock
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribingStatus, setTranscribingStatus] = useState('Transcribing on device...');

  // Video element ref for synchronized playback scrubbing
  const videoPlayerRef = useRef<HTMLVideoElement>(null);

  // Playback & Scrubber sync state
  const [currentTime, setCurrentTime] = useState(0);
  const [seekToTime, setSeekToTime] = useState<number | null>(null);

  // UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Debounce timer ref for note auto-saving
  const noteSaveTimerRef = useRef<any>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Sync video time with audio scrubber time
  useEffect(() => {
    if (videoPlayerRef.current && Math.abs(videoPlayerRef.current.currentTime - currentTime) > 0.3) {
      videoPlayerRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  // Subscribe to model progress & auto-initialize BOTH on-device models on app load.
  // Whisper (speech) and the pretrained LLM (headings/summaries) download their weights
  // straight into the browser cache. No external AI API is ever called.
  useEffect(() => {
    const unsubSpeech = transcriptionService.onProgress((prog) => {
      setModelProgress(prog);
    });
    const unsubLlm = llmService.onProgress((prog) => {
      setLlmProgress(prog);
    });

    // Kick off background weight downloads (WebGPU when available, else WASM CPU).
    transcriptionService.preloadModel('onnx-community/whisper-tiny.en', 'webgpu');
    llmService.preloadModel('Xenova/flan-t5-small', 'webgpu');

    return () => {
      unsubSpeech();
      unsubLlm();
    };
  }, []);

  // Load the session list from local IndexedDB on mount
  const loadSessionsList = useCallback(async () => {
    try {
      const data = await getAllSessionSummaries();
      setSessions(data);
      if (data.length > 0) {
        loadSessionById(data[0].id);
      } else {
        loadInitialKeynoteSession();
      }
    } catch {
      loadInitialKeynoteSession();
    }
  }, []);

  useEffect(() => {
    loadSessionsList();
  }, []);

  // Load a specific session from IndexedDB (record + audio/video blobs)
  const loadSessionById = async (sessionId: string) => {
    try {
      const data = await getSession(sessionId);
      if (!data) return;

      setCurrentSession(data);
      setLastSavedAt(data.note?.updatedAt || null);

      const blob = await getAudioBlob(sessionId);
      setCurrentAudioBlob(blob || null);
      setCurrentTime(0);

      const videoBlob = await getVideoBlob(sessionId);
      if (videoBlob) {
        setCurrentVideoUrl(URL.createObjectURL(videoBlob));
      } else {
        setCurrentVideoUrl(null);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  };

  // Load default keynote speech session (first-run demo)
  const loadInitialKeynoteSession = async () => {
    const sampleId = 'sample_demo_keynote';
    const sampleData = await loadKeynoteSample(sampleId);

    const session: Session = {
      id: sampleId,
      userId: 'edge_studio_user',
      title: '🎙️ Edge AI & WebGPU Architecture Keynote',
      createdAt: new Date().toISOString(),
      durationSeconds: sampleData.duration,
      transcripts: sampleData.segments,
      note: {
        id: `note_${sampleId}`,
        sessionId: sampleId,
        markdownBody: sampleData.notes,
        updatedAt: new Date().toISOString(),
      },
      hasAudioBlob: true,
    };

    setCurrentSession(session);
    setCurrentAudioBlob(sampleData.audioBlob);
    setCurrentVideoUrl(null);
    setCurrentTime(0);
    setLastSavedAt(session.note?.updatedAt || null);

    await saveAudioBlob(sampleId, sampleData.audioBlob);
    await saveSession(session);

    setSessions((prev) => {
      const exists = prev.some((s) => s.id === sampleId);
      if (exists) return prev;
      return [
        {
          id: sampleId,
          title: session.title,
          created_at: session.createdAt,
          duration_seconds: session.durationSeconds,
          transcript_count: session.transcripts.length,
          has_notes: true,
        },
        ...prev,
      ];
    });
  };

  // Load sample audio directly into the current session WITHOUT redirecting
  const loadSampleAudioIntoCurrentSession = async () => {
    const targetSessionId = currentSession?.id || `session_${Date.now()}`;
    showToast('Loading spoken speech keynote sample...', 'info');

    const sampleData = await loadKeynoteSample(targetSessionId);
    await saveAudioBlob(targetSessionId, sampleData.audioBlob);
    setCurrentAudioBlob(sampleData.audioBlob);
    setCurrentVideoUrl(null);
    setCurrentTime(0);

    const updatedTranscripts = sampleData.segments.map((s, idx) => ({
      ...s,
      sessionId: targetSessionId,
      id: `seg_${Date.now()}_${idx + 1}`,
    }));

    const autoNotes = generateStudioNotesMarkdown({
      title: '🎙️ Edge AI Keynote Note',
      durationSeconds: sampleData.duration,
      speechModelUsed: modelProgress.modelName || 'On-Device Whisper',
      mediaType: 'audio',
      transcripts: updatedTranscripts,
    });

    const updatedSession: Session = {
      id: targetSessionId,
      userId: currentSession?.userId || 'edge_studio_user',
      title: '🎙️ Edge AI Keynote Note',
      createdAt: currentSession?.createdAt || new Date().toISOString(),
      durationSeconds: sampleData.duration,
      transcripts: updatedTranscripts,
      hasVideo: false,
      videoUrl: null,
      note: {
        id: currentSession?.note?.id || `note_${targetSessionId}`,
        sessionId: targetSessionId,
        markdownBody: autoNotes,
        updatedAt: new Date().toISOString(),
      },
      hasAudioBlob: true,
    };

    setCurrentSession(updatedSession);
    setLastSavedAt(new Date().toISOString());
    await saveSession(updatedSession);

    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === targetSessionId);
      const item: SessionSummary = {
        id: targetSessionId,
        title: updatedSession.title,
        created_at: updatedSession.createdAt,
        duration_seconds: updatedSession.durationSeconds,
        transcript_count: updatedTranscripts.length,
        has_notes: true,
      };
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = item;
        return clone;
      }
      return [item, ...prev];
    });

    showToast('Spoken audio sample loaded into current session!', 'success');
  };

  // Load sample presentation video directly into the current session WITHOUT redirecting
  const loadSampleVideoIntoCurrentSession = async () => {
    const targetSessionId = currentSession?.id || `session_${Date.now()}`;
    showToast('Loading presentation video sample...', 'info');

    const sampleData = await loadSampleVideo(targetSessionId);
    await saveAudioBlob(targetSessionId, sampleData.audioBlob);
    setCurrentAudioBlob(sampleData.audioBlob);
    setCurrentVideoUrl('/sample/sample_video.mp4');
    setCurrentTime(0);

    const updatedTranscripts = sampleData.segments.map((s, idx) => ({
      ...s,
      sessionId: targetSessionId,
      id: `seg_${Date.now()}_${idx + 1}`,
    }));

    const autoNotes = generateStudioNotesMarkdown({
      title: '🎬 Edge AI Video Keynote Note',
      durationSeconds: sampleData.duration,
      speechModelUsed: modelProgress.modelName || 'On-Device Whisper',
      mediaType: 'video',
      transcripts: updatedTranscripts,
    });

    const updatedSession: Session = {
      id: targetSessionId,
      userId: currentSession?.userId || 'edge_studio_user',
      title: '🎬 Edge AI Video Keynote Note',
      createdAt: currentSession?.createdAt || new Date().toISOString(),
      durationSeconds: sampleData.duration,
      transcripts: updatedTranscripts,
      hasVideo: true,
      videoUrl: '/sample/sample_video.mp4',
      note: {
        id: currentSession?.note?.id || `note_${targetSessionId}`,
        sessionId: targetSessionId,
        markdownBody: autoNotes,
        updatedAt: new Date().toISOString(),
      },
      hasAudioBlob: true,
    };

    setCurrentSession(updatedSession);
    setLastSavedAt(new Date().toISOString());
    await saveSession(updatedSession);

    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === targetSessionId);
      const item: SessionSummary = {
        id: targetSessionId,
        title: updatedSession.title,
        created_at: updatedSession.createdAt,
        duration_seconds: updatedSession.durationSeconds,
        transcript_count: updatedTranscripts.length,
        has_notes: true,
        hasVideo: true,
      };
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = item;
        return clone;
      }
      return [item, ...prev];
    });

    showToast('Presentation video sample loaded into current session!', 'success');
  };

  // Create a new blank session - preserves all existing sessions
  const handleNewSession = async () => {
    const newId = `session_${Date.now()}`;
    const newTitle = `New Studio Session ${sessions.length + 1}`;
    const newSession: Session = {
      id: newId,
      userId: 'edge_studio_user',
      title: newTitle,
      createdAt: new Date().toISOString(),
      durationSeconds: 0,
      transcripts: [],
      note: {
        id: `note_${newId}`,
        sessionId: newId,
        markdownBody: `# 📝 ${newTitle}\n\n- **Created:** ${new Date().toLocaleString()}\n\n### 🎙️ Notes & Transcript Highlights\n\n`,
        updatedAt: new Date().toISOString(),
      },
    };

    await saveSession(newSession);

    setSessions((prev) => [
      {
        id: newId,
        title: newSession.title,
        created_at: newSession.createdAt,
        duration_seconds: 0,
        transcript_count: 0,
        has_notes: true,
      },
      ...prev,
    ]);

    setCurrentSession(newSession);
    setCurrentAudioBlob(null);
    setCurrentVideoUrl(null);
    setCurrentTime(0);
    setLastSavedAt(new Date().toISOString());
    showToast('New studio session created!', 'success');
  };

  // 100% on-device transcription pipeline. There is NO cloud fallback: audio is decoded
  // to 16kHz PCM and run through the Whisper Web Worker (WebGPU, or WASM CPU if WebGPU is
  // unavailable). The browser waits for model weights to download/cache before inferring.
  const transcribeAudioOnDevice = async (
    audioBlob: Blob,
    sessionId: string,
    durationSecs: number,
    providedPcm?: Float32Array
  ): Promise<{ segments: TranscriptSegment[]; engineName: string }> => {
    let pcm = providedPcm;
    let duration = durationSecs;

    if (!pcm || duration <= 0) {
      try {
        setTranscribingStatus('Decoding audio for on-device transcription...');
        const decoded = await decodeAndResampleBlob(audioBlob);
        pcm = decoded.pcmData;
        duration = decoded.duration || duration;
      } catch (decodeErr) {
        console.warn('PCM decode warning:', decodeErr);
      }
    }

    let segments: TranscriptSegment[] = [];
    let engine = 'On-Device Whisper';

    if (pcm && pcm.length > 0) {
      try {
        setTranscribingStatus('Running on-device Whisper transcription (WebGPU/WASM)...');
        const edgeRes = await transcriptionService.transcribe(pcm, sessionId, true);
        if (edgeRes && Array.isArray(edgeRes.segments) && edgeRes.segments.length > 0) {
          segments = edgeRes.segments;
          engine = `On-Device Whisper (${modelProgress.device === 'webgpu' ? 'WebGPU' : 'WASM CPU'})`;
        }
      } catch (edgeErr) {
        console.warn('On-device Whisper transcription failed:', edgeErr);
      }
    }

    // Last-resort preserver so the session is never left without an annotation.
    if (!segments || segments.length === 0) {
      const roundedDur = Math.max(1, Math.round(duration * 10) / 10);
      segments = [
        {
          id: `seg_${Date.now()}_0`,
          sessionId,
          startTime: 0,
          endTime: roundedDur,
          textContent: `Audio captured on device (${roundedDur}s). The speech model may still be downloading its weights — press "Re-transcribe" once it is ready.`,
        },
      ];
      engine = 'On-Device Audio Preserver';
    }

    return { segments, engineName: engine };
  };

  // Generate an on-device heading + rich summary with the pretrained LLM and fold the
  // result into the Studio Notes markdown. Falls back to the extractive on-device NLP
  // analyzer automatically if the LLM weights are still downloading.
  const enrichNotesWithLLM = async (
    transcripts: TranscriptSegment[],
    opts: {
      baseTitle: string;
      durationSeconds: number;
      speechModelUsed: string;
      mediaType: 'video' | 'audio';
      fallbackTitle: string;
    }
  ): Promise<{ title: string; markdown: string; modelUsed: string }> => {
    const analysis = await llmService.generateTitleAndSummary(transcripts, opts.fallbackTitle);

    const markdown = generateStudioNotesMarkdown({
      title: analysis.title || opts.baseTitle,
      durationSeconds: opts.durationSeconds,
      speechModelUsed: opts.speechModelUsed,
      mediaType: opts.mediaType,
      transcripts,
      executiveSummary: analysis.summary,
      keynotes: analysis.keynotes,
      actionItems: analysis.actionItems,
    });

    return {
      title: analysis.title || opts.baseTitle,
      markdown,
      modelUsed: analysis.modelUsed,
    };
  };

  // Handle completed media processing (from Recording or File Upload)
  const processAndTranscribeMedia = async (
    audioBlob: Blob,
    audioPcm16k: Float32Array,
    title: string,
    durationSecs: number,
    videoBlobOrUrl?: Blob | File | string | null
  ) => {
    const sessionId = currentSession?.id || `session_${Date.now()}`;

    // 1. Cache audio blob immediately in local IndexedDB
    await saveAudioBlob(sessionId, audioBlob);
    setCurrentAudioBlob(audioBlob);

    // 2. Intelligently configure video vs audio-only state
    const isVideoInput = !!videoBlobOrUrl;
    let videoUrlToSet: string | null = null;

    if (isVideoInput && videoBlobOrUrl) {
      if (typeof videoBlobOrUrl === 'string') {
        videoUrlToSet = videoBlobOrUrl;
      } else {
        videoUrlToSet = URL.createObjectURL(videoBlobOrUrl);
        await saveVideoBlob(sessionId, videoBlobOrUrl);
      }
      setCurrentVideoUrl(videoUrlToSet);
    } else {
      setCurrentVideoUrl(null);
      await deleteVideoBlob(sessionId);
    }

    // 3. Seed Studio Notes with session name, duration, and speech model
    const initialNotesMarkdown = generateStudioNotesMarkdown({
      title: title || 'Studio Session',
      durationSeconds: durationSecs,
      speechModelUsed: modelProgress.modelName || 'On-Device Whisper',
      mediaType: isVideoInput ? 'video' : 'audio',
      transcripts: [],
    });

    const baseSession: Session = {
      id: sessionId,
      userId: 'edge_studio_user',
      title: title || currentSession?.title || 'Untitled Studio Session',
      createdAt: currentSession?.createdAt || new Date().toISOString(),
      durationSeconds: Math.round(durationSecs * 10) / 10,
      transcripts: [],
      hasVideo: isVideoInput,
      videoUrl: videoUrlToSet,
      note: {
        id: currentSession?.note?.id || `note_${sessionId}`,
        sessionId,
        markdownBody: initialNotesMarkdown,
        updatedAt: new Date().toISOString(),
      },
      hasAudioBlob: true,
    };
    setCurrentSession(baseSession);

    setIsTranscribing(true);
    setTranscribingStatus('Transcribing on device...');
    showToast(
      isVideoInput
        ? 'Transcribing video audio 100% on device...'
        : 'Transcribing audio 100% on device...',
      'info'
    );

    try {
      const { segments: finalTranscripts, engineName } = await transcribeAudioOnDevice(
        audioBlob,
        sessionId,
        durationSecs,
        audioPcm16k
      );

      // Interim notes immediately from the transcripts (instant, no model wait)
      const interimMarkdown = generateStudioNotesMarkdown({
        title: baseSession.title,
        durationSeconds: durationSecs,
        speechModelUsed: engineName,
        mediaType: isVideoInput ? 'video' : 'audio',
        transcripts: finalTranscripts,
      });

      const interimSession: Session = {
        ...baseSession,
        transcripts: finalTranscripts,
        note: {
          id: baseSession.note?.id || `note_${sessionId}`,
          sessionId,
          markdownBody: interimMarkdown,
          updatedAt: new Date().toISOString(),
        },
      };
      setCurrentSession(interimSession);
      await saveSession(interimSession);

      // Now refine heading + executive summary with the on-device pretrained LLM.
      setTranscribingStatus('On-device LLM generating heading & summary...');
      let finalSession = interimSession;
      try {
        const enriched = await enrichNotesWithLLM(finalTranscripts, {
          baseTitle: baseSession.title,
          durationSeconds: durationSecs,
          speechModelUsed: engineName,
          mediaType: isVideoInput ? 'video' : 'audio',
          fallbackTitle: baseSession.title,
        });

        finalSession = {
          ...interimSession,
          title: enriched.title,
          note: {
            id: interimSession.note?.id || `note_${sessionId}`,
            sessionId,
            markdownBody: enriched.markdown,
            updatedAt: new Date().toISOString(),
          },
        };
        setCurrentSession(finalSession);
        await saveSession(finalSession);
      } catch (llmErr) {
        console.warn('On-device LLM enrichment skipped:', llmErr);
      }

      setLastSavedAt(new Date().toISOString());

      // Update sidebar session summary
      setSessions((prev) => {
        const index = prev.findIndex((s) => s.id === sessionId);
        const item: SessionSummary = {
          id: sessionId,
          title: finalSession.title,
          created_at: finalSession.createdAt,
          duration_seconds: finalSession.durationSeconds,
          transcript_count: finalTranscripts.length,
          has_notes: true,
          hasVideo: isVideoInput,
        };
        if (index >= 0) {
          const clone = [...prev];
          clone[index] = item;
          return clone;
        }
        return [item, ...prev];
      });

      showToast(`Transcripts & Studio Notes generated on device via ${engineName}!`, 'success');
    } catch (err: any) {
      console.warn('Transcription error:', err);
      showToast('Audio preserved in session notes.', 'info');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Explicitly trigger or re-trigger transcription on the current session audio
  const handleTriggerTranscription = async () => {
    if (!currentAudioBlob || !currentSession || isTranscribing) {
      if (!currentAudioBlob) {
        showToast('No audio found in this session. Record or load audio first.', 'error');
      }
      return;
    }

    const sessionId = currentSession.id;
    setIsTranscribing(true);
    setTranscribingStatus('Decoding audio & generating transcripts on device...');
    showToast('Starting on-device transcription of current session audio...', 'info');

    try {
      const { segments: finalTranscripts, engineName } = await transcribeAudioOnDevice(
        currentAudioBlob,
        sessionId,
        currentSession.durationSeconds || 0
      );

      const interimSession: Session = {
        ...currentSession,
        transcripts: finalTranscripts,
      };
      setCurrentSession(interimSession);

      setTranscribingStatus('On-device LLM generating heading & summary...');
      let finalSession = interimSession;
      try {
        const enriched = await enrichNotesWithLLM(finalTranscripts, {
          baseTitle: interimSession.title,
          durationSeconds: interimSession.durationSeconds,
          speechModelUsed: engineName,
          mediaType: interimSession.hasVideo || currentVideoUrl ? 'video' : 'audio',
          fallbackTitle: interimSession.title,
        });
        finalSession = {
          ...interimSession,
          title: enriched.title,
          note: {
            id: interimSession.note?.id || `note_${sessionId}`,
            sessionId,
            markdownBody: enriched.markdown,
            updatedAt: new Date().toISOString(),
          },
        };
        setCurrentSession(finalSession);
      } catch (llmErr) {
        console.warn('On-device LLM enrichment skipped:', llmErr);
      }

      await saveSession(finalSession);
      setLastSavedAt(new Date().toISOString());

      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                title: finalSession.title,
                duration_seconds: finalSession.durationSeconds,
                transcript_count: finalTranscripts.length,
              }
            : s
        )
      );

      showToast(`Transcripts generated on device via ${engineName}! (${finalTranscripts.length} segments)`, 'success');
    } catch (err: any) {
      console.error('Manual transcription failed:', err);
      showToast('Audio preserved in session notes.', 'info');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Two-way sync: jump audio scrubber when the user clicks a transcript line
  const handleJumpToTime = (time: number) => {
    setCurrentTime(time);
    setSeekToTime(time);
    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime = time;
    }
    setTimeout(() => setSeekToTime(null), 100);
  };

  // Update transcript segment text
  const handleUpdateSegment = async (segmentId: string, newText: string) => {
    if (!currentSession) return;
    const updated = currentSession.transcripts.map((s) =>
      s.id === segmentId ? { ...s, textContent: newText } : s
    );
    const updatedSession = { ...currentSession, transcripts: updated };
    setCurrentSession(updatedSession);
    await saveSession(updatedSession);
  };

  // Append text to note from transcript
  const handleSendToNotes = (text: string) => {
    if (!currentSession) return;
    const currentMd = currentSession.note?.markdownBody || '';
    const newMd = (currentMd.trim() ? currentMd + '\n' : '') + text;
    handleNoteChange(newMd);
    showToast('Appended to Notes!', 'success');
  };

  // Note change with debounced local persistence
  const handleNoteChange = (newMarkdown: string) => {
    if (!currentSession) return;

    const updatedNote = {
      id: currentSession.note?.id || `note_${currentSession.id}`,
      sessionId: currentSession.id,
      markdownBody: newMarkdown,
      updatedAt: new Date().toISOString(),
    };

    const updatedSession: Session = {
      ...currentSession,
      note: updatedNote,
    };
    setCurrentSession(updatedSession);

    setIsSavingNotes(true);
    if (noteSaveTimerRef.current) clearTimeout(noteSaveTimerRef.current);

    noteSaveTimerRef.current = setTimeout(async () => {
      try {
        await saveSession(updatedSession);
        setLastSavedAt(new Date().toISOString());
      } catch (err) {
        console.warn('Failed to auto-save note:', err);
      } finally {
        setIsSavingNotes(false);
      }
    }, 800);
  };

  // Delete session - preserves other sessions
  const handleDeleteSession = async (sessionId: string) => {
    await deleteAudioBlob(sessionId);
    await deleteVideoBlob(sessionId);
    await deleteSessionRecord(sessionId);

    const remaining = sessions.filter((s) => s.id !== sessionId);
    setSessions(remaining);

    if (currentSession?.id === sessionId) {
      if (remaining.length > 0) {
        loadSessionById(remaining[0].id);
      } else {
        handleNewSession();
      }
    }
    showToast('Session deleted.', 'info');
  };

  // On-device LLM keynote extraction & Studio Notes generator
  const [isGeneratingKeynotes, setIsGeneratingKeynotes] = useState(false);

  const handleGenerateAIKeynotes = async () => {
    if (!currentSession) return;
    if (currentSession.transcripts.length === 0) {
      showToast('No transcripts available. Record or transcribe audio first.', 'info');
      return;
    }

    setIsGeneratingKeynotes(true);
    showToast('On-device LLM is extracting a heading, summary & keynotes...', 'info');

    try {
      const enriched = await enrichNotesWithLLM(currentSession.transcripts, {
        baseTitle: currentSession.title,
        durationSeconds: currentSession.durationSeconds,
        speechModelUsed: modelProgress.modelName || 'On-Device Whisper',
        mediaType: currentSession.hasVideo || currentVideoUrl ? 'video' : 'audio',
        fallbackTitle: currentSession.title,
      });

      const updatedSession: Session = {
        ...currentSession,
        title: enriched.title,
        note: {
          id: currentSession.note?.id || `note_${currentSession.id}`,
          sessionId: currentSession.id,
          markdownBody: enriched.markdown,
          updatedAt: new Date().toISOString(),
        },
      };
      setCurrentSession(updatedSession);
      await saveSession(updatedSession);
      setLastSavedAt(new Date().toISOString());

      setSessions((prev) =>
        prev.map((s) => (s.id === currentSession.id ? { ...s, title: enriched.title } : s))
      );

      showToast(`Studio Notes updated via ${enriched.modelUsed}!`, 'success');
    } catch (err) {
      console.warn('LLM keynote generation failed, using on-device NLP extractor:', err);
      const analysis = llmService.extractOnDeviceAnalysis(currentSession.transcripts, currentSession.title);
      const updatedMd = generateStudioNotesMarkdown({
        title: analysis.title,
        durationSeconds: currentSession.durationSeconds,
        speechModelUsed: modelProgress.modelName || 'On-Device Whisper',
        mediaType: currentSession.hasVideo || currentVideoUrl ? 'video' : 'audio',
        transcripts: currentSession.transcripts,
        executiveSummary: analysis.summary,
        keynotes: analysis.keynotes,
        actionItems: analysis.actionItems,
      });
      handleNoteChange(updatedMd);
      showToast('Studio Notes updated with on-device keynotes.', 'success');
    } finally {
      setIsGeneratingKeynotes(false);
    }
  };

  // Model selection handler
  const handleSelectModel = (modelId: string, device: HardwareDevice) => {
    transcriptionService.preloadModel(modelId, device);
    showToast(`Loading ${modelId} on device...`, 'info');
  };

  return (
    <div
      id="studio-app-root"
      className="flex flex-col h-screen w-screen bg-slate-100 text-slate-900 font-sans overflow-hidden"
    >
      {/* 1. Clean Main Header (User-Focused) */}
      <Header
        onOpenGuide={() => setIsGuideOpen(true)}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isSidebarOpen={isSidebarOpen}
        sessionCount={sessions.length}
      />

      {/* 2. Automated Model Status & Hardware Bar */}
      <ModelStatusBar
        progress={modelProgress}
        llmProgress={llmProgress}
        onSelectModel={handleSelectModel}
      />

      {/* 3. Main Workspace Area: Left/Center Content + Right Side Sessions Pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Studio Content Area (Left / Center) */}
        <main id="studio-workspace" className="flex-1 flex flex-col p-3.5 overflow-y-auto gap-3.5 min-w-0">
          {/* Active Transcription Status Banner & CTA Lock Alert */}
          {isTranscribing && (
            <div
              id="transcription-active-banner"
              className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs animate-in fade-in duration-200 shrink-0"
            >
              <div className="flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                <div>
                  <span className="font-bold text-blue-950">{transcribingStatus}</span>
                  <span className="text-[11px] text-blue-700 ml-2 hidden md:inline">
                    • Session media sources and CTA buttons are locked during generation
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/90 border border-blue-200 rounded-lg text-[11px] font-mono font-medium text-blue-700 shadow-2xs">
                <Lock className="w-3 h-3 text-blue-600" />
                <span>STUDIO LOCKED</span>
              </div>
            </div>
          )}

          {/* Top Bar: Session Title & Action Shortcuts */}
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <input
                id="active-session-title-input"
                type="text"
                disabled={isTranscribing}
                value={currentSession?.title || 'Untitled Studio Session'}
                onChange={(e) => {
                  if (currentSession) {
                    const newTitle = e.target.value;
                    const updated = { ...currentSession, title: newTitle };
                    setCurrentSession(updated);
                    setSessions((prev) =>
                      prev.map((s) => (s.id === currentSession.id ? { ...s, title: newTitle } : s))
                    );
                    saveSession(updated).catch(() => {});
                  }
                }}
                className={`text-sm font-bold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-hidden px-1 py-0.5 w-full min-w-0 max-w-md truncate ${
                  isTranscribing ? 'opacity-60 cursor-not-allowed' : ''
                }`}
                title="Edit Session Title"
              />
              <span className="text-[11px] font-mono text-slate-400 shrink-0">
                • {currentAudioBlob ? (currentSession?.durationSeconds ? `${currentSession.durationSeconds}s` : '0s') : 'No audio'}
              </span>
            </div>

            {/* Session Action Buttons: Transcribe CTA, Sample Audio, Sample Video, Upload, Record */}
            <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
              {/* Primary Trigger Transcription CTA Button */}
              <button
                id="workspace-transcribe-btn"
                onClick={handleTriggerTranscription}
                disabled={!currentAudioBlob || isTranscribing}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg shadow-2xs transition-all ${
                  isTranscribing
                    ? 'bg-blue-100 text-blue-800 border border-blue-200 cursor-not-allowed'
                    : !currentAudioBlob
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white cursor-pointer shadow-xs'
                }`}
                title={
                  isTranscribing
                    ? 'Transcription in progress...'
                    : !currentAudioBlob
                    ? 'Record or load audio first to transcribe'
                    : 'Generate or re-run on-device transcription'
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
                    <span>
                      {(currentSession?.transcripts && currentSession.transcripts.length > 0)
                        ? 'Re-transcribe'
                        : 'Transcribe Audio'}
                    </span>
                  </>
                )}
              </button>

              <div className="h-4 w-px bg-slate-200 mx-0.5 hidden sm:block" />

              {/* 1. Sample Audio Button */}
              <button
                id="workspace-sample-audio-btn"
                onClick={loadSampleAudioIntoCurrentSession}
                disabled={isTranscribing}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title={isTranscribing ? 'Locked during transcription' : 'Load clear spoken speech sample into this session'}
              >
                <Music className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Sample Audio</span>
              </button>

              {/* 2. Sample Video Button */}
              <button
                id="workspace-sample-video-btn"
                onClick={loadSampleVideoIntoCurrentSession}
                disabled={isTranscribing}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title={isTranscribing ? 'Locked during transcription' : 'Load sample presentation video into this session'}
              >
                <Video className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Sample Video</span>
              </button>

              {/* 3. Upload Media */}
              <button
                id="workspace-upload-btn"
                onClick={() => {
                  if (!isTranscribing) setIsUploaderOpen(true);
                }}
                disabled={isTranscribing}
                className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title={isTranscribing ? 'Locked during transcription' : 'Upload audio/video media file'}
              >
                <Upload className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Upload</span>
              </button>

              {/* 4. Record Live */}
              <button
                id="workspace-record-btn"
                onClick={() => {
                  if (!isTranscribing) setIsRecorderOpen(true);
                }}
                disabled={isTranscribing}
                className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title={isTranscribing ? 'Locked during transcription' : 'Record screen or microphone'}
              >
                <Radio className={`w-3.5 h-3.5 text-blue-600 ${isTranscribing ? '' : 'animate-pulse'}`} />
                <span className="hidden sm:inline">Record</span>
              </button>
            </div>
          </div>

          {/* Optional Synchronized Video Player */}
          {currentVideoUrl && (
            <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-xs shrink-0 flex flex-col items-center animate-in fade-in duration-200">
              <div className="w-full px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                  <Film className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Synced Video Preview</span>
                  <span className="text-[10px] text-slate-500">• Auto-syncs with waveform</span>
                </div>
                <button
                  onClick={() => setCurrentVideoUrl(null)}
                  className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close video preview"
                >
                  ✕
                </button>
              </div>
              <div className="w-full flex justify-center bg-black/90 p-1">
                <video
                  ref={videoPlayerRef}
                  src={currentVideoUrl}
                  className="w-auto max-w-full max-h-56 object-contain rounded-lg"
                  playsInline
                  muted
                />
              </div>
            </div>
          )}

          {/* Interactive WaveSurfer Scrubber */}
          <div className="shrink-0">
            <WaveformScrubber
              audioBlob={currentAudioBlob}
              currentTime={currentTime}
              onTimeUpdate={(t) => setCurrentTime(t)}
              onSeek={(t) => {
                setCurrentTime(t);
                if (videoPlayerRef.current) {
                  videoPlayerRef.current.currentTime = t;
                }
              }}
              onPlayStateChange={(playing) => {
                if (videoPlayerRef.current) {
                  if (playing) {
                    videoPlayerRef.current.play().catch(() => {});
                  } else {
                    videoPlayerRef.current.pause();
                  }
                }
              }}
              seekToTime={seekToTime}
              duration={currentAudioBlob ? (currentSession?.durationSeconds || 0) : 0}
            />
          </div>

          {/* Split View: Left (Transcript) & Right (Markdown Note Editor) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-[560px] xl:h-[620px] shrink-0">
            {/* Left: Transcript View */}
            <div className="h-[540px] xl:h-full flex flex-col overflow-hidden">
              <TranscriptView
                segments={currentSession?.transcripts || []}
                currentTime={currentTime}
                onJumpToTime={handleJumpToTime}
                onUpdateSegment={handleUpdateSegment}
                onSendToNotes={handleSendToNotes}
                hasAudio={!!currentAudioBlob}
                isTranscribing={isTranscribing}
                onTriggerTranscription={handleTriggerTranscription}
              />
            </div>

            {/* Right: Markdown Note Editor */}
            <div className="h-[540px] xl:h-full flex flex-col overflow-hidden">
              <NoteEditor
                markdown={currentSession?.note?.markdownBody || ''}
                onChange={handleNoteChange}
                currentTime={currentTime}
                onJumpToTime={handleJumpToTime}
                isSaving={isSavingNotes}
                lastSavedAt={lastSavedAt}
                onGenerateAIKeynotes={handleGenerateAIKeynotes}
                isGeneratingKeynotes={isGeneratingKeynotes}
              />
            </div>
          </div>

          {/* Bottom Padding & Creator Credit Footer */}
          <Footer />
        </main>

        {/* Right Side Pane: Studio Sessions */}
        <SessionSidebar
          sessions={sessions}
          activeSessionId={currentSession?.id || null}
          onSelectSession={loadSessionById}
          onDeleteSession={handleDeleteSession}
          onNewSession={handleNewSession}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          isTranscribing={isTranscribing}
        />
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          id="studio-toast"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-white shadow-xl animate-in slide-in-from-bottom-2 duration-200 bg-slate-900 border border-slate-700"
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toastMessage.type === 'info' && <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />}
          {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Modals */}
      <RecordingStudioModal
        isOpen={isRecorderOpen}
        onClose={() => setIsRecorderOpen(false)}
        onRecordingComplete={processAndTranscribeMedia}
        onLoadSampleAudio={loadSampleAudioIntoCurrentSession}
        onLoadSampleVideo={loadSampleVideoIntoCurrentSession}
      />

      <MediaUploadModal
        isOpen={isUploaderOpen}
        onClose={() => setIsUploaderOpen(false)}
        onUploadComplete={processAndTranscribeMedia}
        onLoadSampleAudio={loadSampleAudioIntoCurrentSession}
        onLoadSampleVideo={loadSampleVideoIntoCurrentSession}
      />

      <UserGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </div>
  );
}
