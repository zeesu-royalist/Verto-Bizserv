import {
  CandidateFormValues,
  CandidateRecord,
  DropdownOption,
  UserProfile,
  UserRole,
} from '../types/recruitment';

const TOKEN_STORAGE_KEY = 'verto_auth_token';
const USER_STORAGE_KEY = 'verto_auth_user';
const GAS_URL_STORAGE_KEY = 'verto_gas_api_url';

export function getGasApiUrl(): string {
  // Check localStorage override first (allows runtime configuration from UI)
  if (typeof localStorage !== 'undefined') {
    const override = localStorage.getItem(GAS_URL_STORAGE_KEY);
    if (override && override.trim()) return override.trim();
  }
  // Then check Vite env or Node process.env safely
  const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_GAS_API_URL as string | undefined)?.trim()
      : typeof process !== 'undefined' && process.env
        ? process.env.VITE_GAS_API_URL?.trim()
        : '';
  return envUrl || '';
}

export function setGasApiUrl(url: string | null): void {
  if (typeof localStorage === 'undefined') return;
  if (url && url.trim()) {
    localStorage.setItem(GAS_URL_STORAGE_KEY, url.trim());
  } else {
    localStorage.removeItem(GAS_URL_STORAGE_KEY);
  }
}

export function getStoredToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredSession(token: string | null, user: UserProfile | null): void {
  if (typeof localStorage === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

export function getStoredUser(): UserProfile | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function clearStoredSession(): void {
  setStoredSession(null, null);
}

interface GasApiResponse<T = unknown> {
  status?: string;
  error?: string;
  records?: CandidateRecord[];
  user?: UserProfile;
  token?: string;
  record?: CandidateRecord;
  id?: string;
  managers?: DropdownOption[];
  clients?: DropdownOption[];
  option?: DropdownOption;
  users?: UserProfile[];
  downloadUrl?: string;
  fileName?: string;
  storagePath?: string;
  [key: string]: unknown;
}

export async function callGasApi<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
  requireAuth = true
): Promise<GasApiResponse<T>> {
  const apiUrl = getGasApiUrl();
  if (!apiUrl) {
    throw new Error(
      'Server connection is not configured. Please connect the backend API in Server Connection Settings.'
    );
  }

  const token = getStoredToken();
  if (requireAuth && !token) {
    throw new Error('You are not signed in. Please log in to continue.');
  }

  const bodyData = {
    action,
    payload,
    token: token || undefined,
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    // Google Apps Script requires redirect follow
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(bodyData),
  });

  if (!response.ok) {
    let msg = `Server returned error (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson.error) msg = errJson.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  const rawText = await response.text();
  let result: GasApiResponse<T>;
  try {
    result = JSON.parse(rawText) as GasApiResponse<T>;
  } catch {
    if (rawText.includes('<html') || rawText.includes('<!DOCTYPE') || rawText.includes('<!doctype')) {
      throw new Error(
        'Server returned an invalid HTML response instead of JSON. Please verify that your backend API is deployed with public access.'
      );
    }
    throw new Error(`Invalid response from server: ${rawText.slice(0, 120)}`);
  }

  if (result.error) {
    throw new Error(result.error);
  }

  return result;
}

// ----------------------------------------------------------------------------
// Auth Operations
// ----------------------------------------------------------------------------

export async function gasLogin(
  email: string,
  password: string
): Promise<{ user: UserProfile; token: string }> {
  const res = await callGasApi('login', { email, password }, false);
  if (!res.user || !res.token) {
    throw new Error(res.error || 'Login failed.');
  }
  const user: UserProfile = {
    uid: res.user.uid,
    name: res.user.name,
    email: res.user.email,
    role: res.user.role === 'admin' ? UserRole.ADMIN : UserRole.RECRUITER,
    isActive: res.user.isActive !== false,
    createdAtMs: res.user.createdAtMs || Date.now(),
    updatedAtMs: res.user.updatedAtMs || Date.now(),
  };
  setStoredSession(res.token, user);
  return { user, token: res.token };
}

export async function gasRegister(
  name: string,
  email: string,
  password: string
): Promise<{ user: UserProfile; token: string }> {
  const res = await callGasApi('register', { name, email, password }, false);
  if (!res.user || !res.token) {
    throw new Error(res.error || 'Registration failed.');
  }
  const user: UserProfile = {
    uid: res.user.uid,
    name: res.user.name,
    email: res.user.email,
    role: res.user.role === 'admin' ? UserRole.ADMIN : UserRole.RECRUITER,
    isActive: res.user.isActive !== false,
    createdAtMs: res.user.createdAtMs || Date.now(),
    updatedAtMs: res.user.updatedAtMs || Date.now(),
  };
  setStoredSession(res.token, user);
  return { user, token: res.token };
}

export async function gasVerifySession(): Promise<UserProfile | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await callGasApi('verifySession', {}, true);
    if (!res.user) return null;
    const user: UserProfile = {
      uid: res.user.uid,
      name: res.user.name,
      email: res.user.email,
      role: res.user.role === 'admin' ? UserRole.ADMIN : UserRole.RECRUITER,
      isActive: res.user.isActive !== false,
      createdAtMs: res.user.createdAtMs || Date.now(),
      updatedAtMs: res.user.updatedAtMs || Date.now(),
    };
    setStoredSession(token, user);
    return user;
  } catch {
    clearStoredSession();
    return null;
  }
}

// ----------------------------------------------------------------------------
// Candidate Data Operations (Google Sheets)
// ----------------------------------------------------------------------------

export async function gasGetCandidates(): Promise<CandidateRecord[]> {
  const res = await callGasApi('getCandidates');
  return (res.records || []).map((r) => ({
    ...r,
    id: String(r.id),
    submissionDate: String(r.submissionDate || ''),
    managerName: String(r.managerName || ''),
    recruiterName: String(r.recruiterName || ''),
    clientName: String(r.clientName || ''),
    purpose: String(r.purpose || ''),
    candidateName: String(r.candidateName || ''),
    candidateMobile: String(r.candidateMobile || ''),
    city: String(r.city || ''),
    resumeUrl: String(r.resumeUrl || ''),
    resumeFileName: String(r.resumeFileName || ''),
    resumeStoragePath: String(r.resumeStoragePath || ''),
    recruiter_uid: String(r.recruiter_uid || ''),
    recruiter_email: String(r.recruiter_email || ''),
    createdAtMs: Number(r.createdAtMs) || Date.now(),
    updatedAtMs: Number(r.updatedAtMs) || Date.now(),
  }));
}

export async function gasCreateCandidate(values: CandidateFormValues): Promise<CandidateRecord> {
  const res = await callGasApi('createCandidate', values as unknown as Record<string, unknown>);
  if (!res.record) {
    throw new Error('Failed to save candidate record in database.');
  }
  return res.record;
}

export async function gasUpdateCandidate(
  candidateId: string,
  updates: Partial<CandidateFormValues>
): Promise<void> {
  await callGasApi('updateCandidate', {
    id: candidateId,
    updates: updates as unknown as Record<string, unknown>,
  });
}

export async function gasDeleteCandidate(candidateId: string): Promise<void> {
  await callGasApi('deleteCandidate', { id: candidateId });
}

// ----------------------------------------------------------------------------
// Dropdown Operations (Google Sheets)
// ----------------------------------------------------------------------------

export async function gasGetDropdowns(): Promise<{
  managers: DropdownOption[];
  clients: DropdownOption[];
}> {
  const res = await callGasApi('getDropdowns');
  return {
    managers: (res.managers || []).map((m) => ({
      ...m,
      isActive: m.isActive !== false,
      createdAtMs: Number(m.createdAtMs) || Date.now(),
      updatedAtMs: Number(m.updatedAtMs) || Date.now(),
    })),
    clients: (res.clients || []).map((c) => ({
      ...c,
      isActive: c.isActive !== false,
      createdAtMs: Number(c.createdAtMs) || Date.now(),
      updatedAtMs: Number(c.updatedAtMs) || Date.now(),
    })),
  };
}

export async function gasAddDropdown(
  category: 'manager' | 'client',
  name: string
): Promise<DropdownOption> {
  const res = await callGasApi('addDropdown', { category, name });
  if (!res.option) throw new Error('Failed to add option in database.');
  return res.option;
}

export async function gasUpdateDropdown(
  id: string,
  updates: { name?: string; isActive?: boolean }
): Promise<void> {
  await callGasApi('updateDropdown', { id, ...updates });
}

export async function gasDeleteDropdown(id: string): Promise<void> {
  await callGasApi('deleteDropdown', { id });
}

// ----------------------------------------------------------------------------
// User Operations (Admin Only)
// ----------------------------------------------------------------------------

export async function gasGetUsers(): Promise<UserProfile[]> {
  const res = await callGasApi('getUsers');
  return (res.users || []).map((u) => ({
    uid: String(u.uid),
    name: String(u.name),
    email: String(u.email),
    role: u.role === 'admin' ? UserRole.ADMIN : UserRole.RECRUITER,
    isActive: u.isActive !== false,
    createdAtMs: Number(u.createdAtMs) || Date.now(),
    updatedAtMs: Number(u.updatedAtMs) || Date.now(),
  }));
}

export async function gasUpdateUser(
  targetUid: string,
  updates: { role?: UserRole; isActive?: boolean; name?: string }
): Promise<void> {
  await callGasApi('updateUser', { targetUid, ...updates });
}

// ----------------------------------------------------------------------------
// Resume Upload to Google Drive
// ----------------------------------------------------------------------------

export async function gasUploadResume(
  file: File,
  candidateName?: string,
  onProgress?: (percent: number) => void
): Promise<{ downloadUrl: string; fileName: string; storagePath: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onprogress = (evt) => {
      if (onProgress && evt.lengthComputable && evt.total > 0) {
        onProgress(Math.round((evt.loaded / evt.total) * 40)); // 0-40% reading
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read resume file from your computer.'));
    };

    reader.onload = async () => {
      try {
        if (onProgress) onProgress(50);
        const dataUrl = reader.result as string;
        // Strip data:application/pdf;base64, prefix
        const base64Index = dataUrl.indexOf('base64,');
        const fileBase64 = base64Index !== -1 ? dataUrl.slice(base64Index + 7) : dataUrl;

        if (onProgress) onProgress(70);
        const res = await callGasApi('uploadResume', {
          fileBase64,
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          candidateName: candidateName || '',
        });

        if (onProgress) onProgress(100);

        if (!res.downloadUrl || !res.storagePath) {
          throw new Error('Cloud storage did not return a valid document link.');
        }

        resolve({
          downloadUrl: res.downloadUrl,
          fileName: res.fileName || file.name,
          storagePath: res.storagePath,
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };

    reader.readAsDataURL(file);
  });
}
