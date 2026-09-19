import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { SavedSession } from '../types';

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Error Handling according to Firebase Skill standard
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection check required by Firebase Skill
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore notice: client appears offline, working with cached data.');
    }
  }
}
testFirestoreConnection();

// Cloud Session CRUD Operations
export async function saveSessionToCloud(session: SavedSession, user: User): Promise<void> {
  const sessionDocPath = `sessions/${session.id}`;
  try {
    const dataToSave = {
      id: session.id,
      title: (session.title || 'Chuyên đề không tên').trim().slice(0, 300),
      description: (session.description || '').slice(0, 1000),
      createdAt: typeof session.createdAt === 'number' && !isNaN(session.createdAt) ? session.createdAt : Date.now(),
      updatedAt: Date.now(),
      ownerId: user.uid,
      ownerEmail: user.email || '',
      questions: Array.isArray(session.questions) ? session.questions.slice(0, 200) : [],
      selectionMode: session.selectionMode || 'class_stt',
      classConfig: session.classConfig || { grade10: true, grade11: true, grade12: true, maxSTT: 40 },
      customStudents: Array.isArray(session.customStudents) ? session.customStudents : [],
      voicePref: session.voicePref || 'aoede'
    };

    await setDoc(doc(db, 'sessions', session.id), dataToSave);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, sessionDocPath);
  }
}

export async function deleteSessionFromCloud(sessionId: string): Promise<void> {
  const sessionDocPath = `sessions/${sessionId}`;
  try {
    await deleteDoc(doc(db, 'sessions', sessionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, sessionDocPath);
  }
}

export async function fetchUserSessionsFromCloud(user: User): Promise<SavedSession[]> {
  const pathForGetDocs = 'sessions';
  try {
    const q = query(
      collection(db, pathForGetDocs),
      where('ownerId', '==', user.uid)
    );
    const snapshot = await getDocs(q);
    const sessions: SavedSession[] = [];
    snapshot.forEach((d) => {
      sessions.push(d.data() as SavedSession);
    });

    // If no sessions found by UID and user has email, try querying by ownerEmail
    if (sessions.length === 0 && user.email) {
      try {
        const qEmail = query(
          collection(db, pathForGetDocs),
          where('ownerEmail', '==', user.email)
        );
        const emailSnap = await getDocs(qEmail);
        emailSnap.forEach((d) => {
          sessions.push(d.data() as SavedSession);
        });
      } catch (emailErr) {
        console.debug('Email query fallback notice:', emailErr);
      }
    }

    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, pathForGetDocs);
    return [];
  }
}

/**
 * Robust Bidirectional Cloud Sync:
 * 1. Pulls all cloud sessions for user
 * 2. Merges with local sessions
 * 3. Uploads any local sessions missing in cloud
 * 4. Saves merged sessions to localStorage
 */
export async function syncUserDataWithCloud(
  user: User,
  localSessions: SavedSession[]
): Promise<{ merged: SavedSession[]; uploadedCount: number; downloadedCount: number }> {
  const cloudSessions = await fetchUserSessionsFromCloud(user);
  const cloudMap = new Map<string, SavedSession>();
  cloudSessions.forEach(s => cloudMap.set(s.id, s));

  const localMap = new Map<string, SavedSession>();
  localSessions.forEach(s => localMap.set(s.id, s));

  let uploadedCount = 0;
  let downloadedCount = 0;

  // 1. Check local sessions: upload if missing in cloud or local is newer
  for (const localSess of localSessions) {
    const cloudSess = cloudMap.get(localSess.id);
    if (!cloudSess) {
      // Local exists, missing in cloud -> Upload to cloud
      try {
        await saveSessionToCloud(localSess, user);
        cloudMap.set(localSess.id, localSess);
        uploadedCount++;
      } catch (err) {
        console.warn('Failed to upload local session to cloud:', localSess.title, err);
      }
    } else if (localSess.updatedAt > cloudSess.updatedAt) {
      // Local is newer -> update cloud
      try {
        await saveSessionToCloud(localSess, user);
        cloudMap.set(localSess.id, localSess);
        uploadedCount++;
      } catch (err) {
        console.warn('Failed to update cloud session:', localSess.title, err);
      }
    }
  }

  // 2. Any session in cloud but missing locally or cloud is newer
  for (const cloudSess of cloudSessions) {
    const localSess = localMap.get(cloudSess.id);
    if (!localSess || cloudSess.updatedAt > localSess.updatedAt) {
      localMap.set(cloudSess.id, cloudSess);
      downloadedCount++;
    }
  }

  const merged = Array.from(localMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  return { merged, uploadedCount, downloadedCount };
}

// Real-time listener for cloud sessions
export function subscribeToUserSessions(
  user: User,
  onUpdate: (sessions: SavedSession[]) => void,
  onError?: (err: any) => void
): () => void {
  const pathForListen = 'sessions';
  const q = query(
    collection(db, pathForListen),
    where('ownerId', '==', user.uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const sessions: SavedSession[] = [];
      snapshot.forEach((d) => {
        sessions.push(d.data() as SavedSession);
      });
      sessions.sort((a, b) => b.updatedAt - a.updatedAt);
      onUpdate(sessions);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, pathForListen);
    }
  );
}

// Auth Helpers
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    console.error('Sign-in failed:', err);
    throw err;
  }
}

export async function signOutUser(): Promise<void> {
  await fbSignOut(auth);
}
