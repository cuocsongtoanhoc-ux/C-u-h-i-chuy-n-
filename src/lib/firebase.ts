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
      title: session.title,
      description: session.description || '',
      createdAt: session.createdAt,
      updatedAt: Date.now(),
      ownerId: user.uid,
      ownerEmail: user.email || '',
      questions: session.questions,
      selectionMode: session.selectionMode,
      classConfig: session.classConfig,
      customStudents: session.customStudents || [],
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
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, pathForGetDocs);
    return [];
  }
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
