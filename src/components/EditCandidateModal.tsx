import React from 'react';
import { X } from 'lucide-react';
import {
  CandidateFormValues,
  CandidateRecord,
  DropdownOption,
  UserProfile,
} from '../types/recruitment';
import { CandidateForm } from './CandidateForm';

interface EditCandidateModalProps {
  currentUser: UserProfile;
  record: CandidateRecord;
  existingRecords: CandidateRecord[];
  managerOptions: DropdownOption[];
  clientOptions: DropdownOption[];
  allUsers: UserProfile[];
  isDriveConnected: boolean;
  onConnectGoogleDrive: () => Promise<void>;
  onSubmit: (values: CandidateFormValues) => Promise<void>;
  onUploadResume: (
    ownerUid: string,
    file: File,
    onProgress: (pct: number) => void,
    candidateName?: string
  ) => Promise<{ downloadUrl: string; fileName: string; storagePath: string }>;
  onClose: () => void;
}

export function EditCandidateModal({
  currentUser,
  record,
  existingRecords,
  managerOptions,
  clientOptions,
  allUsers,
  isDriveConnected,
  onConnectGoogleDrive,
  onSubmit,
  onUploadResume,
  onClose,
}: EditCandidateModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-candidate-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 overflow-y-auto"
    >
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-xl shadow-xl my-8 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id="edit-candidate-modal-title" className="text-base font-bold text-slate-900">
              Edit Candidate Record
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Updating submission for {record.candidateName} ({record.candidateMobile})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit modal"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto">
          <CandidateForm
            currentUser={currentUser}
            existingRecords={existingRecords}
            managerOptions={managerOptions}
            clientOptions={clientOptions}
            allUsers={allUsers}
            editingRecord={record}
            isDriveConnected={isDriveConnected}
            onConnectGoogleDrive={onConnectGoogleDrive}
            onSubmit={onSubmit}
            onUploadResume={onUploadResume}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
