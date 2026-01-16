/**
 * Data Export/Import utilities with optional password encryption
 * Uses Web Crypto API for AES-GCM encryption
 */

import {
  getCourseSettings,
  getTerms,
  getAllTermCourses,
  getGpaProfiles,
  CourseSetting,
  Term,
  TermCourse,
  GpaProfile,
  upsertCourseSettings,
  addTerm,
  addTermCourse,
  addGpaProfile,
} from './db';

export interface ExportData {
  version: number;
  exportedAt: string;
  accounts?: AccountData[];
  courseSettings?: CourseSetting[];
  terms?: Term[];
  termCourses?: TermCourse[];
  gpaProfiles?: GpaProfile[];
}

export interface AccountData {
  id: string;
  domain: string;
  apiKey: string;
}

export interface ExportOptions {
  includeAccounts: boolean;
  includeCourseSettings: boolean;
  includeGradeData: boolean;
  includeGpaProfiles: boolean;
  encryptCredentials: boolean;
  password?: string;
}

export interface ImportResult {
  success: boolean;
  message: string;
  imported: {
    accounts: number;
    courseSettings: number;
    terms: number;
    termCourses: number;
    gpaProfiles: number;
  };
}

// ============== Encryption Utilities ==============

/**
 * Derive a cryptographic key from a password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data using AES-GCM
 */
async function encryptData(data: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encoder.encode(data)
  );

  // Combine salt + iv + encrypted data and encode as base64
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data using AES-GCM
 */
async function decryptData(encryptedBase64: string, password: string): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));

  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const data = combined.slice(28);

  const key = await deriveKey(password, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    data.buffer as ArrayBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// ============== Export Functions ==============

/**
 * Gather all user data for export
 */
export async function gatherExportData(options: ExportOptions): Promise<ExportData> {
  const exportData: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
  };

  // Get accounts from localStorage
  if (options.includeAccounts) {
    try {
      const accountsRaw = localStorage.getItem('accounts');
      if (accountsRaw) {
        const accounts = JSON.parse(accountsRaw) as AccountData[];
        
        if (options.encryptCredentials && options.password) {
          // Encrypt the API keys
          exportData.accounts = await Promise.all(
            accounts.map(async (acc) => ({
              ...acc,
              apiKey: await encryptData(acc.apiKey, options.password!),
              _encrypted: true,
            }))
          ) as unknown as AccountData[];
        } else {
          exportData.accounts = accounts;
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  // Get course settings from IndexedDB
  if (options.includeCourseSettings) {
    try {
      exportData.courseSettings = await getCourseSettings();
    } catch {
      // Ignore DB errors
    }
  }

  // Get grade data (terms and term courses)
  if (options.includeGradeData) {
    try {
      exportData.terms = await getTerms();
      exportData.termCourses = await getAllTermCourses();
    } catch {
      // Ignore DB errors
    }
  }

  // Get GPA profiles
  if (options.includeGpaProfiles) {
    try {
      exportData.gpaProfiles = await getGpaProfiles();
    } catch {
      // Ignore DB errors
    }
  }

  return exportData;
}

/**
 * Export data as a downloadable JSON file
 */
export async function exportToFile(options: ExportOptions): Promise<void> {
  const data = await gatherExportData(options);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
  const encryptedSuffix = options.encryptCredentials ? '-encrypted' : '';
  a.download = `multicanvas-backup-${date}${encryptedSuffix}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ============== Import Functions ==============

/**
 * Parse and validate import data
 */
export function parseImportFile(content: string): ExportData | null {
  try {
    const data = JSON.parse(content);
    
    // Basic validation
    if (typeof data !== 'object' || data === null) {
      return null;
    }

    // Check for version (optional for backward compatibility with old exports)
    if (data.version === undefined) {
      // Legacy format - just accounts array
      if (Array.isArray(data)) {
        return {
          version: 0,
          exportedAt: new Date().toISOString(),
          accounts: data.filter((a: unknown) => 
            a && typeof a === 'object' && 'domain' in a && 'apiKey' in a
          ),
        };
      }
    }

    return data as ExportData;
  } catch {
    return null;
  }
}

/**
 * Check if import data contains encrypted credentials
 */
export function hasEncryptedCredentials(data: ExportData): boolean {
  return data.accounts?.some((a: unknown) => 
    a && typeof a === 'object' && '_encrypted' in a && (a as Record<string, unknown>)._encrypted === true
  ) ?? false;
}

/**
 * Import data from parsed export file
 */
export async function importData(
  data: ExportData,
  password?: string,
  options?: {
    mergeAccounts?: boolean;
    mergeCourseSettings?: boolean;
  }
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    message: '',
    imported: {
      accounts: 0,
      courseSettings: 0,
      terms: 0,
      termCourses: 0,
      gpaProfiles: 0,
    },
  };

  const errors: string[] = [];

  // Import accounts
  if (data.accounts && data.accounts.length > 0) {
    try {
      let accountsToImport = data.accounts;

      // Decrypt if needed
      if (hasEncryptedCredentials(data)) {
        if (!password) {
          errors.push('Password required to decrypt credentials');
        } else {
          try {
            accountsToImport = await Promise.all(
              data.accounts.map(async (acc: unknown) => {
                const account = acc as AccountData & { _encrypted?: boolean };
                if (account._encrypted) {
                  const decryptedKey = await decryptData(account.apiKey, password);
                  const { _encrypted, ...rest } = account as AccountData & { _encrypted?: boolean };
                  void _encrypted; // Mark as intentionally unused
                  return { ...rest, apiKey: decryptedKey };
                }
                return account;
              })
            );
          } catch {
            errors.push('Failed to decrypt credentials - incorrect password?');
            accountsToImport = [];
          }
        }
      }

      if (accountsToImport.length > 0) {
        const existingRaw = localStorage.getItem('accounts');
        const existing: AccountData[] = existingRaw ? JSON.parse(existingRaw) : [];
        
        if (options?.mergeAccounts !== false) {
          // Merge by domain uniqueness
          const existingDomains = new Set(existing.map(a => a.domain));
          const newAccounts = accountsToImport.filter(a => !existingDomains.has(a.domain));
          const merged = [...existing, ...newAccounts.map(a => ({
            ...a,
            id: a.id || String(Date.now() + Math.random()),
          }))];
          localStorage.setItem('accounts', JSON.stringify(merged));
          result.imported.accounts = newAccounts.length;
        } else {
          localStorage.setItem('accounts', JSON.stringify(accountsToImport));
          result.imported.accounts = accountsToImport.length;
        }
      }
    } catch (e) {
      errors.push(`Failed to import accounts: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Import course settings
  if (data.courseSettings && data.courseSettings.length > 0) {
    try {
      if (options?.mergeCourseSettings !== false) {
        await upsertCourseSettings(data.courseSettings);
      } else {
        // Replace - clear existing first would need separate function
        await upsertCourseSettings(data.courseSettings);
      }
      result.imported.courseSettings = data.courseSettings.length;
    } catch (e) {
      errors.push(`Failed to import course settings: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Import terms (grade history)
  if (data.terms && data.terms.length > 0) {
    try {
      const termIdMap = new Map<number, number>(); // old ID -> new ID
      
      for (const term of data.terms) {
        const { id: oldId, ...termData } = term;
        const newId = await addTerm(termData);
        if (oldId !== undefined) {
          termIdMap.set(oldId, newId);
        }
        result.imported.terms++;
      }

      // Import term courses with updated term IDs
      if (data.termCourses && data.termCourses.length > 0) {
        for (const course of data.termCourses) {
          const { id: _oldId, termId, ...courseData } = course;
          void _oldId; // Mark as intentionally unused
          const newTermId = termIdMap.get(termId) ?? termId;
          await addTermCourse({ ...courseData, termId: newTermId });
          result.imported.termCourses++;
        }
      }
    } catch (e) {
      errors.push(`Failed to import grade data: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Import GPA profiles
  if (data.gpaProfiles && data.gpaProfiles.length > 0) {
    try {
      for (const profile of data.gpaProfiles) {
        const { id: _oldId, ...profileData } = profile;
        void _oldId; // Mark as intentionally unused
        await addGpaProfile(profileData);
        result.imported.gpaProfiles++;
      }
    } catch (e) {
      errors.push(`Failed to import GPA profiles: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Build result message
  if (errors.length > 0) {
    result.success = false;
    result.message = errors.join('; ');
  } else {
    const parts: string[] = [];
    if (result.imported.accounts > 0) parts.push(`${result.imported.accounts} accounts`);
    if (result.imported.courseSettings > 0) parts.push(`${result.imported.courseSettings} course settings`);
    if (result.imported.terms > 0) parts.push(`${result.imported.terms} terms`);
    if (result.imported.termCourses > 0) parts.push(`${result.imported.termCourses} courses`);
    if (result.imported.gpaProfiles > 0) parts.push(`${result.imported.gpaProfiles} GPA profiles`);
    
    result.message = parts.length > 0 
      ? `Successfully imported: ${parts.join(', ')}`
      : 'No data to import';
  }

  return result;
}
