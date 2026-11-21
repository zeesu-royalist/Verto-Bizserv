import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { FirestoreErrorInfo, OperationType } from '../types/recruitment';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'rahul.kumar376603@gmail.com';

// Google Workspace OAuth scopes (minimized to Google Drive for uploading resumes to the designated shared folder)
export const GOOGLE_DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'] as const;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
GOOGLE_DRIVE_SCOPES.forEach((scope) => {
  googleProvider.addScope(scope);
});
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Strictly in-memory OAuth access token cache (never persisted to localStorage or sessionStorage)
let cachedDriveAccessToken: string | null = null;
const driveTokenListeners = new Set<(connected: boolean) => void>();

function notifyDriveTokenListeners(): void {
  const connected = Boolean(cachedDriveAccessToken);
  driveTokenListeners.forEach((listener) => {
    try {
      listener(connected);
    } catch {
      // Ignore subscriber errors
    }
  });
}

export function setDriveAccessToken(token: string | null): void {
  cachedDriveAccessToken = token && token.trim() ? token.trim() : null;
  notifyDriveTokenListeners();
}

export function getDriveAccessToken(): string | null {
  return cachedDriveAccessToken;
}

export function clearDriveAccessToken(): void {
  setDriveAccessToken(null);
}

export function subscribeToDriveTokenState(
  listener: (connected: boolean) => void
): () => void {
  driveTokenListeners.add(listener);
  listener(Boolean(cachedDriveAccessToken));
  return () => {
    driveTokenListeners.delete(listener);
  };
}

// Clear in-memory Google Drive access token whenever the Firebase user signs out
onAuthStateChanged(auth, (user) => {
  if (!user) {
    clearDriveAccessToken();
  }
});

/**
 * Signs in with Google via popup and captures the Google Drive OAuth access token in memory.
 */
export async function signInWithGoogleAndDrive(): Promise<{
  user: FirebaseUser;
  accessToken: string | null;
}> {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken ?? null;
  setDriveAccessToken(accessToken);
  return { user: result.user, accessToken };
}

/**
 * Authorizes (or re-authorizes) Google Drive access for the currently signed-in session
 * without storing tokens in browser storage.
 */
export async function connectGoogleDriveAccess(): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    const { accessToken } = await signInWithGoogleAndDrive();
    if (!accessToken) {
      throw new Error('Google Drive authorization did not return an access token. Please try again.');
    }
    return accessToken;
  }

  const hasGoogleProvider = currentUser.providerData.some((p) => p.providerId === 'google.com');
  const result = hasGoogleProvider
    ? await reauthenticateWithPopup(currentUser, googleProvider)
    : await linkWithPopup(currentUser, googleProvider);

  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken ?? null;
  if (!accessToken) {
    throw new Error('Could not obtain Google Drive permission. Please approve Drive access and try again.');
  }

  setDriveAccessToken(accessToken);
  return accessToken;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;

export async function testFirestoreConnection(): Promise<void> {
  if (connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
