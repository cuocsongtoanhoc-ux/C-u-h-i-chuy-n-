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
