
export interface Subject {
  id: string;
  name: string;
  code: string;
  level: number; // Semester or Level
  creditHours: number; // Number of units/hours
}

export interface Trainee {
  id: string;
  fullName: string; // 1. الاسم الرباعي
  nationalId: string; // 2. رقم الهوية
  traineeNumber: string; // 12. الرقم التدريبي
  phoneNumber: string; // 3. رقم التواصل
  major: string; // 7. التخصص
  gpa: string; // 4. المعدل التراكمي (stored as string to preserve formatting like 4.50)
  completedHours: number; // 6. الساعات المستوفاة
  remainingHours: number; // 5. الساعات المتبقية
  
  passedSubjectIds: string[]; // 9. المواد المنجزة (Green)
  failedSubjectIds: string[]; // 10. المواد المتعثر بها (Red)
  // Remaining subjects (11. White) are calculated by diffing All Subjects - Passed
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export const ADMIN_PASSWORD_HASH = "0558882711";
