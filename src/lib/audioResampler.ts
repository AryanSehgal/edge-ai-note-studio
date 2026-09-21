/**
 * Audio Resampling & Processing Engine
 * Downsamples any browser audio sample rate (44.1kHz / 48kHz) to 16,000 Hz single-channel mono Float32Array PCM
 * required by Whisper models, creates standard WAV Blobs, and provides real-time level analysis.
 */

export const TARGET_SAMPLE_RATE = 16000;

/**
 * Resamples an AudioBuffer to 16kHz mono Float32Array using an OfflineAudioContext
 */
export async function resampleAudioBufferTo16kHz(audioBuffer: AudioBuffer): Promise<Float32Array> {
  const numChannels = audioBuffer.numberOfChannels;
  const duration = audioBuffer.duration;
  const targetLength = Math.max(1, Math.round(duration * TARGET_SAMPLE_RATE));

  // If already 16kHz and 1 channel
  if (audioBuffer.sampleRate === TARGET_SAMPLE_RATE && numChannels === 1) {
    return audioBuffer.getChannelData(0);
  }

  // Use OfflineAudioContext for high-quality sinc-interpolation resampling
  const offlineCtx = new OfflineAudioContext(1, targetLength, TARGET_SAMPLE_RATE);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;

  // If stereo or multi-channel, merge down to mono
  if (numChannels > 1) {
    const merger = offlineCtx.createChannelMerger(1);
    source.connect(merger);
    merger.connect(offlineCtx.destination);
  } else {
    source.connect(offlineCtx.destination);
  }

  source.start(0);
  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer.getChannelData(0);
}

/**
 * Decodes an audio Blob (from MediaRecorder or File) and resamples it to 16kHz mono Float32Array
 */
export async function decodeAndResampleBlob(blob: Blob): Promise<{
  pcmData: Float32Array;
  duration: number;
  sampleRate: number;
}> {
  const arrayBuffer = await blob.arrayBuffer();
  // We use standard AudioContext to decode whatever audio format MediaRecorder produced (webm, ogg, wav)
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  try {
    const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const pcm16k = await resampleAudioBufferTo16kHz(decodedBuffer);
    return {
      pcmData: pcm16k,
      duration: decodedBuffer.duration,
      sampleRate: TARGET_SAMPLE_RATE,
    };
  } finally {
    if (audioCtx.state !== 'closed') {
      await audioCtx.close();
    }
  }
}

/**
 * Encodes Float32Array PCM samples into standard 16-bit PCM WAV Blob
 */
export function encodeWAV(samples: Float32Array, sampleRate = TARGET_SAMPLE_RATE): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF identifier
  writeString(0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF type
  writeString(8, 'WAVE');
  // format chunk identifier
  writeString(12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // channel count (1 = mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * channels * bytesPerSample)
  view.setUint32(28, sampleRate * 1 * 2, true);
  // block align (channels * bytesPerSample)
  view.setUint16(32, 1 * 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(36, 'data');
  // data chunk length
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Audio meter analyzer helper for live UI VU-meter feedback
 */
export class AudioMeterAnalyzer {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;

  connectStream(stream: MediaStream): void {
    if (stream.getAudioTracks().length === 0) return;

    this.disconnect();
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.5;

    this.source = this.audioCtx.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  getVolumeLevel(): number {
    if (!this.analyser || !this.dataArray) return 0;
    this.analyser.getByteFrequencyData(this.dataArray as any);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const average = sum / this.dataArray.length;
    // Map 0-255 to 0-1
    return Math.min(1, average / 128);
  }

  disconnect(): void {
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {}
      this.source = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
    this.analyser = null;
    this.dataArray = null;
  }
}

/**
 * Converts a Blob into base64 string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      const base64 = res.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
