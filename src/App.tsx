import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { AlertCircle } from 'lucide-react';
import {
  auth,
  clearDriveAccessToken,
  connectGoogleDriveAccess,
  getDriveAccessToken,
  subscribeToDriveTokenState,
  testFirestoreConnection,
} from './lib/firebase';
import {
  ActiveNavSection,
  CandidateFilters,
  CandidateFormValues,
  CandidateRecord,
  DropdownOption,
  UserProfile,
  UserRole,
} from './types/recruitment';
import {
  addDropdownOption,
  createCandidateRecord,
  deleteCandidateRecord,
  deleteDropdownOption,
  ensureUserProfile,
  seedDefaultDropdownOptions,
  subscribeToAllUsers,
  subscribeToCandidates,
  subscribeToDropdownOptions,
  subscribeToOwnUserProfile,
  updateCandidateRecord,
  updateDropdownOption,
  updateUserRoleOrStatus,
} from './services/recruitmentService';
import {
  buildDriveFileViewUrl,
  buildDriveResumeFileName,
  uploadResumeToGoogleDrive,
} from './services/driveService';
import {
  CLIENT_SUGGESTIONS,
  createDeterministicSeedData,
  MANAGER_SUGGESTIONS,
} from './data/constants';
import {
  computeAdminKpis,
  computeCityPerformance,
  computeRecruiterKpis,
  computeRecruiterPerformance,
  DEFAULT_FILTERS,
  filterCandidates,
} from './utils/analytics';
import { getTodayIsoDate } from './utils/validation';
import { downloadCandidatesCsv, downloadCandidatesExcel } from './utils/exportData';
import { AuthScreen } from './components/AuthScreen';
import { DeactivatedScreen } from './components/DeactivatedScreen';
import { AppShell } from './components/AppShell';
import { KpiStrip } from './components/KpiStrip';
import { FilterBar } from './components/FilterBar';
import { CandidateTable } from './components/CandidateTable';
import { CandidateForm } from './components/CandidateForm';
import { EditCandidateModal } from './components/EditCandidateModal';
import { PerformanceBreakdownView } from './components/PerformanceBreakdownView';
import { UserManagementView } from './components/UserManagementView';
import { DropdownManagementView } from './components/DropdownManagementView';

type AutostartMode = null | 'admin' | 'recruiter';

function detectAutostartMode(): AutostartMode {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const val = params.get('autostart');
  if (val === 'recruiter') return 'recruiter';
  if (val === '1' || val === 'admin') return 'admin';
  return null;
}

export default function App() {
  const autostartMode = useMemo(() => detectAutostartMode(), []);
  const todayIso = useMemo(() => getTodayIsoDate(), []);

  // Deterministic preview state (active ONLY when ?autostart=1|admin|recruiter is passed)
  const initialSeed = useMemo(
    () => (autostartMode ? createDeterministicSeedData(todayIso) : null),
    [autostartMode, todayIso]
  );

  const [authReady, setAuthReady] = useState(Boolean(autostartMode));
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    if (!initialSeed || !autostartMode) return null;
    return autostartMode === 'recruiter' ? initialSeed.users[1] : initialSeed.users[0];
  });
  const [allUsers, setAllUsers] = useState<UserProfile[]>(() => initialSeed?.users || []);
  const [candidates, setCandidates] = useState<CandidateRecord[]>(() => {
    if (!initialSeed || !autostartMode) return [];
    if (autostartMode === 'recruiter') {
      const recUid = initialSeed.users[1].uid;
      return initialSeed.candidates.filter((c) => c.recruiter_uid === recUid);
    }
    return initialSeed.candidates;
  });
  const [managerOptions, setManagerOptions] = useState<DropdownOption[]>(
    () => initialSeed?.managers || []
  );
  const [clientOptions, setClientOptions] = useState<DropdownOption[]>(
    () => initialSeed?.clients || []
  );

  const [loadingCandidates, setLoadingCandidates] = useState(!autostartMode);
  const [driveConnected, setDriveConnected] = useState<boolean>(
    () => Boolean(autostartMode) || Boolean(getDriveAccessToken())
  );
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveNavSection>('submissions');
  const [filters, setFilters] = useState<CandidateFilters>({ ...DEFAULT_FILTERS });
  const [editingRecord, setEditingRecord] = useState<CandidateRecord | null>(null);

  // Sync in-memory Google Drive OAuth token state
  useEffect(() => {
    if (autostartMode) {
      setDriveConnected(true);
      return;
    }
    return subscribeToDriveTokenState(setDriveConnected);
  }, [autostartMode]);

  // Boot Firestore connectivity check
  useEffect(() => {
    if (!autostartMode) {
      testFirestoreConnection();
    }
  }, [autostartMode]);

  // Firebase Auth listener
  useEffect(() => {
    if (autostartMode) return;
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!active) return;
      setRuntimeError(null);
      setFirebaseUser(fbUser);

      if (!fbUser) {
        setUserProfile(null);
        setCandidates([]);
        setAllUsers([]);
        setManagerOptions([]);
        setClientOptions([]);
        setAuthReady(true);
        setLoadingCandidates(false);
        return;
      }

      if (!fbUser.emailVerified) {
        setUserProfile(null);
        setAuthReady(true);
        setLoadingCandidates(false);
        return;
      }

      try {
        const profile = await ensureUserProfile(fbUser);
        if (!active) return;
        setUserProfile(profile);
        setAuthReady(true);
      } catch (err) {
        if (!active) return;
        setRuntimeError(err instanceof Error ? err.message : 'Unable to load user profile.');
        setAuthReady(true);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [autostartMode]);

  // Live subscription to own user profile
  useEffect(() => {
    if (autostartMode || !firebaseUser || !firebaseUser.emailVerified) return;

    const unsub = subscribeToOwnUserProfile(
      firebaseUser.uid,
      (profile) => {
        if (profile) {
          setUserProfile(profile);
        }
      },
      (err) => {
        setRuntimeError(err.message);
      }
    );

    return () => unsub();
  }, [autostartMode, firebaseUser]);

  // Live subscription to candidates (strictly isolated for recruiters; merged for admin)
  useEffect(() => {
    if (autostartMode) return;
    if (!userProfile || !userProfile.isActive) {
      setCandidates([]);
      setLoadingCandidates(false);
      return;
    }

    setLoadingCandidates(true);
    const unsub = subscribeToCandidates(
      userProfile,
      (records) => {
        setCandidates(records);
        setLoadingCandidates(false);
      },
      (err) => {
        setRuntimeError(err.message);
        setLoadingCandidates(false);
      }
    );

    return () => unsub();
  }, [autostartMode, userProfile?.uid, userProfile?.role, userProfile?.isActive]);

  // Live subscription to Admin-managed Manager Names & Client Names dropdowns
  useEffect(() => {
    if (autostartMode) return;
    if (!userProfile || !userProfile.isActive) {
      setManagerOptions([]);
      setClientOptions([]);
      return;
    }

    const isAdmin = userProfile.role === UserRole.ADMIN;
    const unsubManagers = subscribeToDropdownOptions(
      'managers',
      isAdmin,
      (items) => setManagerOptions(items),
      (err) => setRuntimeError(err.message)
    );
    const unsubClients = subscribeToDropdownOptions(
      'clients',
      isAdmin,
      (items) => setClientOptions(items),
      (err) => setRuntimeError(err.message)
    );

    return () => {
      unsubManagers();
      unsubClients();
    };
  }, [autostartMode, userProfile?.uid, userProfile?.role, userProfile?.isActive]);

  // Admin-only live subscription to all users directory
  useEffect(() => {
    if (autostartMode) return;
    if (!userProfile || userProfile.role !== UserRole.ADMIN || !userProfile.isActive) {
      setAllUsers([]);
      return;
    }

    const unsub = subscribeToAllUsers(
      (users) => setAllUsers(users),
      (err) => setRuntimeError(err.message)
    );

    return () => unsub();
  }, [autostartMode, userProfile?.uid, userProfile?.role, userProfile?.isActive]);

  // Reset admin-only nav if demoted to recruiter
  useEffect(() => {
    if (
      userProfile &&
      userProfile.role !== UserRole.ADMIN &&
      (activeSection === 'performance' ||
        activeSection === 'users' ||
        activeSection === 'dropdowns')
    ) {
      setActiveSection('submissions');
    }
  }, [userProfile?.role, activeSection]);

  const handleVerificationRefresh = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    const refreshed = auth.currentUser;
    if (refreshed.emailVerified) {
      setFirebaseUser(refreshed);
      const profile = await ensureUserProfile(refreshed);
      setUserProfile(profile);
    }
  };

  const handleSignOut = async () => {
    clearDriveAccessToken();
    if (autostartMode) {
      window.location.href = window.location.pathname;
      return;
    }
    await signOut(auth);
  };

  const handleCreateCandidate = async (values: CandidateFormValues) => {
    if (!userProfile) return;

    if (autostartMode) {
      const isAdmin = userProfile.role === UserRole.ADMIN;
      const now = Date.now();
      const newRecord: CandidateRecord = {
        id: `cand-${now}`,
        submissionDate: values.submissionDate,
        managerName: values.managerName,
        recruiterName: isAdmin ? values.recruiterName : userProfile.name,
        clientName: values.clientName,
        purpose: values.purpose,
        candidateName: values.candidateName,
        candidateMobile: values.candidateMobile,
        city: values.city,
        resumeUrl: values.resumeUrl,
        resumeFileName: values.resumeFileName,
        resumeStoragePath: values.resumeStoragePath,
        recruiter_uid:
          isAdmin && values.assignedRecruiterUid ? values.assignedRecruiterUid : userProfile.uid,
        recruiter_email:
          isAdmin && values.assignedRecruiterEmail
            ? values.assignedRecruiterEmail
            : userProfile.email,
        createdAtMs: now,
        updatedAtMs: now,
      };
      setCandidates((prev) => [newRecord, ...prev]);
      return;
    }

    await createCandidateRecord(userProfile, values);
  };

  const handleEditCandidate = async (values: CandidateFormValues) => {
    if (!userProfile || !editingRecord) return;

    if (autostartMode) {
      const isAdmin = userProfile.role === UserRole.ADMIN;
      setCandidates((prev) =>
        prev.map((rec) =>
          rec.id === editingRecord.id
            ? {
                ...rec,
                submissionDate: values.submissionDate,
                managerName: values.managerName,
                recruiterName: isAdmin ? values.recruiterName : rec.recruiterName,
                clientName: values.clientName,
                purpose: values.purpose,
                candidateName: values.candidateName,
                candidateMobile: values.candidateMobile,
                city: values.city,
                resumeUrl: values.resumeUrl,
                resumeFileName: values.resumeFileName,
                resumeStoragePath: values.resumeStoragePath,
                updatedAtMs: Date.now(),
              }
            : rec
        )
      );
      setEditingRecord(null);
      return;
    }

    await updateCandidateRecord(userProfile, editingRecord, values);
    setEditingRecord(null);
  };

  const handleDeleteCandidate = async (record: CandidateRecord) => {
    if (autostartMode) {
      setCandidates((prev) => prev.filter((r) => r.id !== record.id));
      return;
    }
    await deleteCandidateRecord(record.id);
  };

  const handleUpdateUser = async (
    targetUid: string,
    updates: { role?: UserRole; isActive?: boolean }
  ) => {
    if (autostartMode) {
      setAllUsers((prev) =>
        prev.map((u) =>
          u.uid === targetUid
            ? {
                ...u,
                role: updates.role ?? u.role,
                isActive: updates.isActive ?? u.isActive,
                updatedAtMs: Date.now(),
              }
            : u
        )
      );
      return;
    }
    await updateUserRoleOrStatus(targetUid, updates);
  };

  const handleAddDropdownOption = async (
    collectionName: 'managers' | 'clients',
    name: string
  ) => {
    if (autostartMode) {
      const now = Date.now();
      const newOpt: DropdownOption = {
        id: `${collectionName}-${now}`,
        name: name.trim(),
        isActive: true,
        createdAtMs: now,
        updatedAtMs: now,
      };
      if (collectionName === 'managers') {
        setManagerOptions((prev) => [...prev, newOpt].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        setClientOptions((prev) => [...prev, newOpt].sort((a, b) => a.name.localeCompare(b.name)));
      }
      return;
    }
    await addDropdownOption(collectionName, name);
  };

  const handleUpdateDropdownOption = async (
    collectionName: 'managers' | 'clients',
    optionId: string,
    updates: { name?: string; isActive?: boolean }
  ) => {
    if (autostartMode) {
      const updater = (prev: DropdownOption[]) =>
        prev
          .map((opt) =>
            opt.id === optionId
              ? {
                  ...opt,
                  name: updates.name !== undefined ? updates.name.trim() : opt.name,
                  isActive: updates.isActive !== undefined ? updates.isActive : opt.isActive,
                  updatedAtMs: Date.now(),
                }
              : opt
          )
          .sort((a, b) => a.name.localeCompare(b.name));

      if (collectionName === 'managers') {
        setManagerOptions(updater);
      } else {
        setClientOptions(updater);
      }
      return;
    }
    await updateDropdownOption(collectionName, optionId, updates);
  };

  const handleDeleteDropdownOption = async (
    collectionName: 'managers' | 'clients',
    optionId: string
  ) => {
    if (autostartMode) {
      if (collectionName === 'managers') {
        setManagerOptions((prev) => prev.filter((o) => o.id !== optionId));
      } else {
        setClientOptions((prev) => prev.filter((o) => o.id !== optionId));
      }
      return;
    }
    await deleteDropdownOption(collectionName, optionId);
  };

  const handleSeedDefaultDropdowns = async (collectionName: 'managers' | 'clients') => {
    const defaults = collectionName === 'managers' ? MANAGER_SUGGESTIONS : CLIENT_SUGGESTIONS;
    if (autostartMode) {
      const now = Date.now();
      const seeded: DropdownOption[] = defaults.map((name, idx) => ({
        id: `${collectionName}-def-${now}-${idx}`,
        name,
        isActive: true,
        createdAtMs: now,
        updatedAtMs: now,
      }));
      if (collectionName === 'managers') {
        setManagerOptions(seeded);
      } else {
        setClientOptions(seeded);
      }
      return;
    }
    await seedDefaultDropdownOptions(collectionName, defaults);
  };

  const handleConnectGoogleDrive = async () => {
    if (autostartMode) {
      setDriveConnected(true);
      return;
    }
    await connectGoogleDriveAccess();
  };

  const handleUploadResume = async (
    _ownerUid: string,
    file: File,
    onProgress: (pct: number) => void,
    candidateName?: string
  ) => {
    if (autostartMode) {
      onProgress(100);
      const previewId = `preview-${Date.now()}`;
      return {
        downloadUrl: buildDriveFileViewUrl(previewId),
        fileName: buildDriveResumeFileName(file.name, candidateName),
        storagePath: `gdrive:${previewId}`,
      };
    }

    const token = getDriveAccessToken();
    return uploadResumeToGoogleDrive(
      file,
      {
        accessToken: token,
        candidateName,
        onTokenInvalid: clearDriveAccessToken,
      },
      onProgress
    );
  };

  // Computed views
  const filteredCandidates = useMemo(() => {
    if (!userProfile) return [];
    return filterCandidates(candidates, filters, userProfile);
  }, [candidates, filters, userProfile]);

  const recruiterKpis = useMemo(
    () => computeRecruiterKpis(candidates, todayIso),
    [candidates, todayIso]
  );

  const adminKpis = useMemo(
    () => computeAdminKpis(candidates, todayIso),
    [candidates, todayIso]
  );

  const recruiterPerformance = useMemo(
    () => computeRecruiterPerformance(candidates, todayIso),
    [candidates, todayIso]
  );

  const cityPerformance = useMemo(
    () => computeCityPerformance(candidates),
    [candidates]
  );

  const candidateCountByUid = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of candidates) {
      counts[c.recruiter_uid] = (counts[c.recruiter_uid] || 0) + 1;
    }
    return counts;
  }, [candidates]);

  const handleExportCsv = (scope: 'filtered' | 'all') => {
    const isAdmin = userProfile?.role === UserRole.ADMIN;
    const target = scope === 'all' && isAdmin ? candidates : filteredCandidates;
    const prefix = isAdmin
      ? scope === 'all'
        ? 'VertoBizserv_Master_Full'
        : 'VertoBizserv_Master_Filtered'
      : 'VertoBizserv_My_Submissions';
    downloadCandidatesCsv(target, prefix, Boolean(isAdmin));
  };

  const handleExportExcel = (scope: 'filtered' | 'all') => {
    const isAdmin = userProfile?.role === UserRole.ADMIN;
    const target = scope === 'all' && isAdmin ? candidates : filteredCandidates;
    const prefix = isAdmin
      ? scope === 'all'
        ? 'VertoBizserv_Master_Full'
        : 'VertoBizserv_Master_Filtered'
      : 'VertoBizserv_My_Submissions';
    downloadCandidatesExcel(target, prefix, Boolean(isAdmin));
  };

  // Loading auth gate
  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-9 h-9 rounded-lg bg-red-700 text-white font-bold text-base flex items-center justify-center mx-auto">
            V
          </div>
          <p className="mt-3 text-sm font-medium text-slate-600">
            Loading Verto Bizserv workspace...
          </p>
        </div>
      </div>
    );
  }

  // Unauthenticated or unverified email gate
  if (!userProfile) {
    return (
      <AuthScreen
        pendingVerificationUser={firebaseUser && !firebaseUser.emailVerified ? firebaseUser : null}
        onVerificationRefresh={handleVerificationRefresh}
      />
    );
  }

  // Deactivated user gate
  if (!userProfile.isActive) {
    return <DeactivatedScreen profile={userProfile} onSignOut={handleSignOut} />;
  }

  const isAdmin = userProfile.role === UserRole.ADMIN;

  return (
    <AppShell
      profile={userProfile}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      onOpenNewSubmission={() => setActiveSection('new-entry')}
      onSignOut={handleSignOut}
    >
      {runtimeError && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-start justify-between gap-4"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words">{runtimeError}</span>
          </div>
          <button
            type="button"
            onClick={() => setRuntimeError(null)}
            className="text-xs font-semibold text-red-900 hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Section 1: Submissions (Recruiter "My Submissions" or Admin "Master Merged Database") */}
      {activeSection === 'submissions' && (
        <div className="space-y-6">
          <KpiStrip
            role={userProfile.role}
            recruiterKpis={recruiterKpis}
            adminKpis={adminKpis}
            loading={loadingCandidates}
          />

          <FilterBar
            role={userProfile.role}
            filters={filters}
            onChangeFilters={setFilters}
            allRecords={candidates}
            filteredRecords={filteredCandidates}
            onExportCsv={handleExportCsv}
            onExportExcel={handleExportExcel}
          />

          <CandidateTable
            role={userProfile.role}
            records={filteredCandidates}
            totalUnfilteredCount={candidates.length}
            loading={loadingCandidates}
            onEdit={(record) => setEditingRecord(record)}
            onDelete={handleDeleteCandidate}
            onCreateFirst={() => setActiveSection('new-entry')}
          />
        </div>
      )}

      {/* Section 2: Exact 9-Column Validated Data Entry Form */}
      {activeSection === 'new-entry' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div className="pb-5 mb-6 border-b border-slate-200 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Candidate Submission Form (9-Column Standard)
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {isAdmin
                  ? 'Submissions are stored directly in the Master Merged Database with full recruiter attribution.'
                  : 'Your recruiter profile and UID are automatically attached and enforced by database security rules.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('submissions')}
              className="text-xs font-semibold text-red-700 hover:text-red-900 hover:underline whitespace-nowrap"
            >
              View {isAdmin ? 'Master Database' : 'My Submissions'}
            </button>
          </div>

          <CandidateForm
            currentUser={userProfile}
            existingRecords={candidates}
            managerOptions={managerOptions}
            clientOptions={clientOptions}
            allUsers={allUsers}
            isDriveConnected={driveConnected}
            onConnectGoogleDrive={handleConnectGoogleDrive}
            onSubmit={handleCreateCandidate}
            onUploadResume={handleUploadResume}
            onCancel={() => setActiveSection('submissions')}
            onManageDropdowns={isAdmin ? () => setActiveSection('dropdowns') : undefined}
          />
        </div>
      )}

      {/* Section 3: Admin Managers & Clients Dropdown Management */}
      {activeSection === 'dropdowns' && isAdmin && (
        <DropdownManagementView
          managers={managerOptions}
          clients={clientOptions}
          onAddOption={handleAddDropdownOption}
          onUpdateOption={handleUpdateDropdownOption}
          onDeleteOption={handleDeleteDropdownOption}
          onSeedDefaults={handleSeedDefaultDropdowns}
        />
      )}

      {/* Section 4: Admin Performance Breakdown */}
      {activeSection === 'performance' && isAdmin && (
        <div className="space-y-6">
          <KpiStrip
            role={userProfile.role}
            recruiterKpis={recruiterKpis}
            adminKpis={adminKpis}
            loading={loadingCandidates}
          />
          <PerformanceBreakdownView
            recruiterRows={recruiterPerformance}
            cityRows={cityPerformance}
            totalRecords={candidates.length}
            onFilterByRecruiter={(uid) => {
              setFilters({ ...DEFAULT_FILTERS, recruiterUid: uid });
              setActiveSection('submissions');
            }}
            onFilterByCity={(city) => {
              setFilters({ ...DEFAULT_FILTERS, city });
              setActiveSection('submissions');
            }}
          />
        </div>
      )}

      {/* Section 5: Admin User Management */}
      {activeSection === 'users' && isAdmin && (
        <UserManagementView
          currentUser={userProfile}
          users={allUsers}
          candidateCountByUid={candidateCountByUid}
          onUpdateUser={handleUpdateUser}
        />
      )}

      {/* Edit Modal */}
      {editingRecord && (
        <EditCandidateModal
          currentUser={userProfile}
          record={editingRecord}
          existingRecords={candidates}
          managerOptions={managerOptions}
          clientOptions={clientOptions}
          allUsers={allUsers}
          isDriveConnected={driveConnected}
          onConnectGoogleDrive={handleConnectGoogleDrive}
          onSubmit={handleEditCandidate}
          onUploadResume={handleUploadResume}
          onClose={() => setEditingRecord(null)}
        />
      )}
    </AppShell>
  );
}
