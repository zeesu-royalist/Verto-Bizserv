import {
  CandidateFormValues,
  CandidateRecord,
  CandidateValidationErrors,
  UserProfile,
  UserRole,
} from '../types/recruitment';

// Verbatim synchronized with firebase-blueprint.json & firestore.rules
export const FIELD_LIMITS = {
  managerNameMax: 100,
  recruiterNameMax: 100,
  clientNameMax: 120,
  purposeMax: 80,
  candidateNameMax: 100,
  candidateMobileLen: 10,
  cityMax: 100,
  resumeUrlMax: 2000,
  resumeFileNameMax: 200,
  resumeStoragePathMax: 300,
  userNameMax: 100,
  maxResumeFileBytes: 5 * 1024 * 1024, // 5 MB
} as const;

export const SUBMISSION_DATE_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
export const CANDIDATE_NAME_REGEX = /^[A-Za-z]+( [A-Za-z]+)*$/;
export const CANDIDATE_MOBILE_REGEX = /^[0-9]{10}$/;
export const RESUME_URL_REGEX = /^https?:\/\/.+/;
export const DOC_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export const ALLOWED_RESUME_EXTENSIONS = ['.pdf', '.doc', '.docx'] as const;
export const ALLOWED_RESUME_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export function getTodayIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Strips numbers and special characters live while typing Candidate's Name.
 * Preserves ASCII letters and single spaces.
 */
export function sanitizeCandidateNameInput(raw: string): string {
  return raw.replace(/[^A-Za-z ]/g, '').replace(/\s{2,}/g, ' ').slice(0, FIELD_LIMITS.candidateNameMax);
}

/**
 * Normalizes Candidate's Name before submission (trims leading/trailing spaces).
 */
export function normalizeCandidateName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, FIELD_LIMITS.candidateNameMax);
}

/**
 * Strips all non-digits live while typing Candidate's Mobile number (max 10 digits).
 */
export function sanitizeMobileInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, FIELD_LIMITS.candidateMobileLen);
}

export function validateCandidateForm(values: CandidateFormValues): {
  isValid: boolean;
  errors: CandidateValidationErrors;
  sanitized: CandidateFormValues;
} {
  const errors: CandidateValidationErrors = {};

  const submissionDate = values.submissionDate.trim();
  const managerName = values.managerName.trim().slice(0, FIELD_LIMITS.managerNameMax);
  const recruiterName = values.recruiterName.trim().slice(0, FIELD_LIMITS.recruiterNameMax);
  const clientName = values.clientName.trim().slice(0, FIELD_LIMITS.clientNameMax);
  const purpose = values.purpose.trim().slice(0, FIELD_LIMITS.purposeMax);
  const candidateName = normalizeCandidateName(values.candidateName);
  const candidateMobile = values.candidateMobile.trim();
  const city = values.city.trim().slice(0, FIELD_LIMITS.cityMax);
  const resumeUrl = values.resumeUrl.trim().slice(0, FIELD_LIMITS.resumeUrlMax);
  const resumeFileName = values.resumeFileName.trim().slice(0, FIELD_LIMITS.resumeFileNameMax);
  const resumeStoragePath = values.resumeStoragePath.trim().slice(0, FIELD_LIMITS.resumeStoragePathMax);

  if (!SUBMISSION_DATE_REGEX.test(submissionDate)) {
    errors.submissionDate = 'Select a valid date (YYYY-MM-DD).';
  }

  if (!managerName) {
    errors.managerName = 'Manager Name is required.';
  }

  if (!recruiterName) {
    errors.recruiterName = 'Recruiter Name is required.';
  }

  if (!clientName) {
    errors.clientName = 'Client Name is required.';
  }

  if (!purpose) {
    errors.purpose = 'Purpose is required.';
  }

  if (!candidateName) {
    errors.candidateName = "Candidate's Name is required.";
  } else if (!CANDIDATE_NAME_REGEX.test(candidateName)) {
    errors.candidateName = 'Use letters and spaces only (no numbers or special characters).';
  }

  if (!candidateMobile) {
    errors.candidateMobile = "Candidate's Mobile number is required.";
  } else if (!CANDIDATE_MOBILE_REGEX.test(candidateMobile)) {
    errors.candidateMobile = 'Mobile number must be exactly 10 numeric digits.';
  }

  if (!city) {
    errors.city = 'Store / Warehouse city is required.';
  }

  if (resumeUrl && !RESUME_URL_REGEX.test(resumeUrl)) {
    errors.resumeUrl = 'Resume link must start with https:// or http://.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      ...values,
      submissionDate,
      managerName,
      recruiterName,
      clientName,
      purpose,
      candidateName,
      candidateMobile,
      city,
      resumeUrl,
      resumeFileName,
      resumeStoragePath,
    },
  };
}

export function findDuplicateMobileRecords(
  records: CandidateRecord[],
  mobile: string,
  excludeRecordId?: string
): CandidateRecord[] {
  const clean = mobile.trim();
  if (!CANDIDATE_MOBILE_REGEX.test(clean)) return [];
  return records.filter(
    (rec) => rec.candidateMobile === clean && (!excludeRecordId || rec.id !== excludeRecordId)
  );
}

export function validateResumeFile(file: {
  name: string;
  size: number;
  type: string;
}): { valid: boolean; error?: string } {
  const lowerName = file.name.toLowerCase();
  const hasAllowedExt = ALLOWED_RESUME_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const hasAllowedMime =
    !file.type || (ALLOWED_RESUME_MIME_TYPES as readonly string[]).includes(file.type);

  if (!hasAllowedExt || !hasAllowedMime) {
    return { valid: false, error: 'Only PDF, DOC, or DOCX resume files are accepted.' };
  }

  if (file.size <= 0) {
    return { valid: false, error: 'Selected resume file is empty.' };
  }

  if (file.size > FIELD_LIMITS.maxResumeFileBytes) {
    return { valid: false, error: 'Resume file must be 5 MB or smaller.' };
  }

  return { valid: true };
}

export function isSafeHttpUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Pure RBAC policy mirror used for defensive UI guards and security invariant unit tests.
 * Actual enforcement is performed server-side in firestore.rules.
 */
export function canUserAccessCandidate(
  actor: Pick<UserProfile, 'uid' | 'role' | 'isActive'> | null,
  record: Pick<CandidateRecord, 'recruiter_uid'>,
  action: 'read' | 'update' | 'delete'
): boolean {
  if (!actor || !actor.isActive) return false;
  if (actor.role === UserRole.ADMIN) return true;
  if (action === 'read' || action === 'update' || action === 'delete') {
    return record.recruiter_uid === actor.uid;
  }
  return false;
}
