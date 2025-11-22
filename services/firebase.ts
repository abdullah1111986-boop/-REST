import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, writeBatch, WriteBatch } from 'firebase/firestore';
import { FirebaseConfig, Subject, Trainee } from '../types.ts';

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

// --- Configuration ---
const DEFAULT_CONFIG: FirebaseConfig = {
  apiKey: "AIzaSyBuxw2GsjDwMc8U2k-uJzzLD4ChsXK1wgo",
  authDomain: "rest-cources.firebaseapp.com",
  projectId: "rest-cources",
  storageBucket: "rest-cources.firebasestorage.app",
  messagingSenderId: "642818094568",
  appId: "1:642818094568:web:ceae822bd3d34c31abe05d",
  measurementId: "G-GK7W0EFWR4"
};

// Initialize immediately
const initDB = () => {
  if (app && db) return true; // Already initialized

  try {
    // Check if config exists in localStorage (override)
    const storedConfig = localStorage.getItem('firebaseConfig');
    const config = storedConfig ? JSON.parse(storedConfig) : DEFAULT_CONFIG;

    // 1. Initialize App
    if (getApps().length === 0) {
      app = initializeApp(config);
    } else {
      app = getApp();
    }
    
    // 2. Initialize Firestore
    // Critical: Pass the app instance to getFirestore to ensure connection
    if (app) {
        try {
           db = getFirestore(app);
        } catch (e) {
           // Fallback if getFirestore fails initially (rare, but happens with module loading)
           console.warn("Initial getFirestore call failed, will retry on demand", e);
        }
    }

    console.log("Firebase Initialized Successfully");
    return true;
  } catch (error) {
    console.error("Firebase initialization error:", error);
    return false;
  }
};

// Run initialization
initDB();

export const isFirebaseInitialized = () => !!app && !!db;

export const initFirebase = (config: FirebaseConfig) => {
  try {
    localStorage.setItem('firebaseConfig', JSON.stringify(config));
    return true;
  } catch (error) {
    console.error("Firebase initialization error:", error);
    return false;
  }
};

// --- Helper to ensure DB is ready ---
const getDB = (): Firestore => {
  if (!db) {
    initDB();
    if (!db) {
        // Try one last time to get it from the app if it exists
        if (app) {
            db = getFirestore(app);
        } else {
            throw new Error("Database failed to initialize.");
        }
    }
  }
  return db!;
};

// --- Data Services ---

export const getSubjects = async (): Promise<Subject[]> => {
  const firestore = getDB();
  const snapshot = await getDocs(collection(firestore, 'subjects'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
};

export const addSubject = async (subject: Omit<Subject, 'id'>): Promise<Subject> => {
  const firestore = getDB();
  const docRef = await addDoc(collection(firestore, 'subjects'), subject);
  return { id: docRef.id, ...subject };
};

export const deleteSubject = async (id: string): Promise<void> => {
  const firestore = getDB();
  await deleteDoc(doc(firestore, 'subjects', id));
};

export const getTrainees = async (): Promise<Trainee[]> => {
  const firestore = getDB();
  const snapshot = await getDocs(collection(firestore, 'trainees'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trainee));
};

export const searchTraineeByNationalId = async (nationalId: string): Promise<Trainee | null> => {
  const firestore = getDB();
  // Search by nationalId OR traineeNumber
  
  // Try National ID
  const q1 = query(collection(firestore, 'trainees'), where("nationalId", "==", nationalId));
  const snapshot1 = await getDocs(q1);
  if (!snapshot1.empty) {
    const docData = snapshot1.docs[0];
    return { id: docData.id, ...docData.data() } as Trainee;
  }

  // Try Trainee Number
  const q2 = query(collection(firestore, 'trainees'), where("traineeNumber", "==", nationalId));
  const snapshot2 = await getDocs(q2);
  if (!snapshot2.empty) {
    const docData = snapshot2.docs[0];
    return { id: docData.id, ...docData.data() } as Trainee;
  }

  return null;
};

export const deleteTrainee = async (id: string): Promise<void> => {
  const firestore = getDB();
  await deleteDoc(doc(firestore, 'trainees', id));
};

// --- Bulk Operations ---

export interface ImportedData {
  subjects: Map<string, Omit<Subject, 'id'>>; // Code -> Subject Data
  trainees: Map<string, Omit<Trainee, 'id'>>; // NationalID -> Trainee Data Object
}

export const processBulkImport = async (data: ImportedData) => {
  const firestore = getDB();

  // 1. Fetch existing subjects to map codes to IDs
  const existingSubjects = await getSubjects();
  const subjectCodeToId = new Map<string, string>();
  existingSubjects.forEach(s => subjectCodeToId.set(s.code, s.id));

  const batchLimit = 400; // Safer limit
  let operationCounter = 0;
  let batch = writeBatch(firestore);

  const commitBatchIfFull = async () => {
    if (operationCounter >= batchLimit) {
      await batch.commit();
      batch = writeBatch(firestore);
      operationCounter = 0;
    }
  };

  // 2. Add New Subjects (if any found in Excel)
  for (const [code, subData] of data.subjects) {
    if (!subjectCodeToId.has(code)) {
      const newDocRef = doc(collection(firestore, 'subjects'));
      batch.set(newDocRef, subData);
      subjectCodeToId.set(code, newDocRef.id);
      operationCounter++;
      await commitBatchIfFull();
    }
  }

  if (operationCounter > 0) {
    await batch.commit();
    batch = writeBatch(firestore);
    operationCounter = 0;
  }

  // 3. Process Trainees
  const existingTrainees = await getTrainees();
  const nationalIdToDocId = new Map<string, string>();
  
  existingTrainees.forEach(t => {
    nationalIdToDocId.set(t.nationalId, t.id);
  });

  for (const [nationalId, tData] of data.trainees) {
    const passedIds: string[] = [];
    const failedIds: string[] = [];
    
    // Resolve Subject IDs from Codes
    tData.passedSubjectIds.forEach((code: string) => {
      const id = subjectCodeToId.get(code);
      if (id) passedIds.push(id);
    });

    tData.failedSubjectIds.forEach((code: string) => {
      const id = subjectCodeToId.get(code);
      if (id) failedIds.push(id);
    });

    const finalTraineeData = {
      ...tData,
      passedSubjectIds: passedIds,
      failedSubjectIds: failedIds
    };

    if (nationalIdToDocId.has(nationalId)) {
      // Update existing
      const docId = nationalIdToDocId.get(nationalId)!;
      const traineeRef = doc(firestore, 'trainees', docId);
      batch.update(traineeRef, finalTraineeData);
    } else {
      // Create new
      const newDocRef = doc(collection(firestore, 'trainees'));
      batch.set(newDocRef, finalTraineeData);
    }
    operationCounter++;
    await commitBatchIfFull();
  }

  if (operationCounter > 0) {
    await batch.commit();
  }
};