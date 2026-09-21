import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';

interface WaveformScrubberProps {
  audioBlob: Blob | null;
  audioUrl?: string | null;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onSeek: (time: number) => void;
  onPlayStateChange?: (playing: boolean) => void;
  seekToTime?: number | null;
  duration?: number;
}

export const WaveformScrubber: React.FC<WaveformScrubberProps> = ({
  audioBlob,
  audioUrl: externalAudioUrl,
  currentTime,
  onTimeUpdate,
  onSeek,
  onPlayStateChange,
  seekToTime,
  duration: fallbackDuration,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState((audioBlob || externalAudioUrl) ? (fallbackDuration || 0) : 0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(20);
  const [isReady, setIsReady] = useState(false);

  // Sync duration with fallbackDuration or reset to 0 if no audio
  useEffect(() => {
    if (!audioBlob && !externalAudioUrl) {
      setDuration(0);
      setIsReady(false);
      setIsPlaying(false);
    } else if (fallbackDuration !== undefined) {
      setDuration(fallbackDuration);
    }
  }, [audioBlob, externalAudioUrl, fallbackDuration]);

  // Maintain internal object URL from blob
  const [internalUrl, setInternalUrl] = useState<string | null>(null);

  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      setInternalUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else if (externalAudioUrl) {
      setInternalUrl(externalAudioUrl);
    } else {
      setInternalUrl(null);
    }
  }, [audioBlob, externalAudioUrl]);

  useEffect(() => {
    if (!containerRef.current || !internalUrl) {
      setIsReady(false);
      return;
    }

    setIsReady(false);

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#94a3b8', // slate-400
      progressColor: '#2563eb', // blue-600
      cursorColor: '#1d4ed8',
      cursorWidth: 2,
      height: 64,
      barWidth: 3,
      barGap: 2,
      barRadius: 2,
      minPxPerSec: zoomLevel,
      normalize: true,
      url: internalUrl,
    });

    waveSurferRef.current = ws;

    ws.on('ready', () => {
      setIsReady(true);
      setDuration(ws.getDuration());
    });

    ws.on('timeupdate', (time) => {
      onTimeUpdate(time);
    });

    ws.on('seeking', (time) => {
      onSeek(time);
    });

    ws.on('play', () => {
      setIsPlaying(true);
      onPlayStateChange?.(true);
    });
    ws.on('pause', () => {
      setIsPlaying(false);
      onPlayStateChange?.(false);
    });
    ws.on('finish', () => {
      setIsPlaying(false);
      onPlayStateChange?.(false);
    });

    return () => {
      ws.destroy();
      waveSurferRef.current = null;
    };
  }, [internalUrl]);

  // Handle external seek triggers (e.g. user clicked transcript sentence)
  useEffect(() => {
    if (seekToTime !== null && seekToTime !== undefined && waveSurferRef.current && isReady) {
      const total = waveSurferRef.current.getDuration() || duration || 1;
      const progress = Math.max(0, Math.min(1, seekToTime / total));
      waveSurferRef.current.seekTo(progress);
    }
  }, [seekToTime, isReady]);

  // Handle zoom level changes
  useEffect(() => {
    if (waveSurferRef.current && isReady) {
      waveSurferRef.current.zoom(zoomLevel);
    }
  }, [zoomLevel, isReady]);

  const togglePlay = () => {
    if (!waveSurferRef.current) return;
    waveSurferRef.current.playPause();
  };

  const skipSeconds = (seconds: number) => {
    if (!waveSurferRef.current) return;
    const current = waveSurferRef.current.getCurrentTime();
    const target = Math.max(0, Math.min(duration, current + seconds));
    const progress = duration > 0 ? target / duration : 0;
    waveSurferRef.current.seekTo(progress);
  };

  const changeRate = (rate: number) => {
    setPlaybackRate(rate);
    if (waveSurferRef.current) {
      waveSurferRef.current.setPlaybackRate(rate);
    }
  };

  const toggleMute = () => {
    if (!waveSurferRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    waveSurferRef.current.setVolume(nextMuted ? 0 : volume);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${mins}:${s < 10 ? '0' : ''}${s}.${ms}`;
  };

  return (
    <div id="waveform-scrubber-card" className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-slate-900">
            {formatTime(currentTime)}
          </span>
          <span className="text-slate-400 text-xs">/</span>
          <span className="font-mono text-xs text-slate-500">
            {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            <button
              id="zoom-out-btn"
              onClick={() => setZoomLevel((prev) => Math.max(10, prev - 10))}
              className="p-1 hover:bg-white rounded text-slate-600 transition-colors"
              title="Zoom Out Waveform"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] px-1 font-mono text-slate-500">{zoomLevel}px</span>
            <button
              id="zoom-in-btn"
              onClick={() => setZoomLevel((prev) => Math.min(100, prev + 10))}
              className="p-1 hover:bg-white rounded text-slate-600 transition-colors"
              title="Zoom In Waveform"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Playback Speed selector */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 text-xs font-medium">
            {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
              <button
                key={rate}
                id={`rate-${rate}x-btn`}
                onClick={() => changeRate(rate)}
                title={`Set playback speed to ${rate}x`}
                className={`px-2 py-0.5 rounded transition-all ${
                  playbackRate === rate
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Waveform Canvas Container */}
      <div
        className="relative w-full bg-slate-50 rounded-lg p-2 border border-slate-100 mb-3 overflow-hidden"
        title="Click or drag on the waveform to seek playback"
      >
        <div ref={containerRef} id="wavesurfer-canvas-wrapper" className="w-full cursor-pointer" />
        {!internalUrl && (
          <div className="h-16 flex items-center justify-center text-xs text-slate-400">
            No audio recorded or loaded yet. Record screen/mic or load sample audio / video.
          </div>
        )}
      </div>

      {/* Primary playback control bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            id="audio-skip-back-btn"
            onClick={() => skipSeconds(-5)}
            disabled={!isReady}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
            title="Skip backward 5 seconds"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            id="audio-play-pause-btn"
            onClick={togglePlay}
            disabled={!isReady}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-xs disabled:opacity-40"
            title={isPlaying ? 'Pause audio (Space)' : 'Play audio (Space)'}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          <button
            id="audio-skip-fwd-btn"
            onClick={() => skipSeconds(5)}
            disabled={!isReady}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40"
            title="Skip forward 5 seconds"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Volume controls */}
        <div className="flex items-center gap-2">
          <button
            id="audio-mute-btn"
            onClick={toggleMute}
            title={isMuted ? 'Unmute audio' : 'Mute audio'}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            id="audio-volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVolume(val);
              setIsMuted(val === 0);
              if (waveSurferRef.current) {
                waveSurferRef.current.setVolume(val);
              }
            }}
            className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
      </div>
    </div>
  );
};
