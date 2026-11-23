import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
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
  clearStoredSession,
  gasAddDropdown,
  gasCreateCandidate,
  gasDeleteCandidate,
  gasDeleteDropdown,
  gasGetCandidates,
  gasGetDropdowns,
  gasGetUsers,
  gasLogin,
  gasRegister,
  gasUpdateCandidate,
  gasUpdateDropdown,
  gasUpdateUser,
  gasUploadResume,
  gasVerifySession,
  getGasApiUrl,
  getStoredUser,
} from './services/gasService';
import { buildDriveFileViewUrl, buildDriveResumeFileName } from './services/driveService';
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
  // Demo mode is disabled so the app always operates in real live mode with Google Sheets & Drive
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    if (initialSeed && autostartMode) {
      return autostartMode === 'recruiter' ? initialSeed.users[1] : initialSeed.users[0];
    }
    return getStoredUser();
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
  // Drive is natively connected via Google Apps Script backend
  const [driveConnected, setDriveConnected] = useState<boolean>(true);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveNavSection>('submissions');
  const [filters, setFilters] = useState<CandidateFilters>({ ...DEFAULT_FILTERS });
  const [editingRecord, setEditingRecord] = useState<CandidateRecord | null>(null);

  // Fetch all data from Google Apps Script
  const refreshData = useCallback(async (currentProfile: UserProfile | null) => {
    if (!currentProfile || !currentProfile.isActive) return;
    if (!getGasApiUrl()) return;

    setLoadingCandidates(true);
    try {
      const [candList, dropdowns] = await Promise.all([
        gasGetCandidates(),
        gasGetDropdowns(),
      ]);

      setCandidates(candList);
      setManagerOptions(dropdowns.managers);
      setClientOptions(dropdowns.clients);

      if (currentProfile.role === UserRole.ADMIN) {
        const usersList = await gasGetUsers();
        setAllUsers(usersList);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Only set error if not unauthenticated
      if (!msg.toLowerCase().includes('unauthorized')) {
        setRuntimeError(msg);
      }
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  // Check stored session on startup
  useEffect(() => {
    if (autostartMode) return;
    let active = true;

    async function checkSession() {
      try {
        const user = await gasVerifySession();
        if (!active) return;
        if (user) {
          setUserProfile(user);
          await refreshData(user);
        } else {
          setUserProfile(null);
        }
      } catch {
        if (active) setUserProfile(null);
      } finally {
        if (active) {
          setAuthReady(true);
          setLoadingCandidates(false);
        }
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, [autostartMode, refreshData]);

  // Periodic lightweight sync (every 30 seconds when tab is active)
  useEffect(() => {
    if (autostartMode || !userProfile || !userProfile.isActive) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshData(userProfile);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [autostartMode, userProfile, refreshData]);

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

  const handleLogin = async (email: string, pass: string) => {
    setRuntimeError(null);
    const { user } = await gasLogin(email, pass);
    setUserProfile(user);
    await refreshData(user);
  };

  const handleRegister = async (name: string, email: string, pass: string) => {
    setRuntimeError(null);
    const { user } = await gasRegister(name, email, pass);
    setUserProfile(user);
    await refreshData(user);
  };

  const handleSignOut = async () => {
    clearStoredSession();
    if (autostartMode) {
      window.location.href = window.location.pathname;
      return;
    }
    setUserProfile(null);
    setCandidates([]);
    setAllUsers([]);
    setManagerOptions([]);
    setClientOptions([]);
  };

  const handleCreateCandidate = async (values: CandidateFormValues) => {
    if (!userProfile) return;

    if (autostartMode || !getGasApiUrl()) {
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

    const created = await gasCreateCandidate(values);
    setCandidates((prev) => [created, ...prev]);
  };

  const handleEditCandidate = async (values: CandidateFormValues) => {
    if (!userProfile || !editingRecord) return;

    if (autostartMode || !getGasApiUrl()) {
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

    await gasUpdateCandidate(editingRecord.id, values);
    setEditingRecord(null);
    await refreshData(userProfile);
  };

  const handleDeleteCandidate = async (record: CandidateRecord) => {
    if (autostartMode || !getGasApiUrl()) {
      setCandidates((prev) => prev.filter((r) => r.id !== record.id));
      return;
    }
    await gasDeleteCandidate(record.id);
    setCandidates((prev) => prev.filter((r) => r.id !== record.id));
  };

  const handleUpdateUser = async (
    targetUid: string,
    updates: { role?: UserRole; isActive?: boolean }
  ) => {
    if (autostartMode || !getGasApiUrl()) {
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
    await gasUpdateUser(targetUid, updates);
    await refreshData(userProfile);
  };

  const handleAddDropdownOption = async (
    collectionName: 'managers' | 'clients',
    name: string
  ) => {
    const category = collectionName === 'managers' ? 'manager' : 'client';
    if (autostartMode || !getGasApiUrl()) {
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

    await gasAddDropdown(category, name);
    await refreshData(userProfile);
  };

  const handleUpdateDropdownOption = async (
    collectionName: 'managers' | 'clients',
    optionId: string,
    updates: { name?: string; isActive?: boolean }
  ) => {
    if (autostartMode || !getGasApiUrl()) {
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

    await gasUpdateDropdown(optionId, updates);
    await refreshData(userProfile);
  };

  const handleDeleteDropdownOption = async (
    collectionName: 'managers' | 'clients',
    optionId: string
  ) => {
    if (autostartMode || !getGasApiUrl()) {
      if (collectionName === 'managers') {
        setManagerOptions((prev) => prev.filter((o) => o.id !== optionId));
      } else {
        setClientOptions((prev) => prev.filter((o) => o.id !== optionId));
      }
      return;
    }

    await gasDeleteDropdown(optionId);
    await refreshData(userProfile);
  };

  const handleSeedDefaultDropdowns = async (collectionName: 'managers' | 'clients') => {
    const defaults = collectionName === 'managers' ? MANAGER_SUGGESTIONS : CLIENT_SUGGESTIONS;
    const category = collectionName === 'managers' ? 'manager' : 'client';
    if (autostartMode || !getGasApiUrl()) {
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

    for (const name of defaults) {
      await gasAddDropdown(category, name);
    }
    await refreshData(userProfile);
  };

  const handleConnectGoogleDrive = async () => {
    setDriveConnected(true);
  };

  const handleUploadResume = async (
    _ownerUid: string,
    file: File,
    onProgress: (pct: number) => void,
    candidateName?: string
  ) => {
    if (autostartMode || !getGasApiUrl()) {
      onProgress(100);
      const previewId = `preview-${Date.now()}`;
      return {
        downloadUrl: buildDriveFileViewUrl(previewId),
        fileName: buildDriveResumeFileName(file.name, candidateName),
        storagePath: `gdrive:${previewId}`,
      };
    }

    return gasUploadResume(file, candidateName, onProgress);
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

  // Unauthenticated gate
  if (!userProfile) {
    return (
      <AuthScreen
        onLogin={handleLogin}
        onRegister={handleRegister}
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
                  ? 'Submissions are stored securely in the Master Database with complete recruiter attribution.'
                  : 'Your recruiter profile is automatically verified and recorded in the database.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('submissions')}
              className="text-xs font-semibold text-red-700 hover:text-red-900 hover:underline whitespace-nowrap cursor-pointer"
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
