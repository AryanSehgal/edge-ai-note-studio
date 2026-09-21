import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, FileAudio, FileVideo, CheckCircle2, AlertCircle, RefreshCw, Music, Video } from 'lucide-react';
import { TARGET_SAMPLE_RATE, encodeWAV, resampleAudioBufferTo16kHz } from '../lib/audioResampler';

interface MediaUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (
    audioBlob: Blob,
    audioPcm16k: Float32Array,
    fileName: string,
    durationSecs: number,
    videoFile?: File | Blob | null
  ) => Promise<void>;
  onLoadSampleAudio?: () => void;
  onLoadSampleVideo?: () => void;
}

export const MediaUploadModal: React.FC<MediaUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadComplete,
  onLoadSampleAudio,
  onLoadSampleVideo,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close modal on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    if (!file) return;

    // Check media mime types or extensions
    const validExtensions = /\.(mp3|wav|m4a|aac|ogg|flac|webm|mp4|mov|mkv)$/i;
    const isValid = file.type.startsWith('audio/') || file.type.startsWith('video/') || validExtensions.test(file.name);

    if (!isValid) {
      setErrorMessage('Please upload a valid audio or video file (MP3, WAV, M4A, WebM, MP4, etc.).');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);
    setProcessingStatus(`Reading "${file.name}" into local memory...`);

    try {
      const arrayBuffer = await file.arrayBuffer();

      setProcessingStatus('Extracting audio & resampling to 16kHz PCM for Speech AI...');
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();

      // Decode audio (works for both audio files and video files with audio tracks!)
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const duration = audioBuffer.duration;

      // Resample to 16kHz single-channel Float32Array PCM for Whisper
      const pcm16k = await resampleAudioBufferTo16kHz(audioBuffer);
      const wavBlob = encodeWAV(pcm16k, TARGET_SAMPLE_RATE);
      await audioCtx.close();

      setProcessingStatus('Running 100% client-side transcription...');
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(file.name);

      await onUploadComplete(wavBlob, pcm16k, cleanTitle, duration, isVideo ? file : null);
      setIsProcessing(false);
      onClose();
    } catch (err: any) {
      console.error('File audio extraction error:', err);
      setIsProcessing(false);
      setErrorMessage(
        err.message || 'Could not decode audio from this file. Please ensure it contains a valid audio stream.'
      );
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
      <div
        id="media-upload-modal"
        className="w-full max-w-lg max-h-[calc(100vh-2rem)] sm:max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Upload className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 truncate">Upload Audio or Video File</h2>
              <p className="text-[11px] text-slate-500 truncate">
                100% Client-Side • Decoded in browser • Zero external upload
              </p>
            </div>
          </div>

          {!isProcessing && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Close upload dialog"
              aria-label="Close upload dialog"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 flex-1 overflow-y-auto min-h-0">
          {isProcessing ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">Processing Media File</h3>
              <p className="text-xs text-slate-600 font-medium max-w-xs">{processingStatus}</p>
              <p className="text-[11px] text-slate-400">
                Audio is decoded and resampled locally on your device
              </p>
            </div>
          ) : (
            <div
              id="upload-dropzone"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/60 scale-[1.01]'
                  : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/80 bg-slate-50/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm,.mp4,.mov,.mkv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />

              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-2xs">
                  <FileAudio className="w-5 h-5" />
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-2xs">
                  <FileVideo className="w-5 h-5" />
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Click to select or drag and drop a file
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports MP3, WAV, M4A, FLAC, WebM, MP4, MOV & more
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-full text-[11px] text-slate-600 font-medium shadow-2xs">
                <span>⚡ Immediate local transcription</span>
              </div>
            </div>
          )}

          {/* Quick sample loading buttons */}
          {!isProcessing && (onLoadSampleAudio || onLoadSampleVideo) && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-50/80 p-3 rounded-xl">
              <span className="text-xs text-slate-600 font-medium">Or test with instant samples:</span>
              <div className="flex items-center gap-2">
                {onLoadSampleAudio && (
                  <button
                    type="button"
                    onClick={() => {
                      onLoadSampleAudio();
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                    title="Load audible spoken speech sample into this session"
                  >
                    <Music className="w-3.5 h-3.5 text-blue-600" />
                    <span>Sample Audio</span>
                  </button>
                )}
                {onLoadSampleVideo && (
                  <button
                    type="button"
                    onClick={() => {
                      onLoadSampleVideo();
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                    title="Load presentation video sample into this session"
                  >
                    <Video className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Sample Video</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            🔒 Files stay in browser memory. Zero external server upload.
          </p>
          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 bg-white rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
