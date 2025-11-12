import { openDB, DBSchema } from 'idb';

export interface CourseSetting {
  id: string; // Combination of accountId and courseId
  nickname?: string;
  order?: number;
  visible?: boolean;
  credits?: number;
}

export interface ManualGrade {
  id?: number; // Autoincrementing primary key
  courseName: string;
  credits: number;
  grade: string; // e.g., "A", "B+", "C-"
  year: number;
  term: string;
}

export interface Term {
  id?: number;
  year: number;
  season: string; // "Fall", "Spring", "Summer", "Winter"
  termGrade?: string;
}

export interface TermCourse {
  id?: number;
  termId: number;
  courseName: string;
  credits: number;
  grade: string;
  courseType?: string;
}

interface MyDB extends DBSchema {
  'course-settings': {
    key: string;
    value: CourseSetting;
  };
  'manual-grades': {
    key: number;
    value: ManualGrade;
    indexes: { 'by-year': number };
  };
  terms: {
    key: number;
    value: Term;
    indexes: { 'by-year-season': [number, string] };
  };
  'term-courses': {
    key: number;
    value: TermCourse;
    indexes: { 'by-term': number };
  };
}

const dbPromise = openDB<MyDB>('multi-canvas-db', 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore('course-settings', { keyPath: 'id' });
      const manualGradesStore = db.createObjectStore('manual-grades', {
        keyPath: 'id',
        autoIncrement: true,
      });
      manualGradesStore.createIndex('by-year', 'year');
    }
    if (oldVersion < 2) {
      const termsStore = db.createObjectStore('terms', {
        keyPath: 'id',
        autoIncrement: true,
      });
      termsStore.createIndex('by-year-season', ['year', 'season'], { unique: true });

      const termCoursesStore = db.createObjectStore('term-courses', {
        keyPath: 'id',
        autoIncrement: true,
      });
      termCoursesStore.createIndex('by-term', 'termId');
    }
  },
});

// --- Course Settings ---

export async function getCourseSettings() {
  return (await dbPromise).getAll('course-settings');
}

export async function getCourseSetting(id: string) {
  return (await dbPromise).get('course-settings', id);
}

export async function setCourseSetting(setting: CourseSetting) {
  const db = await dbPromise;
  const tx = db.transaction('course-settings', 'readwrite');
  await tx.store.put(setting);
  await tx.done;
  return getCourseSettings();
}

// --- Manual Grades ---

export async function getManualGrades() {
  return (await dbPromise).getAll('manual-grades');
}

export async function addManualGrade(grade: ManualGrade) {
  return (await dbPromise).add('manual-grades', grade);
}

export async function updateManualGrade(grade: ManualGrade) {
  return (await dbPromise).put('manual-grades', grade);
}

export async function deleteManualGrade(id: number) {
  return (await dbPromise).delete('manual-grades', id);
}

// --- Terms ---
export async function getTerms() {
  return (await dbPromise).getAll('terms');
}

export async function addTerm(term: Term) {
  return (await dbPromise).add('terms', term);
}

export async function updateTerm(term: Term) {
  return (await dbPromise).put('terms', term);
}

export async function deleteTerm(id: number) {
  const db = await dbPromise;
  const tx = db.transaction(['terms', 'term-courses'], 'readwrite');
  // Delete all courses for this term
  const courses = await tx.objectStore('term-courses').index('by-term').getAll(id);
  await Promise.all(courses.map(c => tx.objectStore('term-courses').delete(c.id!)));
  // Delete the term itself
  await tx.objectStore('terms').delete(id);
  await tx.done;
}


// --- Term Courses ---
export async function getTermCourses(termId: number) {
  return (await dbPromise).getAllFromIndex('term-courses', 'by-term', termId);
}

export async function getAllTermCourses() {
    return (await dbPromise).getAll('term-courses');
}

export async function addTermCourse(course: TermCourse) {
  return (await dbPromise).add('term-courses', course);
}

export async function updateTermCourse(course: TermCourse) {
  return (await dbPromise).put('term-courses', course);
}

export async function deleteTermCourse(id: number) {
  return (await dbPromise).delete('term-courses', id);
}
