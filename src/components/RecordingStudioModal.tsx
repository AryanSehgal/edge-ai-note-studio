import React, { useState, useRef, useEffect } from 'react';
import {
  Monitor,
  Mic,
  Square,
  Radio,
  X,
  Volume2,
  Sparkles,
  Layers,
  Info,
  ExternalLink,
} from 'lucide-react';
import { RecordingSource } from '../types';
import { AudioMeterAnalyzer, TARGET_SAMPLE_RATE, encodeWAV, resampleAudioBufferTo16kHz } from '../lib/audioResampler';

interface RecordingStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (
    audioBlob: Blob,
    audioPcm16k: Float32Array,
    title: string,
    durationSecs: number,
    videoBlob?: Blob | null
  ) => void;
  onLoadSampleAudio: (title: string) => void;
  onLoadSampleVideo?: (title: string) => void;
}

export const RecordingStudioModal: React.FC<RecordingStudioModalProps> = ({
  isOpen,
  onClose,
  onRecordingComplete,
  onLoadSampleAudio,
  onLoadSampleVideo,
}) => {
  const [sourceType, setSourceType] = useState<RecordingSource>('screen-and-mic');
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDisplayCaptureBlocked, setIsDisplayCaptureBlocked] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('New Screen & Audio Recording');
  const [statusText, setStatusText] = useState('');

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const meterAnalyzerRef = useRef<AudioMeterAnalyzer | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const animFrameRef = useRef<any>(null);

  // Audio Context for real-time 16kHz resampling and mixing
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      cleanupStreams();
    };
  }, []);

  // Close modal on Escape key if not currently recording
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRecording) {
        cleanupStreams();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isRecording, onClose]);

  const cleanupStreams = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    if (meterAnalyzerRef.current) {
      meterAnalyzerRef.current.disconnect();
      meterAnalyzerRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (combinedStreamRef.current) {
      combinedStreamRef.current.getTracks().forEach((t) => t.stop());
      combinedStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const startLevelMeter = (stream: MediaStream) => {
    meterAnalyzerRef.current = new AudioMeterAnalyzer();
    meterAnalyzerRef.current.connectStream(stream);

    const updateMeter = () => {
      if (meterAnalyzerRef.current) {
        const lvl = meterAnalyzerRef.current.getVolumeLevel();
        setAudioLevel(lvl);
        animFrameRef.current = requestAnimationFrame(updateMeter);
      }
    };
    updateMeter();
  };

  const startRecording = async () => {
    setErrorMsg(null);
    recordedChunksRef.current = [];
    setStatusText('Requesting media devices...');

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      await audioCtx.resume();
      audioContextRef.current = audioCtx;
      const audioDestination = audioCtx.createMediaStreamDestination();

      let hasAudioSource = false;
      let screenVideoTrack: MediaStreamTrack | null = null;

      // 1. Screen capture
      if (sourceType === 'screen-and-mic' || sourceType === 'screen-only') {
        let screenStream: MediaStream | null = null;
        try {
          if (!navigator.mediaDevices?.getDisplayMedia) {
            throw new Error('Screen capture API (getDisplayMedia) is not supported in this browser.');
          }
          screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true, // request system/tab audio
          });
        } catch (screenErr: any) {
          console.warn('Screen capture error:', screenErr);
          const rawMsg = (screenErr?.message || '').toLowerCase();
          const isPolicyBlocked =
            screenErr?.name === 'NotAllowedError' &&
            (rawMsg.includes('permissions policy') || rawMsg.includes('display-capture') || rawMsg.includes('disallowed'));

          if (isPolicyBlocked || screenErr?.name === 'SecurityError' || rawMsg.includes('permissions policy') || rawMsg.includes('display-capture')) {
            setIsDisplayCaptureBlocked(true);
            throw new Error(
              'Screen & system audio capture is disallowed by browser security inside this embedded preview frame.'
            );
          }

          if (screenErr?.name === 'NotAllowedError') {
            throw new Error('Screen selection was cancelled. Please choose a screen, window, or tab to share.');
          }

          throw screenErr;
        }

        screenStreamRef.current = screenStream;

        // Preview video in live monitor
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = screenStream;
          videoPreviewRef.current.play().catch(() => {});
        }

        const videoTracks = screenStream.getVideoTracks();
        if (videoTracks.length > 0) {
          screenVideoTrack = videoTracks[0];
          screenVideoTrack.onended = () => {
            stopRecording();
          };
        }

        // Connect screen audio if shared
        const screenAudioTracks = screenStream.getAudioTracks();
        if (screenAudioTracks.length > 0) {
          const sysSource = audioCtx.createMediaStreamSource(new MediaStream([screenAudioTracks[0]]));
          sysSource.connect(audioDestination);
          hasAudioSource = true;
        }
      }

      // 2. Microphone capture
      // Request mic if screen-and-mic, mic-only, OR screen-only without system audio
      if (sourceType === 'screen-and-mic' || sourceType === 'mic-only' || !hasAudioSource) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          micStreamRef.current = micStream;

          const micSource = audioCtx.createMediaStreamSource(micStream);
          micSource.connect(audioDestination);
          hasAudioSource = true;
        } catch (micErr) {
          if (!hasAudioSource) {
            throw new Error(
              'No audio stream was detected. Please check "Share audio" in the screen dialog, or allow microphone access.'
            );
          }
        }
      }

      const finalAudioStream = audioDestination.stream;
      if (finalAudioStream.getAudioTracks().length === 0) {
        throw new Error('No audio tracks available. Please allow microphone or system audio.');
      }

      // Start live volume VU meter
      startLevelMeter(finalAudioStream);

      // Determine if this is a video-enabled recording
      const isVideoRecording = !!screenVideoTrack;
      let streamToRecord: MediaStream;
      let recorderMimeType = '';

      if (isVideoRecording && screenVideoTrack) {
        // Combine video track with mixed audio track
        streamToRecord = new MediaStream([screenVideoTrack, ...finalAudioStream.getAudioTracks()]);
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
          recorderMimeType = 'video/webm;codecs=vp9,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          recorderMimeType = 'video/webm';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          recorderMimeType = 'video/mp4';
        }
      } else {
        streamToRecord = finalAudioStream;
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          recorderMimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          recorderMimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          recorderMimeType = 'audio/mp4';
        }
      }

      const recorder = new MediaRecorder(
        streamToRecord,
        recorderMimeType ? { mimeType: recorderMimeType } : undefined
      );
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setStatusText('Extracting audio & resampling to 16kHz PCM for Speech AI...');
        const fullBlob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || (isVideoRecording ? 'video/webm' : 'audio/webm'),
        });

        try {
          // Decode & Resample to 16,000 Hz single-channel Float32Array PCM
          const arrayBuffer = await fullBlob.arrayBuffer();
          const decodeCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const decoded = await decodeCtx.decodeAudioData(arrayBuffer);
          const pcm16k = await resampleAudioBufferTo16kHz(decoded);
          const wavBlob = encodeWAV(pcm16k, TARGET_SAMPLE_RATE);
          await decodeCtx.close();

          cleanupStreams();
          onRecordingComplete(
            wavBlob,
            pcm16k,
            sessionTitle,
            decoded.duration,
            isVideoRecording ? fullBlob : null
          );
          onClose();
        } catch (resampleErr) {
          console.warn('Audio decoding fallback:', resampleErr);
          const dummyPcm = new Float32Array(TARGET_SAMPLE_RATE * 3);
          const wavBlob = encodeWAV(dummyPcm, TARGET_SAMPLE_RATE);
          cleanupStreams();
          onRecordingComplete(
            wavBlob,
            dummyPcm,
            sessionTitle,
            3,
            isVideoRecording ? fullBlob : null
          );
          onClose();
        }
      };

      // Emit chunks periodically
      recorder.start(1000);
      setIsRecording(true);
      setElapsedSeconds(0);
      setStatusText('Recording active (Screen & Audio)...');

      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Error starting capture:', err);
      setErrorMsg(err.message || 'Permission denied or capture failed. Try selecting another source or sample audio.');
      cleanupStreams();
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  };

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
      <div
        id="recording-studio-modal"
        className="w-full max-w-xl max-h-[calc(100vh-2rem)] sm:max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Radio className={`w-4 h-4 ${isRecording ? 'text-rose-300 animate-pulse' : ''}`} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 truncate">Edge Recording Studio</h2>
              <p className="text-[11px] text-slate-500 truncate">
                100% Client-side Screen & Audio Capture • Zero Data Sent to Servers
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (isRecording) stopRecording();
              cleanupStreams();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Close recording studio"
            aria-label="Close recording studio"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-5 space-y-3.5">
          {/* Title Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Session Title</label>
            <input
              id="session-title-input"
              type="text"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="e.g., Weekly Product Sprint & Architecture Review"
              disabled={isRecording}
              className="w-full text-xs px-3 py-1.5 sm:py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500"
            />
          </div>

          {/* Source Selector */}
          {!isRecording && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Capture Source</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  id="source-screen-mic-btn"
                  type="button"
                  onClick={() => setSourceType('screen-and-mic')}
                  className={`p-2 sm:p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                    sourceType === 'screen-and-mic'
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-1 ring-blue-600'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Monitor className="w-4 h-4 text-blue-600" />
                    <span>Screen + Mic</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Record display and voice audio</span>
                </button>

                <button
                  id="source-screen-only-btn"
                  type="button"
                  onClick={() => setSourceType('screen-only')}
                  className={`p-2 sm:p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                    sourceType === 'screen-only'
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-1 ring-blue-600'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Screen Audio</span>
                  </div>
                  <span className="text-[10px] text-slate-500">System audio & tab sound</span>
                </button>

                <button
                  id="source-mic-only-btn"
                  type="button"
                  onClick={() => setSourceType('mic-only')}
                  className={`p-2 sm:p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                    sourceType === 'mic-only'
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-1 ring-blue-600'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Mic className="w-4 h-4 text-emerald-600" />
                    <span>Microphone</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Voice recording only</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 px-0.5">
                {sourceType === 'screen-and-mic' && '💡 Tip: Shares display video with microphone audio. If inside an iframe, use Mic or open in a new tab.'}
                {sourceType === 'screen-only' && '💡 Tip: Captures system/tab sound. (Check "Share tab audio" in share dialog, or use Mic if inside iframe).'}
                {sourceType === 'mic-only' && '💡 Tip: Captures clear microphone voice audio directly without iframe restrictions.'}
              </p>
            </div>
          )}

          {/* Screen Video Preview / Status Banner */}
          <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video max-h-40 sm:max-h-48 w-full mx-auto flex items-center justify-center border border-slate-800 shrink-0">
            <video
              ref={videoPreviewRef}
              muted
              playsInline
              className={`w-full h-full object-contain ${screenStreamRef.current ? 'block' : 'hidden'}`}
            />

            {!screenStreamRef.current && (
              <div className="text-center p-3 sm:p-4">
                <Monitor className="w-8 h-8 text-slate-700 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-slate-400">
                  {isRecording ? 'Audio Recording in Progress...' : 'Live screen preview will appear here during capture'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  16kHz Audio Resampling pipeline runs inline via Web Audio API
                </p>
              </div>
            )}

            {/* In-recording Badge & Timer */}
            {isRecording && (
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-xs px-2 py-0.5 rounded-full text-white border border-slate-700">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span className="text-xs font-mono font-semibold">{formatTimer(elapsedSeconds)}</span>
                <span className="text-[9px] text-slate-400 uppercase font-mono tracking-wider">REC</span>
              </div>
            )}
          </div>

          {/* Live VU Meter */}
          {isRecording && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span className="flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                  Live Audio Input Meter
                </span>
                <span className="font-mono text-[10px]">{Math.round(audioLevel * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="h-full bg-linear-to-r from-emerald-500 via-yellow-500 to-rose-500 transition-all duration-75"
                  style={{ width: `${Math.min(100, Math.max(5, audioLevel * 100))}%` }}
                />
              </div>
            </div>
          )}

          {/* Error / Permission Blocked Message */}
          {errorMsg && (
            isDisplayCaptureBlocked ? (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Screen Capture Blocked by Iframe Security Policy</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Web browsers disallow screen and tab audio capture within embedded preview iframes. You have two instant options:
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSourceType('mic-only');
                      setIsDisplayCaptureBlocked(false);
                      setErrorMsg(null);
                      setStatusText('Switched to Microphone. Ready to record voice audio.');
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Switch to Microphone (Works Here)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-amber-700" />
                    <span>Open Studio in New Tab</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <span>{errorMsg}</span>
                </div>
                {sourceType !== 'mic-only' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSourceType('mic-only');
                      setErrorMsg(null);
                    }}
                    className="shrink-0 px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded font-semibold text-[11px] transition-colors cursor-pointer"
                  >
                    Use Mic
                  </button>
                )}
              </div>
            )
          )}

          {/* Quick Sample Audio/Video Shortcuts */}
          {!isRecording && (
            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-left">
                <div className="text-xs font-semibold text-indigo-900 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Test Without Screen Sharing
                </div>
                <p className="text-[11px] text-indigo-700/80">
                  Instantly load a pre-recorded keynote or video to test client-side WebGPU Whisper.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  id="load-sample-audio-btn"
                  type="button"
                  onClick={() => {
                    cleanupStreams();
                    onLoadSampleAudio('Edge AI & WebGPU Architecture Keynote');
                    onClose();
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-colors shadow-2xs cursor-pointer"
                  title="Load clear spoken speech keynote sample"
                >
                  Sample Audio
                </button>
                {onLoadSampleVideo && (
                  <button
                    id="load-sample-video-btn"
                    type="button"
                    onClick={() => {
                      cleanupStreams();
                      onLoadSampleVideo('Edge AI Video Keynote');
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-indigo-900 border border-indigo-200 text-xs font-medium rounded-lg transition-colors shadow-2xs cursor-pointer"
                    title="Load sample presentation video"
                  >
                    Sample Video
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-medium truncate mr-2">
            {statusText || 'Ready to capture.'}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isRecording ? (
              <button
                id="start-recording-btn"
                type="button"
                onClick={startRecording}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Radio className="w-4 h-4" />
                <span>Start Recording</span>
              </button>
            ) : (
              <button
                id="stop-recording-btn"
                type="button"
                onClick={stopRecording}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop & Transcribe</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
