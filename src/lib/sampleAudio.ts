import { TARGET_SAMPLE_RATE, encodeWAV, resampleAudioBufferTo16kHz } from './audioResampler';
import { TranscriptSegment } from '../types';

export interface SampleData {
  audioBlob: Blob;
  videoBlob?: Blob;
  pcm16k: Float32Array;
  duration: number;
  segments: TranscriptSegment[];
  notes: string;
}

export const KEYNOTE_SEGMENTS: Omit<TranscriptSegment, 'id' | 'sessionId'>[] = [
  {
    startTime: 0.0,
    endTime: 3.84,
    textContent: 'Welcome to Edge AI Screen and Audio Note Studio.',
  },
  {
    startTime: 4.19,
    endTime: 10.72,
    textContent: 'We are demonstrating 100 percent client-side speech recognition using Whisper AI.',
  },
  {
    startTime: 11.07,
    endTime: 17.69,
    textContent: 'WebGPU acceleration executes the neural network directly on your graphics card.',
  },
  {
    startTime: 18.04,
    endTime: 24.18,
    textContent: 'Raw audio never leaves your browser, ensuring absolute privacy and security.',
  },
  {
    startTime: 24.53,
    endTime: 30.55,
    textContent: 'Timestamps synchronize bidirectionally with the waveform scrubber and Markdown notes.',
  },
];

export const KEYNOTE_NOTES = `# 🎙️ Edge AI & WebGPU Architecture Keynote
- **Session Duration:** 30.6s
- **Hardware Mode:** WebGPU Hardware Accelerated
- **Privacy Model:** 100% Client-Side Local Edge Inference (Zero Cloud Ingress)

---

## ⚡ Keynote Highlights
- [00:00] **Welcome:** Overview of Edge AI Screen and Audio Note Studio.
- [00:04] **Client-Side AI:** Zero-cost transcription with OpenAI Whisper ONNX running 100% in-browser.
- [00:11] **WebGPU Acceleration:** Neural processing dispatched to your GPU via a background Web Worker.
- [00:18] **Zero Data Leakage:** Audio is processed and cached purely locally on your device.
- [00:24] **Bidirectional Synchronization:** Click any timestamp pill to jump audio scrubber and video playback.

### 💡 Interactive Tips
- Click on any transcript sentence or timestamp pill (e.g. [00:11]) to jump to that moment.
- Edit transcripts inline using the pencil button or append highlights directly into your notes.
- Use **Record Live** to record your screen and microphone or **Upload File** for your own media.
`;

export const NARRATION_SEGMENTS: Omit<TranscriptSegment, 'id' | 'sessionId'>[] = [
  {
    startTime: 0.0,
    endTime: 2.16,
    textContent: 'Going along slushy country roads and speaking to damp audiences',
  },
  {
    startTime: 2.16,
    endTime: 6.16,
    textContent: 'in drafty schoolrooms day after day for a fortnight.',
  },
  {
    startTime: 6.16,
    endTime: 10.53,
    textContent: "He'll have to put in an appearance at some place of worship on Sunday morning,",
  },
  {
    startTime: 10.53,
    endTime: 13.68,
    textContent: 'and he can come to us immediately afterwards.',
  },
];

export const NARRATION_NOTES = `# 🎙️ Spoken Audio Narration Note
- **Audio Duration:** 13.7s
- **Speech Engine:** 100% Client-Side WebGPU Whisper
- **Privacy:** 100% Local Inference (Zero External APIs)

---

## 📝 Synchronized Spoken Notes
- [00:00] Narrative begins: Going along slushy country roads and speaking to damp audiences...
- [00:02] Itinerary notes: In drafty schoolrooms day after day for a fortnight.
- [00:06] Appearance scheduled at a place of worship on Sunday morning.
- [00:10] Wrap-up session scheduled immediately afterwards.

### ⚡ Interactive Features
- Click on any timestamp pill (e.g. [00:06]) or any sentence in the transcript to jump audio playback.
- Spacebar or Play button scrubs through the waveform scrubber below.
`;

/**
 * Loads the spoken Keynote sample audio (/sample/keynote.wav)
 */
export async function loadKeynoteSample(sessionId: string): Promise<SampleData> {
  const segments: TranscriptSegment[] = KEYNOTE_SEGMENTS.map((s, idx) => ({
    id: `seg_${Date.now()}_${idx + 1}`,
    sessionId,
    startTime: s.startTime,
    endTime: s.endTime,
    textContent: s.textContent,
  }));

  try {
    const response = await fetch('/sample/keynote.wav');
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const audioBlob = new Blob([arrayBuffer], { type: 'audio/wav' });

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      const pcm16k = await resampleAudioBufferTo16kHz(decodedBuffer);
      audioCtx.close();

      return {
        audioBlob,
        pcm16k,
        duration: 30.55,
        segments,
        notes: KEYNOTE_NOTES,
      };
    }
  } catch (err) {
    console.warn('Could not load /sample/keynote.wav:', err);
  }

  const duration = 30.55;
  const numSamples = Math.floor(duration * TARGET_SAMPLE_RATE);
  const pcm16k = new Float32Array(numSamples);
  const audioBlob = encodeWAV(pcm16k, TARGET_SAMPLE_RATE);

  return {
    audioBlob,
    pcm16k,
    duration,
    segments,
    notes: KEYNOTE_NOTES,
  };
}

/**
 * Loads the sample presentation video (/sample/sample_video.mp4)
 */
export async function loadSampleVideo(sessionId: string): Promise<SampleData> {
  const segments: TranscriptSegment[] = KEYNOTE_SEGMENTS.map((s, idx) => ({
    id: `seg_${Date.now()}_${idx + 1}`,
    sessionId,
    startTime: s.startTime,
    endTime: s.endTime,
    textContent: s.textContent,
  }));

  try {
    const [videoRes, audioRes] = await Promise.all([
      fetch('/sample/sample_video.mp4'),
      fetch('/sample/keynote.wav'),
    ]);

    if (videoRes.ok && audioRes.ok) {
      const videoBlob = await videoRes.blob();
      const audioArrayBuffer = await audioRes.arrayBuffer();
      const audioBlob = new Blob([audioArrayBuffer], { type: 'audio/wav' });

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const decodedBuffer = await audioCtx.decodeAudioData(audioArrayBuffer.slice(0));
      const pcm16k = await resampleAudioBufferTo16kHz(decodedBuffer);
      audioCtx.close();

      return {
        audioBlob,
        videoBlob,
        pcm16k,
        duration: 30.55,
        segments,
        notes: KEYNOTE_NOTES,
      };
    }
  } catch (err) {
    console.warn('Could not load sample video:', err);
  }

  return loadKeynoteSample(sessionId);
}

/**
 * Loads real audible spoken narration speech from /sample/sample.wav
 */
export async function loadSampleAudioAndTranscript(sessionId: string): Promise<SampleData> {
  const segments: TranscriptSegment[] = NARRATION_SEGMENTS.map((s, idx) => ({
    id: `seg_${Date.now()}_${idx + 1}`,
    sessionId,
    startTime: s.startTime,
    endTime: s.endTime,
    textContent: s.textContent,
  }));

  try {
    const response = await fetch('/sample/sample.wav');
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const audioBlob = new Blob([arrayBuffer], { type: 'audio/wav' });

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      const pcm16k = await resampleAudioBufferTo16kHz(decodedBuffer);
      audioCtx.close();

      return {
        audioBlob,
        pcm16k,
        duration: 13.69,
        segments,
        notes: NARRATION_NOTES,
      };
    }
  } catch (err) {
    console.warn('Could not load /sample/sample.wav:', err);
  }

  const duration = 13.69;
  const numSamples = Math.floor(duration * TARGET_SAMPLE_RATE);
  const pcm16k = new Float32Array(numSamples);
  const audioBlob = encodeWAV(pcm16k, TARGET_SAMPLE_RATE);

  return {
    audioBlob,
    pcm16k,
    duration,
    segments,
    notes: NARRATION_NOTES,
  };
}

