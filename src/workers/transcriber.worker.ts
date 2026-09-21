/// <reference lib="webworker" />
import { pipeline, env } from '@huggingface/transformers';

// Configure environment for client-side edge inference
env.allowLocalModels = false;
// Enable browser cache storage for zero-cost offline edge inference
env.useBrowserCache = true;

// ONNX Runtime WASM threading requires SharedArrayBuffer, which is only available when
// the page is cross-origin isolated (COOP/COEP). When it is not (plain static hosting or
// the local dev server), fall back to single-threaded CPU inference so it always runs.
// WebGPU users are unaffected — this only governs the WASM CPU path.
const ortWasm = (env.backends?.onnx as any)?.wasm;
if (ortWasm) {
  ortWasm.numThreads = self.crossOriginIsolated ? 4 : 1;
  ortWasm.proxy = false;
}

let transcriber: any = null;
let currentModelId = 'onnx-community/whisper-tiny.en';
let activeDevice: 'webgpu' | 'wasm' = 'webgpu';

async function loadModel(modelId = 'onnx-community/whisper-tiny.en', preferredDevice: 'webgpu' | 'wasm' = 'webgpu') {
  currentModelId = modelId;

  // Check if WebGPU is available in current worker context
  const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
  let targetDevice = preferredDevice === 'webgpu' && hasWebGPU ? 'webgpu' : 'wasm';

  self.postMessage({
    type: 'status',
    message: `Initializing Edge AI pipeline on ${targetDevice.toUpperCase()}...`,
    device: targetDevice,
  });

  try {
    transcriber = await pipeline('automatic-speech-recognition', modelId, {
      device: targetDevice as any,
      progress_callback: (progress: any) => {
        self.postMessage({
          type: 'progress',
          data: progress,
          device: targetDevice,
        });
      },
    });
    activeDevice = targetDevice as 'webgpu' | 'wasm';

    self.postMessage({
      type: 'ready',
      device: activeDevice,
      modelName: currentModelId,
      message: `Model loaded successfully via ${activeDevice.toUpperCase()}`,
    });
  } catch (err: any) {
    console.warn(`Failed to initialize on ${targetDevice}:`, err);
    if (targetDevice === 'webgpu') {
      // Automatic fallback to WASM as mandated by PRD
      targetDevice = 'wasm';
      self.postMessage({
        type: 'status',
        message: 'WebGPU failed or unsupported. Falling back to WebAssembly (WASM)...',
        device: 'wasm',
      });

      try {
        transcriber = await pipeline('automatic-speech-recognition', modelId, {
          device: 'wasm' as any,
          progress_callback: (progress: any) => {
            self.postMessage({
              type: 'progress',
              data: progress,
              device: 'wasm',
            });
          },
        });
        activeDevice = 'wasm';
        self.postMessage({
          type: 'ready',
          device: activeDevice,
          modelName: currentModelId,
          message: 'Model loaded successfully via WASM fallback',
        });
      } catch (wasmErr: any) {
        self.postMessage({
          type: 'error',
          message: wasmErr?.message || 'Failed to load Whisper model in WebAssembly',
        });
      }
    } else {
      self.postMessage({
        type: 'error',
        message: err?.message || 'Failed to load Whisper model',
      });
    }
  }
}

async function transcribeAudio(audioData: Float32Array, chunkId?: string, isFinal = false) {
  try {
    if (!transcriber) {
      await loadModel(currentModelId, activeDevice);
    }

    if (!transcriber) {
      self.postMessage({
        type: 'error',
        chunkId,
        message: 'Transcriber pipeline could not be initialized in this environment',
      });
      return;
    }

    const startTime = performance.now();

    // Run Whisper speech recognition with timestamp support
    const result = await transcriber(audioData, {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
      language: 'english',
      task: 'transcribe',
    });

    const executionTimeMs = performance.now() - startTime;
    const fullText = (result.text || '').trim();

    let segments: Array<{ start: number; end: number; text: string }> = [];

    if (Array.isArray(result.chunks) && result.chunks.length > 0) {
      segments = result.chunks
        .map((chunk: any) => {
          const start = Array.isArray(chunk.timestamp) ? Number(chunk.timestamp[0]) || 0 : 0;
          const end = Array.isArray(chunk.timestamp) ? Number(chunk.timestamp[1]) || start + 2 : start + 2;
          return {
            start: Math.round(start * 100) / 100,
            end: Math.round(end * 100) / 100,
            text: (chunk.text || '').trim(),
          };
        })
        .filter((s: any) => s.text.length > 0);
    }

    // If no chunks were returned or only full text
    if (segments.length === 0 && fullText.length > 0) {
      const audioDuration = audioData.length / 16000;
      segments = [
        {
          start: 0,
          end: Math.round(audioDuration * 100) / 100,
          text: fullText,
        },
      ];
    }

    self.postMessage({
      type: isFinal ? 'complete' : 'chunk',
      chunkId,
      segments,
      text: fullText,
      executionTimeMs,
      device: activeDevice,
    });
  } catch (err: any) {
    self.postMessage({
      type: 'error',
      chunkId,
      message: err?.message || 'Transcription error during audio processing',
    });
  }
}

self.onmessage = async (event: MessageEvent) => {
  const { type, modelId, device, audio, chunkId, isFinal } = event.data || {};

  if (type === 'load') {
    await loadModel(modelId, device);
  } else if (type === 'transcribe') {
    if (!audio) {
      self.postMessage({ type: 'error', message: 'No audio data received' });
      return;
    }
    await transcribeAudio(audio, chunkId, isFinal);
  }
};
