import { TranscriptSegment, HardwareDevice, ModelLoadProgress } from '../types';

export interface LLMAnalysisResult {
  title: string;
  summary: string;
  keynotes: string[];
  actionItems: string[];
  modelUsed: string;
  executionTimeMs?: number;
}

export class LLMService {
  private worker: Worker | null = null;
  private progressCallbacks: Array<(progress: ModelLoadProgress) => void> = [];
  private currentProgress: ModelLoadProgress = {
    status: 'idle',
    progress: 0,
    device: 'webgpu',
    modelName: 'Xenova/flan-t5-small',
  };
  private pendingJobs = new Map<
    string,
    {
      resolve: (data: any) => void;
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
      this.worker = new Worker(new URL('../workers/llm.worker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (event: MessageEvent) => {
        const { type, data, device, message, jobId, title, summary, takeaway, executionTimeMs, modelName } =
          event.data || {};

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
            device: device || this.currentProgress.device,
            modelName: modelName || this.currentProgress.modelName,
          });
        } else if (type === 'status') {
          this.notifyProgress({
            status: 'loading',
            message,
            device: device || this.currentProgress.device,
          });
        } else if (type === 'ready') {
          this.notifyProgress({
            status: 'ready',
            progress: 100,
            device: device || 'webgpu',
            message: message || 'Pretrained On-Device LLM Ready',
            modelName: modelName || this.currentProgress.modelName,
          });
        } else if (type === 'error') {
          if (jobId && this.pendingJobs.has(jobId)) {
            const handlers = this.pendingJobs.get(jobId);
            handlers?.reject(new Error(message || 'LLM error'));
            this.pendingJobs.delete(jobId);
          }
        } else if (type === 'complete') {
          if (jobId && this.pendingJobs.has(jobId)) {
            const handlers = this.pendingJobs.get(jobId);
            handlers?.resolve({
              title,
              summary,
              takeaway,
              executionTimeMs,
              device,
              modelName,
            });
            this.pendingJobs.delete(jobId);
          }
        }
      };

      this.worker.onerror = (err) => {
        console.warn('LLM Worker encountered error:', err);
        for (const [id, handlers] of this.pendingJobs.entries()) {
          handlers.reject(new Error(err.message || 'LLM Worker crashed'));
          this.pendingJobs.delete(id);
        }
      };

      return this.worker;
    } catch (err) {
      console.warn('Could not spawn LLM worker:', err);
      throw err;
    }
  }

  public async preloadModel(
    modelId = 'Xenova/flan-t5-small',
    preferredDevice: HardwareDevice = 'webgpu'
  ): Promise<void> {
    const worker = await this.initWorker();
    this.notifyProgress({
      status: 'loading',
      progress: 5,
      modelName: modelId,
      device: preferredDevice,
      message: 'Downloading On-Device LLM weights to browser cache...',
    });

    worker.postMessage({
      type: 'load',
      modelId,
      device: preferredDevice,
    });
  }

  /**
   * Fast, reliable extractive on-device NLP analyzer for immediate headings & summaries
   * Runs 100% in browser with zero external calls or dependencies.
   */
  public extractOnDeviceAnalysis(
    transcripts: TranscriptSegment[],
    fallbackTitle = 'Studio Session'
  ): LLMAnalysisResult {
    const textLines = transcripts.map((t) => t.textContent.trim()).filter(Boolean);
    const fullText = textLines.join(' ');

    if (!fullText || fullText.length < 5) {
      return {
        title: fallbackTitle,
        summary: `Session recorded with ${transcripts.length} transcript segments.`,
        keynotes: [`[00:00] Initialized session`],
        actionItems: ['Review transcript soundbites in the timeline'],
        modelUsed: 'On-Device NLP Analyzer',
      };
    }

    // 1. Generate Intelligent Heading from transcripts
    let candidateTitle = '';
    const words = fullText.split(/\s+/);

    // Look for introductory statements or key subject matter
    for (const line of textLines) {
      const clean = line.replace(/^(today we are talking about|welcome to|this is|we're discussing|going to talk about|in this session|agenda is)\s*/i, '');
      if (clean.length > 5 && clean.length < 50 && clean.split(' ').length >= 2) {
        candidateTitle = clean.split('.')[0].trim();
        break;
      }
    }

    if (!candidateTitle) {
      // Pick first 4-6 meaningful words, capitalized
      const stopwords = new Set([
        'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'is', 'are', 'was', 'were', 'it', 'we', 'i', 'you', 'this', 'that', 'with', 'so', 'just'
      ]);
      const meaningful = words.filter((w) => !stopwords.has(w.toLowerCase().replace(/[^a-z]/g, ''))).slice(0, 5);
      if (meaningful.length > 0) {
        candidateTitle = meaningful.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
    }

    const title = candidateTitle && candidateTitle.length >= 4 ? candidateTitle : fallbackTitle;

    // 2. Generate Keynote Highlights with timestamps
    const keynotes: string[] = [];
    const count = Math.min(4, transcripts.length);
    const step = Math.max(1, Math.floor(transcripts.length / count));
    for (let i = 0; i < transcripts.length && keynotes.length < 4; i += step) {
      const seg = transcripts[i];
      if (seg && seg.textContent) {
        const mins = Math.floor(seg.startTime / 60);
        const secs = Math.floor(seg.startTime % 60);
        const timeStr = `[${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}]`;
        keynotes.push(`${timeStr} ${seg.textContent.trim()}`);
      }
    }

    // 3. Generate Executive Summary
    const sentences = fullText.split(/(?<=[.?!])\s+/).filter((s) => s.length > 15);
    let summary = '';
    if (sentences.length >= 2) {
      summary = `${sentences[0]} ${sentences[1]}`;
    } else if (sentences.length === 1) {
      summary = sentences[0];
    } else {
      summary = `Discussion centered on ${title}, recorded with ${transcripts.length} timestamped speech segments.`;
    }

    // 4. Action items extraction
    const actionItems: string[] = [];
    for (const line of textLines) {
      if (/\b(need to|should|will|going to|action|follow up|schedule|review|ensure|implement)\b/i.test(line)) {
        actionItems.push(line.replace(/^[a-z]/, (c) => c.toUpperCase()));
        if (actionItems.length >= 3) break;
      }
    }
    if (actionItems.length === 0) {
      actionItems.push(`Review key points discussed in ${title}`);
      actionItems.push('Export synchronized Markdown notes or WebVTT transcript');
    }

    return {
      title,
      summary,
      keynotes,
      actionItems,
      modelUsed: 'On-Device Edge NLP',
    };
  }

  /**
   * Generates a context-aware heading and rich summary using the Pretrained On-Device LLM,
   * with seamless fallback to on-device NLP if model is still downloading or on WASM.
   */
  public async generateTitleAndSummary(
    transcripts: TranscriptSegment[],
    fallbackTitle = 'Studio Session'
  ): Promise<LLMAnalysisResult> {
    const textLines = transcripts.map((t) => t.textContent.trim()).filter(Boolean);
    const fullTranscript = textLines.join(' ');

    if (!fullTranscript || fullTranscript.length < 5) {
      return this.extractOnDeviceAnalysis(transcripts, fallbackTitle);
    }

    // Attempt neural generation via Web Worker if available
    try {
      const worker = await this.initWorker();
      const jobId = `llm_job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const neuralPromise = new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (this.pendingJobs.has(jobId)) {
            this.pendingJobs.delete(jobId);
            reject(new Error('LLM generation timed out'));
          }
        }, 90000); // 90s: covers first-run WASM CPU inference after weights are cached

        this.pendingJobs.set(jobId, {
          resolve: (val) => {
            clearTimeout(timeout);
            resolve(val);
          },
          reject: (err) => {
            clearTimeout(timeout);
            reject(err);
          },
        });

        worker.postMessage({
          type: 'generate',
          jobId,
          transcriptText: fullTranscript,
        });
      });

      const result = await neuralPromise;

      const fastAnalysis = this.extractOnDeviceAnalysis(transcripts, fallbackTitle);

      const cleanTitle = result.title && result.title.length >= 3 ? result.title : fastAnalysis.title;
      const cleanSummary = result.summary && result.summary.length >= 10 ? result.summary : fastAnalysis.summary;

      return {
        title: cleanTitle,
        summary: cleanSummary,
        keynotes: fastAnalysis.keynotes,
        actionItems: fastAnalysis.actionItems,
        modelUsed: `On-Device Pretrained LLM (${result.modelName || 'Flan-T5'})`,
        executionTimeMs: result.executionTimeMs,
      };
    } catch (workerErr) {
      console.warn('Neural LLM fallback to on-device NLP extractor:', workerErr);
      return this.extractOnDeviceAnalysis(transcripts, fallbackTitle);
    }
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export const llmService = new LLMService();
