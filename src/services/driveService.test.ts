import test from 'node:test';
import assert from 'node:assert/strict';
import { PURPOSE_OPTIONS } from '../data/constants';
import {
  buildDriveFileViewUrl,
  buildDriveResumeFileName,
  RESUME_DRIVE_FOLDER_ID,
  RESUME_DRIVE_FOLDER_URL,
} from './driveService';

test('RESUME_DRIVE_FOLDER_ID and URL point to the designated Verto Bizserv Google Drive folder', () => {
  assert.equal(RESUME_DRIVE_FOLDER_ID, 'YOUR_RESUME_FOLDER_ID');
  assert.equal(
    RESUME_DRIVE_FOLDER_URL,
    'https://drive.google.com/drive/my-drive'
  );
});

test('PURPOSE_OPTIONS contains strictly the 4 requested values: Lineup, Selection, Joining, Database', () => {
  assert.deepEqual(Array.from(PURPOSE_OPTIONS), ['Lineup', 'Selection', 'Joining', 'Database']);
});

test('buildDriveResumeFileName produces clean, extension-preserving filenames for Google Drive', () => {
  const withCandidate = buildDriveResumeFileName('resume (final).pdf', 'Nikhil Sharma');
  assert.ok(withCandidate.startsWith('Nikhil_Sharma_'));
  assert.ok(withCandidate.endsWith('.pdf'));
  assert.ok(!/[^a-zA-Z0-9._-]/.test(withCandidate));

  const withoutCandidate = buildDriveResumeFileName('My CV@2026.DOCX');
  assert.ok(withoutCandidate.endsWith('.docx'));
  assert.ok(!/[^a-zA-Z0-9._-]/.test(withoutCandidate));
});

test('buildDriveFileViewUrl builds standard HTTPS Google Drive file view links', () => {
  assert.equal(
    buildDriveFileViewUrl('1abc_XYZ-99'),
    'https://drive.google.com/file/d/1abc_XYZ-99/view'
  );
});
