/// <reference lib="webworker" />
import { pipeline, env } from '@huggingface/transformers';

// Configure environment for purely client-side edge LLM inference
env.allowLocalModels = false;
env.useBrowserCache = true;

// ONNX Runtime WASM threading requires SharedArrayBuffer (cross-origin isolation only).
// Fall back to single-threaded CPU inference when those headers are absent so the LLM
// always runs, on both static hosting and the local dev server.
const ortWasm = (env.backends?.onnx as any)?.wasm;
if (ortWasm) {
  ortWasm.numThreads = self.crossOriginIsolated ? 4 : 1;
  ortWasm.proxy = false;
}

let llmPipeline: any = null;
let currentModelId = 'Xenova/flan-t5-small';
let activeDevice: 'webgpu' | 'wasm' = 'webgpu';

async function loadLLM(modelId = 'Xenova/flan-t5-small', preferredDevice: 'webgpu' | 'wasm' = 'webgpu') {
  currentModelId = modelId;
  const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
  let targetDevice = preferredDevice === 'webgpu' && hasWebGPU ? 'webgpu' : 'wasm';

  self.postMessage({
    type: 'status',
    message: `Loading Pretrained On-Device LLM (${modelId}) on ${targetDevice.toUpperCase()}...`,
    device: targetDevice,
  });

  try {
    llmPipeline = await pipeline('text2text-generation', modelId, {
      device: targetDevice as any,
      progress_callback: (progress: any) => {
        self.postMessage({
          type: 'progress',
          data: progress,
          device: targetDevice,
          modelName: currentModelId,
        });
      },
    });
    activeDevice = targetDevice as 'webgpu' | 'wasm';

    self.postMessage({
      type: 'ready',
      device: activeDevice,
      modelName: currentModelId,
      message: `Pretrained LLM ready on ${activeDevice.toUpperCase()}`,
    });
  } catch (err: any) {
    console.warn(`LLM failed on ${targetDevice}, trying WASM fallback:`, err);
    if (targetDevice === 'webgpu') {
      targetDevice = 'wasm';
      self.postMessage({
        type: 'status',
        message: 'Falling back to WebAssembly (WASM CPU) for Pretrained LLM...',
        device: 'wasm',
      });

      try {
        llmPipeline = await pipeline('text2text-generation', modelId, {
          device: 'wasm' as any,
          progress_callback: (progress: any) => {
            self.postMessage({
              type: 'progress',
              data: progress,
              device: 'wasm',
              modelName: currentModelId,
            });
          },
        });
        activeDevice = 'wasm';
        self.postMessage({
          type: 'ready',
          device: activeDevice,
          modelName: currentModelId,
          message: 'Pretrained LLM ready via WebAssembly (CPU)',
        });
      } catch (wasmErr: any) {
        self.postMessage({
          type: 'error',
          message: wasmErr?.message || 'Failed to initialize Pretrained LLM in WASM',
        });
      }
    } else {
      self.postMessage({
        type: 'error',
        message: err?.message || 'Failed to initialize Pretrained LLM',
      });
    }
  }
}

async function runInference(jobId: string, transcriptText: string) {
  try {
    if (!llmPipeline) {
      await loadLLM(currentModelId, activeDevice);
    }

    if (!llmPipeline) {
      self.postMessage({
        type: 'error',
        jobId,
        message: 'LLM pipeline not initialized',
      });
      return;
    }

    const startTime = performance.now();
    const cleanTranscript = transcriptText.slice(0, 1500); // Keep focused prompt context

    // 1. Generate Title / Heading
    const titlePrompt = `Generate a concise 3 to 6 word title for this recording:\n${cleanTranscript}\nTitle:`;
    const titleOutput = await llmPipeline(titlePrompt, {
      max_new_tokens: 20,
      temperature: 0.3,
    });
    let rawTitle = (titleOutput[0]?.generated_text || '').replace(/^Title:\s*/i, '').trim();
    rawTitle = rawTitle.replace(/["'*]/g, '').trim();

    // 2. Generate Executive Summary
    const summaryPrompt = `Summarize this recording in two concise sentences:\n${cleanTranscript}\nSummary:`;
    const summaryOutput = await llmPipeline(summaryPrompt, {
      max_new_tokens: 90,
      temperature: 0.3,
    });
    let rawSummary = (summaryOutput[0]?.generated_text || '').replace(/^Summary:\s*/i, '').trim();

    // 3. Generate Key Takeaway
    const keyPrompt = `What is the main takeaway of this discussion:\n${cleanTranscript}\nTakeaway:`;
    const keyOutput = await llmPipeline(keyPrompt, {
      max_new_tokens: 60,
      temperature: 0.3,
    });
    let rawKeytakeaway = (keyOutput[0]?.generated_text || '').replace(/^Takeaway:\s*/i, '').trim();

    const executionTimeMs = performance.now() - startTime;

    self.postMessage({
      type: 'complete',
      jobId,
      title: rawTitle,
      summary: rawSummary,
      takeaway: rawKeytakeaway,
      executionTimeMs,
      device: activeDevice,
      modelName: currentModelId,
    });
  } catch (err: any) {
    self.postMessage({
      type: 'error',
      jobId,
      message: err?.message || 'Error during LLM inference',
    });
  }
}

self.onmessage = async (event: MessageEvent) => {
  const { type, modelId, device, transcriptText, jobId } = event.data || {};

  if (type === 'load') {
    await loadLLM(modelId, device);
  } else if (type === 'generate') {
    await runInference(jobId, transcriptText || '');
  }
};
