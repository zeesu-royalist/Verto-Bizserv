import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));

test('firestore.rules enforces global default-deny catch-all first', () => {
  assert.match(rulesContent, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
});

test('firestore.rules enforces strict email verification and bootstrapped admin check', () => {
  assert.match(rulesContent, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesContent, /rahul\.kumar376603@gmail\.com/);
});

test('firestore.rules enforces strict row-level isolation on candidate get, list, update, delete', () => {
  assert.match(rulesContent, /existing\(\)\.recruiter_uid == request\.auth\.uid/);
  assert.match(rulesContent, /resource\.data\.recruiter_uid == request\.auth\.uid/);
  assert.match(rulesContent, /incoming\(\)\.recruiterName == getUserDoc\(\)\.data\.name/);
  assert.match(rulesContent, /incoming\(\)\.recruiterName == existing\(\)\.recruiterName/);
});

test('firestore.rules prevents self-privilege escalation and shadow field injection', () => {
  assert.match(rulesContent, /data\.keys\(\)\.hasOnly\(/);
  assert.match(rulesContent, /affectedKeys\(\)\.hasOnly\(/);
  assert.match(rulesContent, /incoming\(\)\.role == existing\(\)\.role/);
  assert.match(rulesContent, /incoming\(\)\.isActive == existing\(\)\.isActive/);
});

test('firestore.rules regex validations stay verbatim synchronized with firebase-blueprint.json', () => {
  const candidateProps = blueprint.entities.Candidate.properties;
  assert.ok(rulesContent.includes(candidateProps.candidateName.pattern));
  assert.ok(rulesContent.includes(candidateProps.candidateMobile.pattern));
  assert.ok(rulesContent.includes(candidateProps.submissionDate.pattern));
});

test('firestore.rules restricts /managers and /clients writes to admins while allowing active-user reads', () => {
  assert.match(rulesContent, /match \/managers\/\{managerId\}/);
  assert.match(rulesContent, /match \/clients\/\{clientId\}/);
  assert.match(rulesContent, /isValidDropdownOption\(incoming\(\), 100\)/);
  assert.match(rulesContent, /isValidDropdownOption\(incoming\(\), 120\)/);
});
