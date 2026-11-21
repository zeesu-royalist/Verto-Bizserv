import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canUserAccessCandidate,
  findDuplicateMobileRecords,
  isSafeHttpUrl,
  sanitizeCandidateNameInput,
  sanitizeMobileInput,
  validateCandidateForm,
  validateResumeFile,
} from './validation';
import { CandidateFormValues, CandidateRecord, UserRole } from '../types/recruitment';

const validForm: CandidateFormValues = {
  submissionDate: '2026-11-21',
  managerName: 'Ananya Verma',
  recruiterName: 'Priya Menon',
  clientName: 'Flipkart Supply Chain',
  purpose: 'Lineup',
  candidateName: 'Deepak Sharma',
  candidateMobile: '9820145678',
  city: 'Bhiwandi',
  resumeUrl: 'https://example.com/resumes/deepak.pdf',
  resumeFileName: 'deepak.pdf',
  resumeStoragePath: '',
};

test('validateCandidateForm accepts a complete valid 9-column submission', () => {
  const result = validateCandidateForm(validForm);
  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, {});
  assert.equal(result.sanitized.candidateName, 'Deepak Sharma');
});

test('validateCandidateForm blocks numbers and special characters in Candidate Name', () => {
  const withDigits = validateCandidateForm({ ...validForm, candidateName: 'Deepak 123' });
  assert.equal(withDigits.isValid, false);
  assert.ok(withDigits.errors.candidateName);

  const withSymbols = validateCandidateForm({ ...validForm, candidateName: 'Deepak@Sharma!' });
  assert.equal(withSymbols.isValid, false);
  assert.ok(withSymbols.errors.candidateName);

  const spacesOnly = validateCandidateForm({ ...validForm, candidateName: '    ' });
  assert.equal(spacesOnly.isValid, false);
  assert.ok(spacesOnly.errors.candidateName);
});

test('sanitizeCandidateNameInput strips digits and special symbols live', () => {
  assert.equal(sanitizeCandidateNameInput('R@hul 99 Kum#ar!'), 'Rhul Kumar');
});

test('validateCandidateForm enforces exact 10-digit numeric mobile validation', () => {
  assert.equal(validateCandidateForm({ ...validForm, candidateMobile: '982014567' }).isValid, false);
  assert.equal(validateCandidateForm({ ...validForm, candidateMobile: '98201456789' }).isValid, false);
  assert.equal(validateCandidateForm({ ...validForm, candidateMobile: '982014567a' }).isValid, false);
  assert.equal(sanitizeMobileInput('+91 98201-45678'), '9198201456');
});

test('validateCandidateForm blocks javascript: XSS resume URLs while permitting empty or https URLs', () => {
  assert.equal(validateCandidateForm({ ...validForm, resumeUrl: '' }).isValid, true);
  assert.equal(validateCandidateForm({ ...validForm, resumeUrl: 'javascript:alert(1)' }).isValid, false);
  assert.equal(isSafeHttpUrl('https://storage.googleapis.com/bucket/cv.pdf'), true);
  assert.equal(isSafeHttpUrl('javascript:void(0)'), false);
});

test('findDuplicateMobileRecords flags matching mobile numbers and excludes self during edit', () => {
  const existing: CandidateRecord[] = [
    {
      ...validForm,
      id: 'rec-1',
      recruiter_uid: 'u1',
      recruiter_email: 'u1@test.com',
      createdAtMs: 1000,
      updatedAtMs: 1000,
    },
  ];
  assert.equal(findDuplicateMobileRecords(existing, '9820145678').length, 1);
  assert.equal(findDuplicateMobileRecords(existing, '9820145678', 'rec-1').length, 0);
  assert.equal(findDuplicateMobileRecords(existing, '982014567').length, 0);
});

test('validateResumeFile accepts PDF/DOC/DOCX under 5MB and rejects executables or oversized files', () => {
  assert.equal(
    validateResumeFile({ name: 'cv.pdf', size: 120_000, type: 'application/pdf' }).valid,
    true
  );
  assert.equal(
    validateResumeFile({ name: 'cv.docx', size: 200_000, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }).valid,
    true
  );
  assert.equal(
    validateResumeFile({ name: 'malware.exe', size: 10_000, type: 'application/octet-stream' }).valid,
    false
  );
  assert.equal(
    validateResumeFile({ name: 'huge.pdf', size: 6 * 1024 * 1024, type: 'application/pdf' }).valid,
    false
  );
});

test('canUserAccessCandidate enforces strict recruiter isolation, admin bypass, and deactivation revocation', () => {
  const recA = { uid: 'rec-a', role: UserRole.RECRUITER, isActive: true };
  const recB = { uid: 'rec-b', role: UserRole.RECRUITER, isActive: true };
  const recADeactivated = { uid: 'rec-a', role: UserRole.RECRUITER, isActive: false };
  const admin = { uid: 'adm-1', role: UserRole.ADMIN, isActive: true };
  const recordOwnedByA = { recruiter_uid: 'rec-a' };

  assert.equal(canUserAccessCandidate(recA, recordOwnedByA, 'read'), true);
  assert.equal(canUserAccessCandidate(recB, recordOwnedByA, 'read'), false);
  assert.equal(canUserAccessCandidate(recB, recordOwnedByA, 'delete'), false);
  assert.equal(canUserAccessCandidate(recADeactivated, recordOwnedByA, 'read'), false);
  assert.equal(canUserAccessCandidate(admin, recordOwnedByA, 'read'), true);
  assert.equal(canUserAccessCandidate(admin, recordOwnedByA, 'update'), true);
});
