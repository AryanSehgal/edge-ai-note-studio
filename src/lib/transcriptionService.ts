import { HardwareDevice, ModelLoadProgress, TranscriptSegment } from '../types';

export class TranscriptionService {
  private worker: Worker | null = null;
  private progressCallbacks: Array<(progress: ModelLoadProgress) => void> = [];
  private currentProgress: ModelLoadProgress = {
    status: 'idle',
    progress: 0,
    device: 'webgpu',
    modelName: 'onnx-community/whisper-tiny.en',
  };
  private pendingTranscriptions = new Map<
    string,
    {
      resolve: (data: { segments: TranscriptSegment[]; text: string; executionTimeMs: number }) => void;
      reject: (err: Error) => void;
    }
  >();

  constructor() {
    this.checkWebGPUSupport();
  }

  private checkWebGPUSupport() {
    const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
    this.currentProgress.device = hasWebGPU ? 'webgpu' : 'wasm';
  }

  public getProgress(): ModelLoadProgress {
    return { ...this.currentProgress };
  }

  public onProgress(cb: (progress: ModelLoadProgress) => void): () => void {
    this.progressCallbacks.push(cb);
    cb(this.currentProgress);
    return () => {
      this.progressCallbacks = this.progressCallbacks.filter((c) => c !== cb);
    };
  }

  private notifyProgress(update: Partial<ModelLoadProgress>) {
    this.currentProgress = { ...this.currentProgress, ...update };
    for (const cb of this.progressCallbacks) {
      cb(this.currentProgress);
    }
  }

  public async initWorker(): Promise<Worker> {
    if (this.worker) return this.worker;

    try {
      this.worker = new Worker(new URL('../workers/transcriber.worker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (event: MessageEvent) => {
        const { type, data, device, message, segments, text, chunkId, executionTimeMs } = event.data || {};

        if (type === 'progress') {
          const raw = data || {};
          let pct = 0;
          if (raw.progress !== undefined) {
            pct = Math.round(raw.progress);
          } else if (raw.loaded && raw.total) {
            pct = Math.round((raw.loaded / raw.total) * 100);
          }
          this.notifyProgress({
            status: 'loading',
            progress: Math.min(100, Math.max(0, pct)),
            file: raw.file || raw.name,
            loadedBytes: raw.loaded,
            totalBytes: raw.total,
            device: device || this.currentProgress.device,
          });
        } else if (type === 'status') {
          this.notifyProgress({
            status: 'loading',
            message: message,
            device: device || this.currentProgress.device,
          });
        } else if (type === 'ready') {
          this.notifyProgress({
            status: 'ready',
            progress: 100,
            device: device || 'webgpu',
            message: message || 'Model loaded and ready for transcription',
          });
        } else if (type === 'error') {
          this.notifyProgress({
            status: 'error',
            message: message || 'Failed to initialize Edge AI Whisper model',
          });
          if (chunkId && this.pendingTranscriptions.has(chunkId)) {
            const handlers = this.pendingTranscriptions.get(chunkId);
            handlers?.reject(new Error(message || 'Transcription error in Web Worker'));
            this.pendingTranscriptions.delete(chunkId);
          } else {
            // Reject all pending transcriptions immediately if generic model error occurred
            for (const [id, handlers] of this.pendingTranscriptions.entries()) {
              handlers.reject(new Error(message || 'Transcription error in Web Worker'));
              this.pendingTranscriptions.delete(id);
            }
          }
        } else if (type === 'chunk' || type === 'complete') {
          if (chunkId && this.pendingTranscriptions.has(chunkId)) {
            const handlers = this.pendingTranscriptions.get(chunkId);
            const formattedSegments: TranscriptSegment[] = (segments || []).map(
              (s: any, idx: number) => ({
                id: `seg_${Date.now()}_${idx}`,
                sessionId: '',
                startTime: s.start,
                endTime: s.end,
                textContent: s.text,
              })
            );
            handlers?.resolve({
              segments: formattedSegments,
              text: text || '',
              executionTimeMs: executionTimeMs || 0,
            });
            this.pendingTranscriptions.delete(chunkId);
          }
        }
      };

      this.worker.onerror = (err) => {
        console.error('Transcriber worker fatal error:', err);
        this.notifyProgress({
          status: 'error',
          message: 'Worker execution error: ' + (err.message || 'Worker thread crashed'),
        });
        for (const [id, handlers] of this.pendingTranscriptions.entries()) {
          handlers.reject(new Error(err.message || 'Worker thread crashed'));
          this.pendingTranscriptions.delete(id);
        }
      };

      return this.worker;
    } catch (err: any) {
      console.error('Failed to spawn transcriber worker:', err);
      this.notifyProgress({
        status: 'error',
        message: 'Could not create Web Worker: ' + (err.message || String(err)),
      });
      throw err;
    }
  }

  public async preloadModel(
    modelId = 'onnx-community/whisper-tiny.en',
    preferredDevice: HardwareDevice = 'webgpu'
  ): Promise<void> {
    const worker = await this.initWorker();
    this.notifyProgress({
      status: 'loading',
      progress: 5,
      modelName: modelId,
      device: preferredDevice,
      message: 'Downloading ONNX model weights to browser cache...',
    });

    worker.postMessage({
      type: 'load',
      modelId,
      device: preferredDevice,
    });
  }

  public async ensureModelReady(
    modelId = 'onnx-community/whisper-tiny.en',
    preferredDevice: HardwareDevice = 'webgpu'
  ): Promise<void> {
    if (this.currentProgress.status === 'ready') {
      return;
    }
    await this.preloadModel(modelId, preferredDevice);
    return new Promise((resolve) => {
      const unsub = this.onProgress((p) => {
        if (p.status === 'ready' || p.status === 'error') {
          unsub();
          resolve();
        }
      });
    });
  }

  public async transcribe(
    audioPcm16k: Float32Array,
    sessionId: string,
    isFinal = true
  ): Promise<{ segments: TranscriptSegment[]; text: string; executionTimeMs: number }> {
    const worker = await this.initWorker();

    const chunkId = `chunk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return new Promise((resolve, reject) => {
      // Generous safety timeout: on first run the browser may be downloading the
      // Whisper weights (and, on WASM CPU, inference is slower). We let the user wait
      // rather than fabricating a transcript. On timeout we surface a clear error so
      // the caller can show the audio-preserver fallback.
      let timeout = setTimeout(() => {
        if (this.pendingTranscriptions.has(chunkId)) {
          this.pendingTranscriptions.delete(chunkId);
          reject(
            new Error(
              'On-device transcription timed out. The model weights may still be downloading — try again shortly.'
            )
          );
        }
      }, 600000);

      this.pendingTranscriptions.set(chunkId, {
        resolve: (data) => {
          clearTimeout(timeout);
          // Stamp sessionId
          const stamped = data.segments.map((s) => ({ ...s, sessionId }));
          resolve({ ...data, segments: stamped });
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });

      // Pass audio slice so original Float32Array buffer is not detached
      worker.postMessage({
        type: 'transcribe',
        audio: audioPcm16k.slice(),
        chunkId,
        isFinal,
      });
    });
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export const transcriptionService = new TranscriptionService();
