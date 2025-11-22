import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, writeBatch, WriteBatch } from 'firebase/firestore';
import { FirebaseConfig, Subject, Trainee } from '../types.ts';

// --- APP MODE STATE ---
export type AppMode = 'cloud' | 'local';

export const getAppMode = (): AppMode => {
  return (localStorage.getItem('appMode') as AppMode) || 'cloud';
};

export const setAppMode = (mode: AppMode) => {
  localStorage.setItem('appMode', mode);
  window.location.reload();
};

const CURRENT_MODE = getAppMode();

// ==========================================
// 1. FIREBASE IMPLEMENTATION
// ==========================================

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

const DEFAULT_CONFIG: FirebaseConfig = {
  apiKey: "AIzaSyBuxw2GsjDwMc8U2k-uJzzLD4ChsXK1wgo",
  authDomain: "rest-cources.firebaseapp.com",
  projectId: "rest-cources",
  storageBucket: "rest-cources.firebasestorage.app",
  messagingSenderId: "642818094568",
  appId: "1:642818094568:web:ceae822bd3d34c31abe05d",
  measurementId: "G-GK7W0EFWR4"
};

const initFirebaseDB = () => {
  if (app && db) return true;
  try {
    const storedConfig = localStorage.getItem('firebaseConfig');
    const config = storedConfig ? JSON.parse(storedConfig) : DEFAULT_CONFIG;
    
    if (getApps().length === 0) {
      app = initializeApp(config);
    } else {
      app = getApp();
    }
    
    if (app) {
        try {
           db = getFirestore(app);
           console.log("Firebase Firestore connected successfully");
        } catch (e) {
           console.warn("Firestore initialization delayed:", e);
        }
    }
    return true;
  } catch (error) {
    console.error("Firebase initialization error:", error);
    return false;
  }
};

// Initialize only if in cloud mode or generic init
if (CURRENT_MODE === 'cloud') {
    initFirebaseDB();
}

export const isFirebaseInitialized = () => !!app;

export const initFirebase = (config: FirebaseConfig) => {
  try {
    localStorage.setItem('firebaseConfig', JSON.stringify(config));
    app = undefined; 
    db = undefined;
    return initFirebaseDB();
  } catch (error) {
    console.error("Firebase initialization error:", error);
    return false;
  }
};

const getFirestoreDB = (): Firestore => {
  if (!app) initFirebaseDB();
  if (app && !db) {
    try { db = getFirestore(app); } catch(e) {}
  }
  if (!db) throw new Error("خدمة السحابة غير متوفرة. تأكد من الاتصال بالإنترنت.");
  return db;
};


// ==========================================
// 2. LOCAL DATABASE IMPLEMENTATION (IndexedDB)
// ==========================================

const IDB_NAME = 'TraineeAffairsLocalDB';
const IDB_VERSION = 1;

const openLocalDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('subjects')) {
        db.createObjectStore('subjects', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('trainees')) {
        const store = db.createObjectStore('trainees', { keyPath: 'id' });
        // Add indexes for searching
        store.createIndex('nationalId', 'nationalId', { unique: false });
        store.createIndex('traineeNumber', 'traineeNumber', { unique: false });
        store.createIndex('phoneNumber', 'phoneNumber', { unique: false });
      }
    };
  });
};

const localOps = {
  getAll: async <T>(storeName: string): Promise<T[]> => {
    const db = await openLocalDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  },
  add: async (storeName: string, data: any) => {
    const db = await openLocalDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      // Generate simple ID if not present
      if (!data.id) data.id = crypto.randomUUID();
      store.put(data);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  delete: async (storeName: string, id: string) => {
    const db = await openLocalDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  search: async (value: string): Promise<Trainee | null> => {
     const db = await openLocalDB();
     return new Promise((resolve, reject) => {
       const tx = db.transaction('trainees', 'readonly');
       const store = tx.objectStore('trainees');
       
       // Helper to try an index
       const tryIndex = (indexName: string) => {
         return new Promise<Trainee | null>((res) => {
            const idx = store.index(indexName);
            const req = idx.get(value);
            req.onsuccess = () => res(req.result || null);
            req.onerror = () => res(null);
         });
       };

       // Parallel search not possible easily in one transaction with logic, so we do sequential
       // IDB transactions auto-commit if we await too long, but promises here are microtasks.
       // Let's just get all matches in memory for the specific keys. It's fast enough.
       
       // Priority 1: Trainee Number
       const idx1 = store.index('traineeNumber');
       idx1.get(value).onsuccess = (e: any) => {
          if (e.target.result) { resolve(e.target.result); return; }
          
          // Priority 2: Phone
          const idx2 = store.index('phoneNumber');
          idx2.get(value).onsuccess = (e2: any) => {
             if (e2.target.result) { resolve(e2.target.result); return; }

             // Priority 3: National ID
             const idx3 = store.index('nationalId');
             idx3.get(value).onsuccess = (e3: any) => {
                resolve(e3.target.result || null);
             };
          }
       };
     });
  },
  clear: async () => {
      const db = await openLocalDB();
      const tx = db.transaction(['subjects', 'trainees'], 'readwrite');
      tx.objectStore('subjects').clear();
      tx.objectStore('trainees').clear();
      return new Promise<void>((resolve) => {
         tx.oncomplete = () => resolve();
      });
  }
};


// ==========================================
// 3. UNIFIED SERVICE LAYER
// ==========================================

export const getSubjects = async (): Promise<Subject[]> => {
  if (CURRENT_MODE === 'local') {
     return localOps.getAll<Subject>('subjects');
  } else {
     const firestore = getFirestoreDB();
     const snapshot = await getDocs(collection(firestore, 'subjects'));
     return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
  }
};

export const addSubject = async (subject: Omit<Subject, 'id'>): Promise<Subject> => {
  if (CURRENT_MODE === 'local') {
     const id = crypto.randomUUID();
     const newSub = { ...subject, id };
     await localOps.add('subjects', newSub);
     return newSub;
  } else {
     const firestore = getFirestoreDB();
     const docRef = await addDoc(collection(firestore, 'subjects'), subject);
     return { id: docRef.id, ...subject };
  }
};

export const deleteSubject = async (id: string): Promise<void> => {
  if (CURRENT_MODE === 'local') {
    await localOps.delete('subjects', id);
  } else {
    const firestore = getFirestoreDB();
    await deleteDoc(doc(firestore, 'subjects', id));
  }
};

export const getTrainees = async (): Promise<Trainee[]> => {
  if (CURRENT_MODE === 'local') {
    return localOps.getAll<Trainee>('trainees');
  } else {
    const firestore = getFirestoreDB();
    const snapshot = await getDocs(collection(firestore, 'trainees'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Trainee));
  }
};

export const searchTraineeByNationalId = async (searchKey: string): Promise<Trainee | null> => {
  if (CURRENT_MODE === 'local') {
    return localOps.search(searchKey);
  } else {
    const firestore = getFirestoreDB();
    
    // Priority 1: Trainee Number
    const q1 = query(collection(firestore, 'trainees'), where("traineeNumber", "==", searchKey));
    const snapshot1 = await getDocs(q1);
    if (!snapshot1.empty) return { id: snapshot1.docs[0].id, ...snapshot1.docs[0].data() } as Trainee;

    // Priority 2: Phone Number
    const q2 = query(collection(firestore, 'trainees'), where("phoneNumber", "==", searchKey));
    const snapshot2 = await getDocs(q2);
    if (!snapshot2.empty) return { id: snapshot2.docs[0].id, ...snapshot2.docs[0].data() } as Trainee;

    // Priority 3: National ID
    const q3 = query(collection(firestore, 'trainees'), where("nationalId", "==", searchKey));
    const snapshot3 = await getDocs(q3);
    if (!snapshot3.empty) return { id: snapshot3.docs[0].id, ...snapshot3.docs[0].data() } as Trainee;

    return null;
  }
};

export const deleteTrainee = async (id: string): Promise<void> => {
  if (CURRENT_MODE === 'local') {
    await localOps.delete('trainees', id);
  } else {
    const firestore = getFirestoreDB();
    await deleteDoc(doc(firestore, 'trainees', id));
  }
};

// --- Bulk Operations ---

export interface ImportedData {
  subjects: Map<string, Omit<Subject, 'id'>>; 
  trainees: Map<string, Omit<Trainee, 'id'>>; 
}

export const processBulkImport = async (data: ImportedData) => {
  // 1. Common: Resolve Subject Codes to IDs
  // We need to know existing subjects to map codes.
  const existingSubjects = await getSubjects();
  const subjectCodeToId = new Map<string, string>();
  existingSubjects.forEach(s => subjectCodeToId.set(s.code, s.id));

  // ---------------------------------------------------------
  // LOCAL MODE IMPORT
  // ---------------------------------------------------------
  if (CURRENT_MODE === 'local') {
     const db = await openLocalDB();
     const tx = db.transaction(['subjects', 'trainees'], 'readwrite');
     const subStore = tx.objectStore('subjects');
     const traineeStore = tx.objectStore('trainees');

     // Process Subjects
     for (const [code, subData] of data.subjects) {
       if (!subjectCodeToId.has(code)) {
          const id = crypto.randomUUID();
          subStore.put({ ...subData, id });
          subjectCodeToId.set(code, id);
       }
     }

     // Process Trainees
     // Need to fetch existing trainees first for updates? 
     // IndexedDB 'put' acts as upsert if key exists, but we generate IDs.
     // For simplicity in local mode, we search by National ID manually or just add new.
     // A full "Update" in local mode is complex without iterating all. 
     // For this "Temp" purpose, we will assume we iterate existing to find matches or overwrite.
     
     // Let's read all trainees first to build a map (Local mode is usually small enough)
     const allTrainees = await localOps.getAll<Trainee>('trainees');
     const nationalIdToId = new Map<string, string>();
     allTrainees.forEach(t => nationalIdToId.set(t.nationalId, t.id));

     for (const [nationalId, tData] of data.trainees) {
        const passedIds: string[] = [];
        const failedIds: string[] = [];
        
        tData.passedSubjectIds.forEach((code: string) => {
          const id = subjectCodeToId.get(code);
          if (id) passedIds.push(id);
        });
        tData.failedSubjectIds.forEach((code: string) => {
          const id = subjectCodeToId.get(code);
          if (id) failedIds.push(id);
        });

        const finalData = { ...tData, passedSubjectIds: passedIds, failedSubjectIds: failedIds };
        
        if (nationalIdToId.has(nationalId)) {
           // Update
           const id = nationalIdToId.get(nationalId)!;
           traineeStore.put({ ...finalData, id });
        } else {
           // Insert
           const id = crypto.randomUUID();
           traineeStore.put({ ...finalData, id });
        }
     }

     return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
     });
  }

  // ---------------------------------------------------------
  // FIREBASE MODE IMPORT
  // ---------------------------------------------------------
  const firestore = getFirestoreDB();
  const batchLimit = 400;
  let operationCounter = 0;
  let batch = writeBatch(firestore);

  const commitBatchIfFull = async () => {
    if (operationCounter >= batchLimit) {
      await batch.commit();
      batch = writeBatch(firestore);
      operationCounter = 0;
    }
  };

  // Add New Subjects
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

  // Process Trainees
  const existingTrainees = await getTrainees();
  const nationalIdToDocId = new Map<string, string>();
  existingTrainees.forEach(t => nationalIdToDocId.set(t.nationalId, t.id));

  for (const [nationalId, tData] of data.trainees) {
    const passedIds: string[] = [];
    const failedIds: string[] = [];
    
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
      const docId = nationalIdToDocId.get(nationalId)!;
      const traineeRef = doc(firestore, 'trainees', docId);
      batch.update(traineeRef, finalTraineeData);
    } else {
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