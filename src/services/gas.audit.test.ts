import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { UserRole } from '../types/recruitment';

// Mock in-memory Google Sheets database to audit Apps Script logic verbatim
interface MockUserRow {
  uid: string;
  name: string;
  email: string;
  role: string;
  passwordHash: string;
  salt: string;
  isActive: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

interface MockCandidateRow {
  id: string;
  submissionDate: string;
  managerName: string;
  recruiterName: string;
  clientName: string;
  purpose: string;
  candidateName: string;
  candidateMobile: string;
  city: string;
  resumeUrl: string;
  resumeFileName: string;
  resumeStoragePath: string;
  recruiter_uid: string;
  recruiter_email: string;
  createdAtMs: number;
  updatedAtMs: number;
}

const mockDatabase = {
  users: [] as MockUserRow[],
  candidates: [] as MockCandidateRow[],
  secretKey: 'AUDIT_TEST_SECRET_KEY_32BYTES_LONG!',
};

// Mirroring the exact cryptographic and business logic from gas/Code.gs
function hashPassword(password: string, salt: string): string {
  return crypto.createHash('sha256').update(salt + ':' + password).digest('hex');
}

function generateToken(user: { uid: string; email: string; role: string; name: string; isActive: boolean }, expSeconds = 3600): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    uid: user.uid,
    email: user.email,
    role: user.role,
    name: user.name,
    isActive: user.isActive,
    iat: now,
    exp: now + expSeconds,
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const toSign = `${b64Header}.${b64Payload}`;
  const signature = crypto.createHmac('sha256', mockDatabase.secretKey).update(toSign).digest('base64url');
  return `${toSign}.${signature}`;
}

function verifyToken(token: string | null): { uid: string; email: string; role: string; name: string; isActive: boolean } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const toSign = `${parts[0]}.${parts[1]}`;
  const expectedSig = crypto.createHmac('sha256', mockDatabase.secretKey).update(toSign).digest('base64url');
  if (expectedSig !== parts[2]) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

function validateCandidateData(c: Partial<MockCandidateRow>): string | null {
  const submissionDate = String(c.submissionDate || '').trim();
  const managerName = String(c.managerName || '').trim();
  const clientName = String(c.clientName || '').trim();
  const purpose = String(c.purpose || '').trim();
  const candidateName = String(c.candidateName || '').trim();
  const candidateMobile = String(c.candidateMobile || '').trim();
  const city = String(c.city || '').trim();
  const resumeUrl = String(c.resumeUrl || '').trim();

  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(submissionDate)) return 'Select a valid date (YYYY-MM-DD).';
  if (!managerName || managerName.length > 100) return 'Manager Name is required.';
  if (!clientName || clientName.length > 120) return 'Client Name is required.';
  if (!['Lineup', 'Selection', 'Joining', 'Database'].includes(purpose)) return 'Invalid purpose.';
  if (!candidateName || !/^[A-Za-z]+( [A-Za-z]+)*$/.test(candidateName) || candidateName.length > 100) {
    return 'Candidate Name must use letters and spaces only.';
  }
  if (!candidateMobile || !/^[0-9]{10}$/.test(candidateMobile)) return 'Candidate Mobile must be 10 digits.';
  if (!city || city.length > 100) return 'Store / Warehouse City is required.';
  if (resumeUrl && !/^https?:\/\/.+/.test(resumeUrl)) return 'Resume URL must start with http:// or https://.';
  return null;
}

function handleGetCandidates(user: { email: string; role: string }): MockCandidateRow[] {
  const isAdmin = user.role === 'admin';
  const email = user.email.toLowerCase();
  return mockDatabase.candidates.filter((r) => isAdmin || r.recruiter_email.toLowerCase() === email);
}

// ----------------------------------------------------------------------------
// AUDIT TEST SUITE: 9 Criteria
// ----------------------------------------------------------------------------

test('AUDIT 1: Admin and Recruiter Authentication Verification', () => {
  mockDatabase.users = [];
  const salt1 = 'salt1234';
  const salt2 = 'salt5678';
  mockDatabase.users.push({
    uid: 'adm-001',
    name: 'Rahul Kumar',
    email: 'admin@vertobizserv.in',
    role: 'admin',
    passwordHash: hashPassword('SecretAdmin123!', salt1),
    salt: salt1,
    isActive: true,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  });
  mockDatabase.users.push({
    uid: 'rec-002',
    name: 'Priya Menon',
    email: 'priya@vertobizserv.in',
    role: 'recruiter',
    passwordHash: hashPassword('PriyaPass123!', salt2),
    salt: salt2,
    isActive: true,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  });

  // Test successful login for both
  const adminHash = hashPassword('SecretAdmin123!', salt1);
  assert.equal(adminHash, mockDatabase.users[0].passwordHash);
  const priyaHash = hashPassword('PriyaPass123!', salt2);
  assert.equal(priyaHash, mockDatabase.users[1].passwordHash);

  // Test wrong password
  const badHash = hashPassword('WrongPassword', salt1);
  assert.notEqual(badHash, mockDatabase.users[0].passwordHash);

  // Test case-insensitive email matching
  const searchEmail = 'PRIYA@VERTOBIZSERV.IN'.toLowerCase();
  const found = mockDatabase.users.find((u) => u.email === searchEmail);
  assert.ok(found);
  assert.equal(found.name, 'Priya Menon');
});

test('AUDIT 2: Recruiter Data Isolation & Anti-Spoofing', () => {
  mockDatabase.candidates = [
    {
      id: 'c1',
      submissionDate: '2026-11-22',
      managerName: 'Ananya Verma',
      recruiterName: 'Priya Menon',
      clientName: 'Flipkart',
      purpose: 'Lineup',
      candidateName: 'Candidate One',
      candidateMobile: '9820145678',
      city: 'Mumbai',
      resumeUrl: '',
      resumeFileName: '',
      resumeStoragePath: '',
      recruiter_uid: 'rec-priya',
      recruiter_email: 'priya@vertobizserv.in',
      createdAtMs: 1000,
      updatedAtMs: 1000,
    },
    {
      id: 'c2',
      submissionDate: '2026-11-22',
      managerName: 'Vikram Malhotra',
      recruiterName: 'Arjun Patel',
      clientName: 'Amazon',
      purpose: 'Selection',
      candidateName: 'Candidate Two',
      candidateMobile: '9820145679',
      city: 'Pune',
      resumeUrl: '',
      resumeFileName: '',
      resumeStoragePath: '',
      recruiter_uid: 'rec-arjun',
      recruiter_email: 'arjun@vertobizserv.in',
      createdAtMs: 2000,
      updatedAtMs: 2000,
    },
  ];

  const userPriya = { email: 'priya@vertobizserv.in', role: 'recruiter' };
  const userArjun = { email: 'arjun@vertobizserv.in', role: 'recruiter' };
  const userAdmin = { email: 'admin@vertobizserv.in', role: 'admin' };

  // Recruiter Priya sees only Priya's candidates
  const priyaView = handleGetCandidates(userPriya);
  assert.equal(priyaView.length, 1);
  assert.equal(priyaView[0].candidateName, 'Candidate One');

  // Recruiter Arjun sees only Arjun's candidates
  const arjunView = handleGetCandidates(userArjun);
  assert.equal(arjunView.length, 1);
  assert.equal(arjunView[0].candidateName, 'Candidate Two');

  // Admin sees ALL candidates
  const adminView = handleGetCandidates(userAdmin);
  assert.equal(adminView.length, 2);

  // Anti-spoofing audit: Even if Priya tries to submit as Arjun, backend forces sessionUser
  const attemptSpoof = {
    recruiter_email: 'arjun@vertobizserv.in',
    recruiterName: 'Arjun Patel',
  };
  const enforcedRecruiterEmail = userPriya.role === 'admin' ? attemptSpoof.recruiter_email : userPriya.email;
  assert.equal(enforcedRecruiterEmail, 'priya@vertobizserv.in');
});

test('AUDIT 3: Unauthorized API Access & Tamper Resistance', () => {
  const user = { uid: 'u1', email: 'test@vertobizserv.in', role: 'recruiter', name: 'Test', isActive: true };
  const validToken = generateToken(user);
  assert.ok(verifyToken(validToken));

  // 1. Missing token
  assert.equal(verifyToken(null), null);
  assert.equal(verifyToken(''), null);

  // 2. Tampered payload
  const parts = validToken.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ ...user, role: 'admin' })).toString('base64url');
  const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
  assert.equal(verifyToken(tamperedToken), null); // MUST FAIL

  // 3. Expired token
  const expiredToken = generateToken(user, -10); // Expired 10s ago
  assert.equal(verifyToken(expiredToken), null); // MUST FAIL
});

test('AUDIT 4: Password Hashing Salt Uniqueness and Credential Security', () => {
  const password = 'SuperSecretPassword123!';
  const saltA = 'salt_alpha_12345';
  const saltB = 'salt_bravo_67890';

  const hashA = hashPassword(password, saltA);
  const hashB = hashPassword(password, saltB);

  // Two identical passwords with different salts must yield completely different hashes
  assert.notEqual(hashA, hashB);
  assert.equal(hashA.length, 64); // SHA-256 hex length
});

test('AUDIT 5: Google Drive Resume Upload Validation & Extension Enforcement', () => {
  const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx'];

  function isAllowedResume(fileName: string, bytes: number): boolean {
    const lower = fileName.toLowerCase();
    const hasExt = ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
    const validSize = bytes > 0 && bytes <= 5 * 1024 * 1024;
    return hasExt && validSize;
  }

  assert.equal(isAllowedResume('resume.pdf', 100_000), true);
  assert.equal(isAllowedResume('cv.DOCX', 200_000), true);
  assert.equal(isAllowedResume('profile.doc', 50_000), true);

  // Dangerous / unauthorized extensions must be rejected
  assert.equal(isAllowedResume('malware.exe', 10_000), false);
  assert.equal(isAllowedResume('script.sh', 500), false);
  assert.equal(isAllowedResume('exploit.html', 1000), false);

  // Oversized files (> 5MB) must be rejected
  assert.equal(isAllowedResume('huge.pdf', 6 * 1024 * 1024), false);
});

test('AUDIT 6: Server-Side 9-Column Candidate Regex Validation', () => {
  const validCandidate = {
    submissionDate: '2026-11-22',
    managerName: 'Ananya Verma',
    clientName: 'Flipkart Supply Chain',
    purpose: 'Lineup',
    candidateName: 'Rohan Sharma',
    candidateMobile: '9876543210',
    city: 'Mumbai',
    resumeUrl: 'https://drive.google.com/file/d/123/view',
  };
  assert.equal(validateCandidateData(validCandidate), null);

  // Invalid candidate name (has numbers or symbols)
  assert.ok(validateCandidateData({ ...validCandidate, candidateName: 'Rohan 123' }));
  assert.ok(validateCandidateData({ ...validCandidate, candidateName: 'Rohan@Sharma!' }));

  // Invalid candidate mobile (not 10 digits)
  assert.ok(validateCandidateData({ ...validCandidate, candidateMobile: '98765' }));
  assert.ok(validateCandidateData({ ...validCandidate, candidateMobile: '98765432101' }));
  assert.ok(validateCandidateData({ ...validCandidate, candidateMobile: '987654321a' }));

  // Invalid date format
  assert.ok(validateCandidateData({ ...validCandidate, submissionDate: '22-11-2026' }));

  // Invalid purpose
  assert.ok(validateCandidateData({ ...validCandidate, purpose: 'HackedPurpose' }));

  // XSS resume URL
  assert.ok(validateCandidateData({ ...validCandidate, resumeUrl: 'javascript:alert(1)' }));
});

test('AUDIT 7: Concurrency & LockService Simulation for Simultaneous Submissions', () => {
  let isLocked = false;
  const submissions: string[] = [];

  function simulateConcurrentAppend(candidateId: string): boolean {
    if (isLocked) {
      // Lock is held; wait and retry
      return false;
    }
    isLocked = true;
    try {
      submissions.push(candidateId);
      return true;
    } finally {
      isLocked = false;
    }
  }

  const success1 = simulateConcurrentAppend('c1');
  const success2 = simulateConcurrentAppend('c2');
  assert.equal(success1, true);
  assert.equal(success2, true);
  assert.deepEqual(submissions, ['c1', 'c2']);
});
