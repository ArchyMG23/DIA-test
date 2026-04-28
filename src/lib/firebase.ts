import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, onSnapshot, serverTimestamp, updateDoc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Exercise, Evaluation } from '../services/gemini';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Create/update user document
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: 'student', // Default role
        createdAt: serverTimestamp()
      });
    }
    return user;
  } catch (error) {
    console.error("Login failed", error);
    throw error;
  }
};

export const updateUserRole = async (userId: string, role: 'student' | 'teacher') => {
  try {
    await updateDoc(doc(db, 'users', userId), { role });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
  }
};

export interface Submission {
  id: string;
  studentId: string;
  teacherId: string;
  exerciseId: string;
  exerciseTitle: string;
  text: string;
  status: 'pending' | 'corrected';
  correction?: Evaluation & { highlightedText?: string };
  createdAt: any;
  updatedAt: any;
}

export const submitToTeacher = async (submission: Omit<Submission, 'id' | 'createdAt' | 'updatedAt'>) => {
  try {
    const subRef = doc(collection(db, 'submissions'));
    const id = subRef.id;
    await setDoc(subRef, {
      ...submission,
      id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Update lastTeacherId for student
    await updateDoc(doc(db, 'users', submission.studentId), {
      lastTeacherId: submission.teacherId
    });
    
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'submissions');
  }
};

export const logout = () => auth.signOut();
