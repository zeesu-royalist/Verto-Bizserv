import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { User as FirebaseUser } from 'firebase/auth';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  storage,
} from '../lib/firebase';
import {
  CandidateFormValues,
  CandidateRecord,
  DropdownOption,
  OperationType,
  UserProfile,
  UserRole,
} from '../types/recruitment';
import { FIELD_LIMITS, validateCandidateForm, validateResumeFile } from '../utils/validation';

function timestampToMs(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object' && 'seconds' in val) {
    const secs = (val as { seconds: number }).seconds;
    return secs * 1000;
  }
  return Date.now();
}

function mapUserDoc(uid: string, data: Record<string, unknown>): UserProfile {
  return {
    uid: typeof data.uid === 'string' ? data.uid : uid,
    name: typeof data.name === 'string' ? data.name : 'Recruiter',
    email: typeof data.email === 'string' ? data.email : '',
    role: data.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.RECRUITER,
    isActive: data.isActive !== false,
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

function mapCandidateDoc(id: string, data: Record<string, unknown>): CandidateRecord {
  return {
    id,
    submissionDate: String(data.submissionDate ?? ''),
    managerName: String(data.managerName ?? ''),
    recruiterName: String(data.recruiterName ?? ''),
    clientName: String(data.clientName ?? ''),
    purpose: String(data.purpose ?? ''),
    candidateName: String(data.candidateName ?? ''),
    candidateMobile: String(data.candidateMobile ?? ''),
    city: String(data.city ?? ''),
    resumeUrl: String(data.resumeUrl ?? ''),
    resumeFileName: String(data.resumeFileName ?? ''),
    resumeStoragePath: String(data.resumeStoragePath ?? ''),
    recruiter_uid: String(data.recruiter_uid ?? ''),
    recruiter_email: String(data.recruiter_email ?? ''),
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

/**
 * Ensures the authenticated Firebase user has a corresponding profile document in /users/{uid}.
 * Bootstrapped admin email automatically initializes with role "admin"; all others start as "recruiter".
 */
export async function ensureUserProfile(
  fbUser: FirebaseUser,
  preferredDisplayName?: string
): Promise<UserProfile> {
  const path = `users/${fbUser.uid}`;
  const userRef = doc(db, 'users', fbUser.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (existingSnap.exists()) {
    return mapUserDoc(fbUser.uid, existingSnap.data() as Record<string, unknown>);
  }

  const email = (fbUser.email || '').trim().toLowerCase();
  const fallbackName = email ? email.split('@')[0].replace(/[._-]+/g, ' ') : 'Recruiter';
  const rawName = (preferredDisplayName || fbUser.displayName || fallbackName).trim();
  const cleanName = rawName.slice(0, FIELD_LIMITS.userNameMax) || 'Recruiter';
  const initialRole =
    fbUser.emailVerified && email === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
      ? UserRole.ADMIN
      : UserRole.RECRUITER;

  const newProfilePayload = {
    uid: fbUser.uid,
    name: cleanName,
    email: fbUser.email || email,
    role: initialRole,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(userRef, newProfilePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return {
    uid: fbUser.uid,
    name: cleanName,
    email: fbUser.email || email,
    role: initialRole,
    isActive: true,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  };
}

export function subscribeToOwnUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      onData(mapUserDoc(uid, snapshot.data() as Record<string, unknown>));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

/**
 * Admin-only subscription to all users in /users.
 */
export function subscribeToAllUsers(
  onData: (users: UserProfile[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = 'users';
  return onSnapshot(
    collection(db, 'users'),
    (snapshot) => {
      const users = snapshot.docs
        .map((d) => mapUserDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.name.localeCompare(b.name));
      onData(users);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

/**
 * Subscribes to candidates with strict RBAC query enforcement:
 * - Recruiters query ONLY where recruiter_uid == profile.uid (enforced by firestore.rules).
 * - Admins subscribe to the unified merged collection across all recruiters.
 */
export function subscribeToCandidates(
  profile: UserProfile,
  onData: (records: CandidateRecord[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = 'candidates';
  const baseCollection = collection(db, 'candidates');
  const q =
    profile.role === UserRole.ADMIN
      ? baseCollection
      : query(baseCollection, where('recruiter_uid', '==', profile.uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const records = snapshot.docs
        .map((d) => mapCandidateDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(records);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function createCandidateRecord(
  actor: UserProfile,
  values: CandidateFormValues
): Promise<string> {
  const isAdmin = actor.role === UserRole.ADMIN;

  // Recruiters are strictly locked to their own profile name, UID, and email
  const enforcedValues: CandidateFormValues = {
    ...values,
    recruiterName: isAdmin ? values.recruiterName : actor.name,
  };

  const validation = validateCandidateForm(enforcedValues);
  if (!validation.isValid) {
    throw new Error(Object.values(validation.errors)[0] || 'Invalid candidate data.');
  }

  const s = validation.sanitized;
  const ownerUid = isAdmin && s.assignedRecruiterUid ? s.assignedRecruiterUid : actor.uid;
  const ownerEmail = isAdmin && s.assignedRecruiterEmail ? s.assignedRecruiterEmail : actor.email;

  const payload = {
    submissionDate: s.submissionDate,
    managerName: s.managerName,
    recruiterName: isAdmin ? s.recruiterName : actor.name,
    clientName: s.clientName,
    purpose: s.purpose,
    candidateName: s.candidateName,
    candidateMobile: s.candidateMobile,
    city: s.city,
    resumeUrl: s.resumeUrl,
    resumeFileName: s.resumeFileName,
    resumeStoragePath: s.resumeStoragePath,
    recruiter_uid: ownerUid,
    recruiter_email: ownerEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(db, 'candidates'), payload);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'candidates');
  }
}

export async function updateCandidateRecord(
  actor: UserProfile,
  existingRecord: CandidateRecord,
  values: CandidateFormValues
): Promise<void> {
  const isAdmin = actor.role === UserRole.ADMIN;

  const enforcedValues: CandidateFormValues = {
    ...values,
    recruiterName: isAdmin ? values.recruiterName : existingRecord.recruiterName,
  };

  const validation = validateCandidateForm(enforcedValues);
  if (!validation.isValid) {
    throw new Error(Object.values(validation.errors)[0] || 'Invalid candidate data.');
  }

  const s = validation.sanitized;
  const path = `candidates/${existingRecord.id}`;

  const updatePayload: Record<string, unknown> = {
    submissionDate: s.submissionDate,
    managerName: s.managerName,
    clientName: s.clientName,
    purpose: s.purpose,
    candidateName: s.candidateName,
    candidateMobile: s.candidateMobile,
    city: s.city,
    resumeUrl: s.resumeUrl,
    resumeFileName: s.resumeFileName,
    resumeStoragePath: s.resumeStoragePath,
    updatedAt: serverTimestamp(),
  };

  if (isAdmin) {
    updatePayload.recruiterName = s.recruiterName;
  }

  try {
    await updateDoc(doc(db, 'candidates', existingRecord.id), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCandidateRecord(candidateId: string): Promise<void> {
  const path = `candidates/${candidateId}`;
  try {
    await deleteDoc(doc(db, 'candidates', candidateId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateUserRoleOrStatus(
  targetUid: string,
  updates: { role?: UserRole; isActive?: boolean; name?: string }
): Promise<void> {
  const path = `users/${targetUid}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (updates.role !== undefined) payload.role = updates.role;
  if (updates.isActive !== undefined) payload.isActive = updates.isActive;
  if (updates.name !== undefined) {
    payload.name = updates.name.trim().slice(0, FIELD_LIMITS.userNameMax);
  }

  try {
    await updateDoc(doc(db, 'users', targetUid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function uploadResumeToStorage(
  ownerUid: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ downloadUrl: string; fileName: string; storagePath: string }> {
  const check = validateResumeFile(file);
  if (!check.valid) {
    throw new Error(check.error || 'Invalid resume file.');
  }

  const safeBaseName = file.name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
  const storagePath = `resumes/${ownerUid}/${Date.now()}_${safeBaseName}`;
  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
    });

    task.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      (error) => {
        reject(
          new Error(
            error.code === 'storage/unauthorized'
              ? 'Cloud Storage upload was blocked by Storage Rules. Ensure Firebase Storage is enabled and storage.rules are deployed, or paste a resume URL link instead.'
              : `Resume upload failed: ${error.message}`
          )
        );
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(task.snapshot.ref);
          resolve({
            downloadUrl,
            fileName: file.name.slice(0, FIELD_LIMITS.resumeFileNameMax),
            storagePath,
          });
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Failed to fetch resume download URL.'));
        }
      }
    );
  });
}

function mapDropdownOptionDoc(id: string, data: Record<string, unknown>): DropdownOption {
  return {
    id,
    name: String(data.name ?? ''),
    isActive: data.isActive !== false,
    createdAtMs: timestampToMs(data.createdAt),
    updatedAtMs: timestampToMs(data.updatedAt),
  };
}

export function subscribeToDropdownOptions(
  collectionName: 'managers' | 'clients',
  isAdmin: boolean,
  onData: (options: DropdownOption[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const baseCollection = collection(db, collectionName);
  const q = isAdmin ? baseCollection : query(baseCollection, where('isActive', '==', true));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => mapDropdownOptionDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.name.localeCompare(b.name));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, collectionName);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function addDropdownOption(
  collectionName: 'managers' | 'clients',
  name: string
): Promise<string> {
  const maxLen =
    collectionName === 'managers' ? FIELD_LIMITS.managerNameMax : FIELD_LIMITS.clientNameMax;
  const trimmed = name.trim().slice(0, maxLen);
  if (!trimmed) {
    throw new Error('Option name cannot be empty.');
  }

  try {
    const docRef = await addDoc(collection(db, collectionName), {
      name: trimmed,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collectionName);
  }
}

export async function updateDropdownOption(
  collectionName: 'managers' | 'clients',
  optionId: string,
  updates: { name?: string; isActive?: boolean }
): Promise<void> {
  const maxLen =
    collectionName === 'managers' ? FIELD_LIMITS.managerNameMax : FIELD_LIMITS.clientNameMax;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (updates.name !== undefined) {
    const trimmed = updates.name.trim().slice(0, maxLen);
    if (!trimmed) throw new Error('Option name cannot be empty.');
    payload.name = trimmed;
  }
  if (updates.isActive !== undefined) {
    payload.isActive = updates.isActive;
  }

  const path = `${collectionName}/${optionId}`;
  try {
    await updateDoc(doc(db, collectionName, optionId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDropdownOption(
  collectionName: 'managers' | 'clients',
  optionId: string
): Promise<void> {
  const path = `${collectionName}/${optionId}`;
  try {
    await deleteDoc(doc(db, collectionName, optionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedDefaultDropdownOptions(
  collectionName: 'managers' | 'clients',
  names: readonly string[]
): Promise<void> {
  for (const name of names) {
    await addDropdownOption(collectionName, name);
  }
}
