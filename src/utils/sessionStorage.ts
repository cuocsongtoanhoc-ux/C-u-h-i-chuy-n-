import { SavedSession, Question } from '../types';

// Storage key updated to ensure clean state with no hardcoded AI sessions
export const STORAGE_KEY = 'vts_saved_sessions_teacher_v2';

// Empty default - teachers have 100% control to create, title, and manage their own sessions
export const DEFAULT_PRESET_SESSIONS: SavedSession[] = [];

// Read all saved sessions from localStorage
export function getSavedSessions(): SavedSession[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: SavedSession[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch (e) {
    console.error('Error reading saved sessions from storage:', e);
    return [];
  }
}

// Save or Update a session
export function saveOrUpdateSession(session: SavedSession): SavedSession[] {
  const sessions = getSavedSessions();
  const existingIdx = sessions.findIndex((s) => s.id === session.id);

  const updatedSession: SavedSession = {
    ...session,
    updatedAt: Date.now(),
  };

  let newSessions: SavedSession[];
  if (existingIdx >= 0) {
    newSessions = [...sessions];
    newSessions[existingIdx] = updatedSession;
  } else {
    newSessions = [updatedSession, ...sessions];
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSessions));
  } catch (e) {
    console.error('Failed to write to localStorage:', e);
  }
  return newSessions;
}

// Delete a session
export function deleteSession(id: string): SavedSession[] {
  const sessions = getSavedSessions();
  const newSessions = sessions.filter((s) => s.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSessions));
  } catch (e) {
    console.error('Failed to write to localStorage:', e);
  }
  return newSessions;
}

// Duplicate a session
export function duplicateSession(id: string): SavedSession[] {
  const sessions = getSavedSessions();
  const target = sessions.find((s) => s.id === id);
  if (!target) return sessions;

  const copy: SavedSession = {
    ...target,
    id: 'session_' + Date.now(),
    title: `${target.title} (Bản sao)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const newSessions = [copy, ...sessions];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSessions));
  } catch (e) {
    console.error('Failed to write to localStorage:', e);
  }
  return newSessions;
}

// Export all sessions to JSON file
export function exportSessionsToJSON(): string {
  const sessions = getSavedSessions();
  return JSON.stringify(sessions, null, 2);
}

// Import sessions from JSON file
export function importSessionsFromJSON(jsonStr: string): { success: boolean; count: number; error?: string } {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      return { success: false, count: 0, error: 'Dữ liệu không đúng định dạng danh sách chuyên đề.' };
    }

    const currentSessions = getSavedSessions();
    const existingIds = new Set(currentSessions.map((s) => s.id));
    const merged = [...currentSessions];
    let addedCount = 0;

    for (const item of parsed) {
      if (item && item.title && Array.isArray(item.questions)) {
        const newItem: SavedSession = {
          ...item,
          id: existingIds.has(item.id) ? 'import_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) : item.id || ('import_' + Date.now()),
          updatedAt: Date.now(),
        };
        merged.unshift(newItem);
        addedCount++;
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return { success: true, count: addedCount };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message || 'Lỗi khi đọc file JSON.' };
  }
}

// -------------------------------------------------------------
// CLOUD SYNCHRONIZATION HELPERS (Firestore + Server Backup)
// -------------------------------------------------------------
export const LAST_SYNC_KEY = 'vts_last_cloud_sync_time';
export const USER_SYNC_KEY = 'vts_teacher_sync_key';
export const DEFAULT_TEACHER_KEY = 'cuocsongtoanhoc@gmail.com';

export function getStoredSyncKey(): string {
  if (typeof window === 'undefined') return DEFAULT_TEACHER_KEY;
  return localStorage.getItem(USER_SYNC_KEY) || DEFAULT_TEACHER_KEY;
}

export function setStoredSyncKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_SYNC_KEY, key.trim().toLowerCase());
}

export function getLastSyncTime(): number | null {
  if (typeof window === 'undefined') return null;
  const val = localStorage.getItem(LAST_SYNC_KEY);
  return val ? parseInt(val, 10) : null;
}

export function setLastSyncTime(ts: number = Date.now()): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_SYNC_KEY, ts.toString());
}

/**
 * Pushes all saved sessions to Cloud Firestore and the server backup.
 */
export async function pushSessionsToCloud(
  customSessions?: SavedSession[],
  customKey?: string
): Promise<{ success: boolean; message: string; count: number }> {
  const sessionsToPush = customSessions || getSavedSessions();
  const syncKey = (customKey || getStoredSyncKey() || DEFAULT_TEACHER_KEY).trim().toLowerCase();

  let firestoreSaved = 0;

  // 1. If Firebase Auth is signed in, sync directly to Firestore
  try {
    const { auth, saveSessionToCloud } = await import('../lib/firebase');
    if (auth.currentUser) {
      for (const s of sessionsToPush) {
        await saveSessionToCloud(s, auth.currentUser);
        firestoreSaved++;
      }
    }
  } catch (err) {
    console.warn('Firestore sync notice (continuing with server backup):', err);
  }

  // 2. Also push to server-side backup for universal cross-device access
  try {
    const response = await fetch('/api/cloud-sync/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        syncKey,
        sessions: sessionsToPush,
        activeSession: sessionsToPush.length > 0 ? sessionsToPush[0] : null,
      }),
    });

    if (response.ok) {
      setLastSyncTime(Date.now());
      return {
        success: true,
        count: sessionsToPush.length,
        message: `Đã chuyển thành công ${sessionsToPush.length} chuyên đề lên đám mây (Mã: ${syncKey})!`,
      };
    }
  } catch (err: any) {
    console.error('Server sync error:', err);
  }

  if (firestoreSaved > 0) {
    setLastSyncTime(Date.now());
    return {
      success: true,
      count: firestoreSaved,
      message: `Đã lưu ${firestoreSaved} chuyên đề vào Firestore đám mây!`,
    };
  }

  return {
    success: false,
    count: 0,
    message: 'Không thể kết nối đến máy chủ đám mây. Vui lòng kiểm tra đường truyền.',
  };
}

/**
 * Pulls all saved sessions from Cloud Firestore or Server backup and merges locally.
 */
export async function pullSessionsFromCloud(
  customKey?: string
): Promise<{ success: boolean; sessions: SavedSession[]; count: number; message: string }> {
  const syncKey = (customKey || getStoredSyncKey() || DEFAULT_TEACHER_KEY).trim().toLowerCase();
  let cloudSessions: SavedSession[] = [];

  // 1. Try Firestore if user is authenticated
  try {
    const { auth, fetchUserSessionsFromCloud } = await import('../lib/firebase');
    if (auth.currentUser) {
      const fsSessions = await fetchUserSessionsFromCloud(auth.currentUser);
      if (fsSessions && fsSessions.length > 0) {
        cloudSessions = fsSessions;
      }
    }
  } catch (err) {
    console.warn('Firestore pull notice:', err);
  }

  // 2. Try Server Backup if Firestore yielded nothing or user is on another PC without sign-in
  if (cloudSessions.length === 0) {
    try {
      // First try specific key
      let res = await fetch(`/api/cloud-sync/load/${encodeURIComponent(syncKey)}`);
      if (!res.ok) {
        // Fallback to latest session uploaded across school
        res = await fetch('/api/cloud-sync/latest');
      }

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.sessions)) {
          cloudSessions = data.sessions;
        }
      }
    } catch (err) {
      console.warn('Server sync pull error:', err);
    }
  }

  if (cloudSessions.length === 0) {
    return {
      success: false,
      sessions: getSavedSessions(),
      count: 0,
      message: `Chưa tìm thấy chuyên đề nào trên đám mây với mã "${syncKey}". Hãy bấm "Đồng bộ lên đám mây" từ máy tính bạn đã tạo câu hỏi trước!`,
    };
  }

  // Merge cloud sessions with local sessions, giving priority to newer updatedAt
  const localSessions = getSavedSessions();
  const sessionMap = new Map<string, SavedSession>();

  localSessions.forEach((s) => sessionMap.set(s.id, s));
  cloudSessions.forEach((s) => {
    const existing = sessionMap.get(s.id);
    if (!existing || (s.updatedAt || 0) >= (existing.updatedAt || 0)) {
      sessionMap.set(s.id, s);
    }
  });

  const merged = Array.from(sessionMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    setLastSyncTime(Date.now());
  } catch (e) {
    console.error('Failed to write merged sessions:', e);
  }

  return {
    success: true,
    sessions: merged,
    count: cloudSessions.length,
    message: `Đã đồng bộ thành công ${cloudSessions.length} chuyên đề từ đám mây về máy tính này!`,
  };
}

