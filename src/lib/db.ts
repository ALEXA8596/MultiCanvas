import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface CourseSetting {
  id: string; // Combination of accountId and courseId
  accountDomain?: string;
  courseId?: number;
  courseName?: string;
  courseCode?: string;
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

const isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';

export function getCourseSettingId(accountDomain: string, courseId: number | string) {
  return `${accountDomain}::${courseId}`;
}

export function parseCourseSettingId(id: string) {
  const [accountDomain, courseId] = id.split('::');
  return {
    accountDomain,
    courseId: courseId ? Number(courseId) : undefined,
  };
}

const dbPromise: Promise<IDBPDatabase<MyDB>> | null = isBrowser
  ? openDB<MyDB>('multi-canvas-db', 2, {
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
    })
  : null;

function requireDb(): Promise<IDBPDatabase<MyDB>> {
  if (!dbPromise) {
    throw new Error('IndexedDB is only available in the browser runtime.');
  }
  return dbPromise;
}

// --- Course Settings ---

export async function getCourseSettings() {
  return (await requireDb()).getAll('course-settings');
}

export async function getCourseSetting(id: string) {
  return (await requireDb()).get('course-settings', id);
}

export async function setCourseSetting(setting: CourseSetting) {
  const db = await requireDb();
  const tx = db.transaction('course-settings', 'readwrite');
  await tx.store.put(setting);
  await tx.done;
  return getCourseSettings();
}

export async function upsertCourseSettings(settings: CourseSetting[]) {
  if (settings.length === 0) return getCourseSettings();
  const db = await requireDb();
  const tx = db.transaction('course-settings', 'readwrite');
  const store = tx.store;
  for (const setting of settings) {
    const existing = await store.get(setting.id);
    if (!existing) {
      await store.put(setting);
      continue;
    }
    const merged: CourseSetting = {
      ...existing,
      ...setting,
      id: setting.id,
    };
    const needsUpdate = JSON.stringify(existing) !== JSON.stringify(merged);
    if (needsUpdate) {
      await store.put(merged);
    }
  }
  await tx.done;
  return getCourseSettings();
}

export async function updateCourseSetting(id: string, patch: Partial<CourseSetting>) {
  const db = await requireDb();
  const tx = db.transaction('course-settings', 'readwrite');
  const store = tx.store;
  const current = await store.get(id);
  const merged: CourseSetting = {
    id,
    ...current,
    ...patch,
  };
  await store.put(merged);
  await tx.done;
  return merged;
}

// --- Manual Grades ---

export async function getManualGrades() {
  return (await requireDb()).getAll('manual-grades');
}

export async function addManualGrade(grade: ManualGrade) {
  return (await requireDb()).add('manual-grades', grade);
}

export async function updateManualGrade(grade: ManualGrade) {
  return (await requireDb()).put('manual-grades', grade);
}

export async function deleteManualGrade(id: number) {
  return (await requireDb()).delete('manual-grades', id);
}

// --- Terms ---
export async function getTerms() {
  return (await requireDb()).getAll('terms');
}

export async function addTerm(term: Term) {
  return (await requireDb()).add('terms', term);
}

export async function updateTerm(term: Term) {
  return (await requireDb()).put('terms', term);
}

export async function deleteTerm(id: number) {
  const db = await requireDb();
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
  return (await requireDb()).getAllFromIndex('term-courses', 'by-term', termId);
}

export async function getAllTermCourses() {
    return (await requireDb()).getAll('term-courses');
}

export async function addTermCourse(course: TermCourse) {
  return (await requireDb()).add('term-courses', course);
}

export async function updateTermCourse(course: TermCourse) {
  return (await requireDb()).put('term-courses', course);
}

export async function deleteTermCourse(id: number) {
  return (await requireDb()).delete('term-courses', id);
}
