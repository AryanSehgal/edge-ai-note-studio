/**
 * Client-Side IndexedDB Storage for Audio Blobs, Video Blobs, and Session records.
 * Ensures 100% data privacy: recordings, transcripts, and notes remain strictly on the
 * local client device and are never transferred over the network to any server.
 */

import { Session, SessionSummary } from '../types';

const DB_NAME = 'EdgeAINoteStudioAudioDB';
const DB_VERSION = 3;
const STORE_NAME = 'audio_blobs';
const VIDEO_STORE_NAME = 'video_blobs';
const SESSION_STORE_NAME = 'sessions';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
      }
      if (!db.objectStoreNames.contains(VIDEO_STORE_NAME)) {
        db.createObjectStore(VIDEO_STORE_NAME, { keyPath: 'sessionId' });
      }
      if (!db.objectStoreNames.contains(SESSION_STORE_NAME)) {
        const sessionStore = db.createObjectStore(SESSION_STORE_NAME, { keyPath: 'id' });
        sessionStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAudioBlob(sessionId: string, blob: Blob): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const putRequest = store.put({
        sessionId,
        blob,
        savedAt: new Date().toISOString(),
        sizeBytes: blob.size,
        mimeType: blob.type,
      });

      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });
  } catch (err) {
    console.warn('Failed to save audio blob to IndexedDB:', err);
  }
}

export async function getAudioBlob(sessionId: string): Promise<Blob | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(sessionId);

      getRequest.onsuccess = () => {
        if (getRequest.result && getRequest.result.blob) {
          resolve(getRequest.result.blob);
        } else {
          resolve(null);
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  } catch (err) {
    console.warn('Failed to get audio blob from IndexedDB:', err);
    return null;
  }
}

export async function deleteAudioBlob(sessionId: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const delRequest = store.delete(sessionId);

      delRequest.onsuccess = () => resolve();
      delRequest.onerror = () => reject(delRequest.error);
    });
  } catch (err) {
    console.warn('Failed to delete audio blob from IndexedDB:', err);
  }
}

export async function saveVideoBlob(sessionId: string, blob: Blob): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(VIDEO_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(VIDEO_STORE_NAME);
      const putRequest = store.put({
        sessionId,
        blob,
        savedAt: new Date().toISOString(),
        sizeBytes: blob.size,
        mimeType: blob.type,
      });

      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });
  } catch (err) {
    console.warn('Failed to save video blob to IndexedDB:', err);
  }
}

export async function getVideoBlob(sessionId: string): Promise<Blob | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(VIDEO_STORE_NAME, 'readonly');
      const store = transaction.objectStore(VIDEO_STORE_NAME);
      const getRequest = store.get(sessionId);

      getRequest.onsuccess = () => {
        if (getRequest.result && getRequest.result.blob) {
          resolve(getRequest.result.blob);
        } else {
          resolve(null);
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  } catch (err) {
    console.warn('Failed to get video blob from IndexedDB:', err);
    return null;
  }
}

export async function deleteVideoBlob(sessionId: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(VIDEO_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(VIDEO_STORE_NAME);
      const delRequest = store.delete(sessionId);

      delRequest.onsuccess = () => resolve();
      delRequest.onerror = () => reject(delRequest.error);
    });
  } catch (err) {
    console.warn('Failed to delete video blob from IndexedDB:', err);
  }
}

/**
 * Session record persistence (replaces the former Express /api backend).
 * Full Session objects (transcripts + notes) are stored locally; audio/video
 * blobs live in their own stores keyed by the same session id.
 */
export async function saveSession(session: Session): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSION_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(SESSION_STORE_NAME);
      // Never persist transient object URLs; the blob is stored separately.
      const toStore: Session = { ...session, videoUrl: null };
      const putRequest = store.put(toStore);

      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });
  } catch (err) {
    console.warn('Failed to save session to IndexedDB:', err);
  }
}

export async function getSession(sessionId: string): Promise<Session | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSION_STORE_NAME, 'readonly');
      const store = transaction.objectStore(SESSION_STORE_NAME);
      const getRequest = store.get(sessionId);

      getRequest.onsuccess = () => resolve((getRequest.result as Session) || null);
      getRequest.onerror = () => reject(getRequest.error);
    });
  } catch (err) {
    console.warn('Failed to get session from IndexedDB:', err);
    return null;
  }
}

export async function getAllSessions(): Promise<Session[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSION_STORE_NAME, 'readonly');
      const store = transaction.objectStore(SESSION_STORE_NAME);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const sessions = (getAllRequest.result as Session[]) || [];
        sessions.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        resolve(sessions);
      };
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  } catch (err) {
    console.warn('Failed to list sessions from IndexedDB:', err);
    return [];
  }
}

export async function getAllSessionSummaries(): Promise<SessionSummary[]> {
  const sessions = await getAllSessions();
  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    created_at: s.createdAt,
    duration_seconds: s.durationSeconds,
    transcript_count: s.transcripts?.length || 0,
    has_notes: Boolean(s.note?.markdownBody),
    note_updated_at: s.note?.updatedAt || null,
    hasVideo: Boolean(s.hasVideo),
  }));
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(SESSION_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(SESSION_STORE_NAME);
      const delRequest = store.delete(sessionId);

      delRequest.onsuccess = () => resolve();
      delRequest.onerror = () => reject(delRequest.error);
    });
  } catch (err) {
    console.warn('Failed to delete session from IndexedDB:', err);
  }
}
