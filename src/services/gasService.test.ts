import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearStoredSession,
  getGasApiUrl,
  getStoredToken,
  getStoredUser,
  setGasApiUrl,
  setStoredSession,
} from './gasService';
import { UserProfile, UserRole } from '../types/recruitment';

// Mock localStorage for Node test runner
const storage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => {
    storage[key] = String(value);
  },
  removeItem: (key: string) => {
    delete storage[key];
  },
  clear: () => {
    Object.keys(storage).forEach((k) => delete storage[k]);
  },
  length: 0,
  key: () => null,
};

test('gasService: getGasApiUrl and setGasApiUrl handle runtime overrides', () => {
  localStorage.clear();
  assert.equal(getGasApiUrl(), '');

  setGasApiUrl('https://script.google.com/macros/s/TEST_EXEC/exec');
  assert.equal(getGasApiUrl(), 'https://script.google.com/macros/s/TEST_EXEC/exec');

  setGasApiUrl(null);
  assert.equal(getGasApiUrl(), '');
});

test('gasService: setStoredSession, getStoredToken, getStoredUser, clearStoredSession maintain state', () => {
  localStorage.clear();
  const sampleUser: UserProfile = {
    uid: 'usr-123',
    name: 'Priya Menon',
    email: 'priya@vertobizserv.in',
    role: UserRole.RECRUITER,
    isActive: true,
    createdAtMs: 1700000000000,
    updatedAtMs: 1700000000000,
  };

  setStoredSession('jwt-token-abc', sampleUser);
  assert.equal(getStoredToken(), 'jwt-token-abc');
  assert.deepEqual(getStoredUser(), sampleUser);

  clearStoredSession();
  assert.equal(getStoredToken(), null);
  assert.equal(getStoredUser(), null);
});
