import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  FolderOpen,
  Link as LinkIcon,
  Lock,
  Trash2,
  Upload,
} from 'lucide-react';
import { PURPOSE_OPTIONS } from '../data/constants';
import {
  DriveAuthRequiredError,
  RESUME_DRIVE_FOLDER_URL,
} from '../services/driveService';
import {
  CandidateFormValues,
  CandidateRecord,
  CandidateValidationErrors,
  DropdownOption,
  UserProfile,
  UserRole,
} from '../types/recruitment';
import {
  FIELD_LIMITS,
  findDuplicateMobileRecords,
  getTodayIsoDate,
  sanitizeCandidateNameInput,
  sanitizeMobileInput,
  validateCandidateForm,
  validateResumeFile,
} from '../utils/validation';

interface CandidateFormProps {
  currentUser: UserProfile;
  existingRecords: CandidateRecord[];
  managerOptions: DropdownOption[];
  clientOptions: DropdownOption[];
  allUsers?: UserProfile[];
  editingRecord?: CandidateRecord | null;
  isDriveConnected?: boolean;
  onConnectGoogleDrive?: () => Promise<void>;
  onSubmit: (values: CandidateFormValues) => Promise<void>;
  onUploadResume: (
    ownerUid: string,
    file: File,
    onProgress: (pct: number) => void,
    candidateName?: string
  ) => Promise<{ downloadUrl: string; fileName: string; storagePath: string }>;
  onCancel?: () => void;
  onManageDropdowns?: () => void;
}

export function CandidateForm({
  currentUser,
  existingRecords,
  managerOptions,
  clientOptions,
  allUsers = [],
  editingRecord = null,
  isDriveConnected = true,
  onConnectGoogleDrive,
  onSubmit,
  onUploadResume,
  onCancel,
  onManageDropdowns,
}: CandidateFormProps) {
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isEditing = Boolean(editingRecord);

  const initialPurpose = editingRecord?.purpose || PURPOSE_OPTIONS[0];

  const [values, setValues] = useState<CandidateFormValues>(() => ({
    submissionDate: editingRecord?.submissionDate || getTodayIsoDate(),
    managerName: editingRecord?.managerName || '',
    recruiterName: editingRecord?.recruiterName || currentUser.name,
    clientName: editingRecord?.clientName || '',
    purpose: initialPurpose,
    candidateName: editingRecord?.candidateName || '',
    candidateMobile: editingRecord?.candidateMobile || '',
    city: editingRecord?.city || '',
    resumeUrl: editingRecord?.resumeUrl || '',
    resumeFileName: editingRecord?.resumeFileName || '',
    resumeStoragePath: editingRecord?.resumeStoragePath || '',
    assignedRecruiterUid: editingRecord?.recruiter_uid || currentUser.uid,
    assignedRecruiterEmail: editingRecord?.recruiter_email || currentUser.email,
  }));

  const [resumeInputMode, setResumeInputMode] = useState<'upload' | 'url'>(
    editingRecord?.resumeUrl && !editingRecord?.resumeStoragePath ? 'url' : 'upload'
  );
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [nameBlockedHint, setNameBlockedHint] = useState(false);
  const [errors, setErrors] = useState<CandidateValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Resume upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Admin-managed Manager dropdown items (preserve current value if editing a legacy entry)
  const managerDropdownNames = useMemo(() => {
    const names = managerOptions.filter((m) => m.isActive).map((m) => m.name);
    if (values.managerName && !names.includes(values.managerName)) {
      return [values.managerName, ...names];
    }
    return names;
  }, [managerOptions, values.managerName]);

  // Active Admin-managed Client dropdown items (preserve current value if editing a legacy entry)
  const clientDropdownNames = useMemo(() => {
    const names = clientOptions.filter((c) => c.isActive).map((c) => c.name);
    if (values.clientName && !names.includes(values.clientName)) {
      return [values.clientName, ...names];
    }
    return names;
  }, [clientOptions, values.clientName]);

  const duplicateMatches = useMemo(
    () => findDuplicateMobileRecords(existingRecords, values.candidateMobile, editingRecord?.id),
    [existingRecords, values.candidateMobile, editingRecord?.id]
  );

  const updateField = <K extends keyof CandidateFormValues>(
    field: K,
    val: CandidateFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [field]: val }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const handleCandidateNameChange = (raw: string) => {
    const hadDisallowedChars = /[^A-Za-z ]/.test(raw);
    setNameBlockedHint(hadDisallowedChars);
    const cleaned = sanitizeCandidateNameInput(raw);
    updateField('candidateName', cleaned);
  };

  const handleMobileChange = (raw: string) => {
    const cleaned = sanitizeMobileInput(raw);
    updateField('candidateMobile', cleaned);
  };

  const handleAdminRecruiterPick = (uid: string) => {
    const found = allUsers.find((u) => u.uid === uid);
    if (found) {
      setValues((prev) => ({
        ...prev,
        recruiterName: found.name,
        assignedRecruiterUid: found.uid,
        assignedRecruiterEmail: found.email,
      }));
    }
  };

  // Strictly the 4 requested Purpose options (preserve existing value only when editing an older legacy record)
  const purposeDropdownOptions = useMemo(() => {
    if (isEditing && values.purpose && !PURPOSE_OPTIONS.includes(values.purpose)) {
      return [values.purpose, ...PURPOSE_OPTIONS];
    }
    return [...PURPOSE_OPTIONS];
  }, [isEditing, values.purpose]);

  const handleConnectDriveClick = async () => {
    if (!onConnectGoogleDrive) return;
    setUploadError(null);
    setConnectingDrive(true);
    try {
      await onConnectGoogleDrive();
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Unable to connect Google Drive. Please try again.'
      );
    } finally {
      setConnectingDrive(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    const check = validateResumeFile(file);
    if (!check.valid) {
      setUploadError(check.error || 'Invalid file format.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    setUploadProgress(5);
    try {
      const targetUid =
        isAdmin && values.assignedRecruiterUid ? values.assignedRecruiterUid : currentUser.uid;
      const uploaded = await onUploadResume(
        targetUid,
        file,
        (pct) => setUploadProgress(pct),
        values.candidateName
      );
      setValues((prev) => ({
        ...prev,
        resumeUrl: uploaded.downloadUrl,
        resumeFileName: uploaded.fileName,
        resumeStoragePath: uploaded.storagePath,
      }));
      setErrors((prev) => ({ ...prev, resumeUrl: undefined }));
    } catch (err) {
      if (err instanceof DriveAuthRequiredError) {
        setUploadError(err.message);
      } else {
        setUploadError(err instanceof Error ? err.message : 'Upload failed.');
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const clearResume = () => {
    setValues((prev) => ({
      ...prev,
      resumeUrl: '',
      resumeFileName: '',
      resumeStoragePath: '',
    }));
    setUploadError(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    const effectiveValues: CandidateFormValues = {
      ...values,
      recruiterName: isAdmin ? values.recruiterName : currentUser.name,
    };

    const result = validateCandidateForm(effectiveValues);
    if (!result.isValid) {
      setErrors(result.errors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(result.sanitized);
      if (!isEditing) {
        setValues({
          submissionDate: getTodayIsoDate(),
          managerName: values.managerName,
          recruiterName: isAdmin ? values.recruiterName : currentUser.name,
          clientName: '',
          purpose: PURPOSE_OPTIONS[0],
          candidateName: '',
          candidateMobile: '',
          city: '',
          resumeUrl: '',
          resumeFileName: '',
          resumeStoragePath: '',
          assignedRecruiterUid: values.assignedRecruiterUid,
          assignedRecruiterEmail: values.assignedRecruiterEmail,
        });
        setNameBlockedHint(false);
        setSubmitSuccess('Candidate submission recorded successfully.');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save candidate record.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleFormSubmit} noValidate className="space-y-6">
      {submitError && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

      {submitSuccess && (
        <div
          role="status"
          className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-start gap-2.5"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{submitSuccess}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
        {/* Column 1: Date */}
        <div>
          <label
            htmlFor="field-date"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            1. Date <span className="text-red-600">*</span>
          </label>
          <input
            id="field-date"
            type="date"
            value={values.submissionDate}
            onChange={(e) => updateField('submissionDate', e.target.value)}
            className={`w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 ${
              errors.submissionDate
                ? 'border-red-500 focus:border-red-600'
                : 'border-slate-300 focus:border-red-600'
            }`}
          />
          {errors.submissionDate && (
            <p className="mt-1 text-xs text-red-700">{errors.submissionDate}</p>
          )}
        </div>

        {/* Column 2: Manager Name (Admin-Managed Dropdown) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="field-manager" className="text-xs font-semibold text-slate-700">
              2. Manager Name <span className="text-red-600">*</span>
            </label>
            {isAdmin && onManageDropdowns && (
              <button
                type="button"
                onClick={onManageDropdowns}
                className="text-[11px] font-semibold text-red-700 hover:text-red-900 hover:underline"
              >
                Manage list
              </button>
            )}
          </div>
          <select
            id="field-manager"
            value={values.managerName}
            onChange={(e) => updateField('managerName', e.target.value)}
            className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 ${
              errors.managerName
                ? 'border-red-500 focus:border-red-600'
                : 'border-slate-300 focus:border-red-600'
            }`}
          >
            <option value="">
              {managerDropdownNames.length === 0
                ? 'No managers configured yet'
                : 'Select Manager Name'}
            </option>
            {managerDropdownNames.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {errors.managerName && (
            <p className="mt-1 text-xs text-red-700">{errors.managerName}</p>
          )}
        </div>

        {/* Column 3: Recruiter Name (Locked for recruiters, editable for admin) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="field-recruiter" className="text-xs font-semibold text-slate-700">
              3. Recruiter Name <span className="text-red-600">*</span>
            </label>
            {!isAdmin && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                <Lock className="w-3 h-3" />
                Profile locked
              </span>
            )}
          </div>
          {isAdmin && allUsers.length > 0 && !isEditing ? (
            <div className="space-y-1.5">
              <input
                id="field-recruiter"
                type="text"
                maxLength={FIELD_LIMITS.recruiterNameMax}
                value={values.recruiterName}
                onChange={(e) => updateField('recruiterName', e.target.value)}
                placeholder="Recruiter name"
                className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 ${
                  errors.recruiterName
                    ? 'border-red-500 focus:border-red-600'
                    : 'border-slate-300 focus:border-red-600'
                }`}
              />
              <select
                aria-label="Quick-assign recruiter profile"
                value={values.assignedRecruiterUid || ''}
                onChange={(e) => handleAdminRecruiterPick(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-600 focus:outline-none focus:border-red-600"
              >
                {allUsers
                  .filter((u) => u.isActive)
                  .map((u) => (
                    <option key={u.uid} value={u.uid}>
                      Assign to account: {u.name} ({u.email})
                    </option>
                  ))}
              </select>
            </div>
          ) : (
            <input
              id="field-recruiter"
              type="text"
              maxLength={FIELD_LIMITS.recruiterNameMax}
              value={isAdmin ? values.recruiterName : currentUser.name}
              readOnly={!isAdmin}
              aria-readonly={!isAdmin}
              onChange={(e) => isAdmin && updateField('recruiterName', e.target.value)}
              className={`w-full px-3.5 py-2.5 text-sm border rounded-lg focus:outline-none ${
                !isAdmin
                  ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                  : errors.recruiterName
                    ? 'bg-white border-red-500 text-slate-900 focus:ring-2 focus:ring-red-600/20'
                    : 'bg-white border-slate-300 text-slate-900 focus:ring-2 focus:ring-red-600/20 focus:border-red-600'
              }`}
            />
          )}
          {errors.recruiterName && (
            <p className="mt-1 text-xs text-red-700">{errors.recruiterName}</p>
          )}
        </div>

        {/* Column 4: Client Name (Admin-Managed Dropdown) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="field-client" className="text-xs font-semibold text-slate-700">
              4. Client Name <span className="text-red-600">*</span>
            </label>
            {isAdmin && onManageDropdowns && (
              <button
                type="button"
                onClick={onManageDropdowns}
                className="text-[11px] font-semibold text-red-700 hover:text-red-900 hover:underline"
              >
                Manage list
              </button>
            )}
          </div>
          <select
            id="field-client"
            value={values.clientName}
            onChange={(e) => updateField('clientName', e.target.value)}
            className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 ${
              errors.clientName
                ? 'border-red-500 focus:border-red-600'
                : 'border-slate-300 focus:border-red-600'
            }`}
          >
            <option value="">
              {clientDropdownNames.length === 0
                ? 'No clients configured yet'
                : 'Select Client Name'}
            </option>
            {clientDropdownNames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {errors.clientName && (
            <p className="mt-1 text-xs text-red-700">{errors.clientName}</p>
          )}
        </div>

        {/* Column 5: Purpose (Strict 4 options: Lineup, Selection, Joining, Database) */}
        <div>
          <label
            htmlFor="field-purpose"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            5. Purpose <span className="text-red-600">*</span>
          </label>
          <select
            id="field-purpose"
            value={values.purpose}
            onChange={(e) => updateField('purpose', e.target.value)}
            className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 ${
              errors.purpose
                ? 'border-red-500 focus:border-red-600'
                : 'border-slate-300 focus:border-red-600'
            }`}
          >
            {purposeDropdownOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {errors.purpose && <p className="mt-1 text-xs text-red-700">{errors.purpose}</p>}
        </div>

        {/* Column 6: Candidate's Name (Letters & spaces only) */}
        <div>
          <label
            htmlFor="field-candidate-name"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            6. Candidate&apos;s Name <span className="text-red-600">*</span>
          </label>
          <input
            id="field-candidate-name"
            type="text"
            maxLength={FIELD_LIMITS.candidateNameMax}
            value={values.candidateName}
            onChange={(e) => handleCandidateNameChange(e.target.value)}
            placeholder="Letters and spaces only"
            className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600/20 ${
              errors.candidateName
                ? 'border-red-500 focus:border-red-600'
                : 'border-slate-300 focus:border-red-600'
            }`}
          />
          {errors.candidateName ? (
            <p className="mt-1 text-xs text-red-700">{errors.candidateName}</p>
          ) : nameBlockedHint ? (
            <p className="mt-1 text-xs text-amber-700">
              Numbers and special characters were blocked — letters and spaces only.
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-500">Letters and spaces only.</p>
          )}
        </div>

        {/* Column 7: Candidate's Mobile Number (10 digits + Duplicate Warning) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="field-mobile" className="text-xs font-semibold text-slate-700">
              7. Candidate&apos;s Mobile number <span className="text-red-600">*</span>
            </label>
            <span className="text-[11px] font-mono tabular-nums text-slate-500">
              {values.candidateMobile.length}/10
            </span>
          </div>
          <input
            id="field-mobile"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={values.candidateMobile}
            onChange={(e) => handleMobileChange(e.target.value)}
            placeholder="10-digit mobile number"
            className={`w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-red-600/20 ${
              errors.candidateMobile
                ? 'border-red-500 focus:border-red-600'
                : duplicateMatches.length > 0
                  ? 'border-amber-400 focus:border-amber-500'
                  : 'border-slate-300 focus:border-red-600'
            }`}
          />
          {errors.candidateMobile && (
            <p className="mt-1 text-xs text-red-700">{errors.candidateMobile}</p>
          )}
        </div>

        {/* Column 8: Store / Warehouse Location (Manual Text Input) */}
        <div>
          <label
            htmlFor="field-city"
            className="block text-xs font-semibold text-slate-700 mb-1.5 truncate"
            title="Name of the city where the store/Warehouse is located"
          >
            8. Store / Warehouse Location <span className="text-red-600">*</span>
          </label>
          <input
            id="field-city"
            type="text"
            autoComplete="off"
            maxLength={FIELD_LIMITS.cityMax}
            value={values.city}
            onChange={(e) => updateField('city', e.target.value)}
            placeholder="Enter store or warehouse location manually"
            className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600/20 ${
              errors.city
                ? 'border-red-500 focus:border-red-600'
                : 'border-slate-300 focus:border-red-600'
            }`}
          />
          {errors.city ? (
            <p className="mt-1 text-xs text-red-700">{errors.city}</p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-500">
              Type the city or store/warehouse location manually.
            </p>
          )}
        </div>

        {/* Column 9: Candidate's Resume (File Upload or URL Link) */}
        <div className="md:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="field-resume-url" className="text-xs font-semibold text-slate-700">
              9. Candidate&apos;s Resume (if available)
            </label>
            <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
              <button
                type="button"
                onClick={() => setResumeInputMode('upload')}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                  resumeInputMode === 'upload'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Upload
              </button>
              <button
                type="button"
                onClick={() => setResumeInputMode('url')}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                  resumeInputMode === 'url'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                URL Link
              </button>
            </div>
          </div>

          {resumeInputMode === 'upload' ? (
            <div className="space-y-1.5">
              {values.resumeUrl ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-red-700 shrink-0" />
                    <a
                      href={values.resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-red-700 hover:underline truncate"
                      title={values.resumeFileName || 'View Resume in Google Drive'}
                    >
                      {values.resumeFileName || 'Attached Resume'}
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={clearResume}
                    aria-label="Remove attached resume"
                    className="p-1 text-slate-500 hover:text-red-700 rounded shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : !isDriveConnected && onConnectGoogleDrive ? (
                <button
                  type="button"
                  onClick={handleConnectDriveClick}
                  disabled={connectingDrive}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold bg-white border border-slate-300 hover:border-red-500 hover:bg-red-50/40 text-slate-800 rounded-lg transition-colors disabled:opacity-60"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>
                    {connectingDrive ? 'Connecting Google Drive...' : 'Connect Google Drive to Upload'}
                  </span>
                </button>
              ) : (
                <label className="flex items-center justify-center gap-2 px-3.5 py-2.5 text-sm bg-white border border-dashed border-slate-300 hover:border-red-500 hover:bg-red-50/40 rounded-lg cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-xs font-medium text-slate-700 truncate">
                    {uploading
                      ? `Uploading to Google Drive (${uploadProgress}%)...`
                      : 'Upload PDF, DOC, or DOCX to Drive'}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    disabled={uploading}
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
              )}

              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1 truncate">
                  <FolderOpen className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>Saves to Google Drive folder</span>
                </span>
                <a
                  href={RESUME_DRIVE_FOLDER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-red-700 hover:text-red-900 hover:underline whitespace-nowrap shrink-0"
                >
                  <span>Open Folder</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {uploading && (
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-700 transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
              {uploadError && <p className="text-xs text-red-700">{uploadError}</p>}
            </div>
          ) : (
            <div>
              <div className="relative">
                <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="field-resume-url"
                  type="url"
                  maxLength={FIELD_LIMITS.resumeUrlMax}
                  value={values.resumeUrl}
                  onChange={(e) => {
                    updateField('resumeUrl', e.target.value);
                    updateField('resumeFileName', '');
                    updateField('resumeStoragePath', '');
                  }}
                  placeholder="https://drive.google.com/file/..."
                  className={`w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600/20 ${
                    errors.resumeUrl
                      ? 'border-red-500 focus:border-red-600'
                      : 'border-slate-300 focus:border-red-600'
                  }`}
                />
              </div>
              {errors.resumeUrl && (
                <p className="mt-1 text-xs text-red-700">{errors.resumeUrl}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Duplicate Mobile Number Warning */}
      {duplicateMatches.length > 0 && (
        <div
          role="alert"
          data-testid="duplicate-mobile-warning"
          className="p-4 rounded-lg bg-amber-50 border border-amber-300 text-amber-950"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                Duplicate Mobile Number Detected ({values.candidateMobile})
              </p>
              <p className="mt-1 text-xs text-amber-900 leading-relaxed">
                This mobile number already exists in{' '}
                {isAdmin ? 'the Master Database' : 'your submissions'}. Review the matching{' '}
                {duplicateMatches.length === 1 ? 'record' : 'records'} below before saving a new
                entry:
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-950">
                {duplicateMatches.slice(0, 3).map((match) => (
                  <li key={match.id} className="font-mono tabular-nums">
                    {match.submissionDate} ·{' '}
                    <span className="font-sans font-semibold">{match.candidateName}</span> ·{' '}
                    <span className="font-sans">
                      {match.clientName} ({match.city})
                    </span>
                    {isAdmin ? (
                      <span className="font-sans"> · Logged by {match.recruiterName}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || uploading}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {submitting
            ? isEditing
              ? 'Saving Changes...'
              : 'Submitting Record...'
            : isEditing
              ? 'Save Changes'
              : 'Submit Candidate Record'}
        </button>
      </div>
    </form>
  );
}
