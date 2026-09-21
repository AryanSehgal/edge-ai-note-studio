export interface TranscriptSegment {
  id: string;
  sessionId: string;
  startTime: number; // in seconds, e.g. 0.00
  endTime: number;   // in seconds, e.g. 3.42
  textContent: string;
  confidence?: number;
}

export interface UserNote {
  id: string;
  sessionId: string;
  markdownBody: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  durationSeconds: number;
  transcripts: TranscriptSegment[];
  note: UserNote | null;
  hasAudioBlob?: boolean;
  hasVideo?: boolean;
  videoUrl?: string | null;
}

export interface SessionSummary {
  id: string;
  user_id?: string;
  title: string;
  created_at: string;
  duration_seconds: number;
  transcript_count: number;
  has_notes: boolean;
  note_updated_at?: string | null;
  has_video?: boolean;
  hasVideo?: boolean;
}

export type HardwareDevice = 'webgpu' | 'wasm' | 'cpu';

export interface ModelLoadProgress {
  status: 'idle' | 'loading' | 'ready' | 'error';
  progress: number; // 0 - 100
  device: HardwareDevice;
  modelName: string;
  message?: string;
  file?: string;
  loadedBytes?: number;
  totalBytes?: number;
}

export type RecordingSource = 'screen-and-mic' | 'screen-only' | 'mic-only';

export interface WorkerMessageRequest {
  type: 'load' | 'transcribe';
  modelId?: string;
  device?: HardwareDevice;
  audio?: Float32Array;
  sampleRate?: number;
  chunkId?: string;
  isFinal?: boolean;
}

export interface WorkerMessageResponse {
  type: 'status' | 'progress' | 'ready' | 'chunk' | 'complete' | 'error';
  device?: HardwareDevice;
  data?: any;
  message?: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  text?: string;
  executionTimeMs?: number;
}
