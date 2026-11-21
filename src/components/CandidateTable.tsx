import React, { useState } from 'react';
import { ExternalLink, FilePlus2, Pencil, Trash2 } from 'lucide-react';
import { CandidateRecord, UserRole } from '../types/recruitment';
import { formatSystemTimestamp } from '../utils/analytics';
import { isSafeHttpUrl } from '../utils/validation';

interface CandidateTableProps {
  role: UserRole;
  records: CandidateRecord[];
  totalUnfilteredCount: number;
  loading: boolean;
  onEdit: (record: CandidateRecord) => void;
  onDelete: (record: CandidateRecord) => Promise<void>;
  onCreateFirst: () => void;
}

export function CandidateTable({
  role,
  records,
  totalUnfilteredCount,
  loading,
  onEdit,
  onDelete,
  onCreateFirst,
}: CandidateTableProps) {
  const isAdmin = role === UserRole.ADMIN;
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState<CandidateRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!confirmDeleteRecord) return;
    setDeleting(true);
    try {
      await onDelete(confirmDeleteRecord);
      setConfirmDeleteRecord(null);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-6 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
        <div className="w-11 h-11 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <FilePlus2 className="w-5 h-5" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-900">
          {totalUnfilteredCount === 0
            ? isAdmin
              ? 'No candidate records in the Master Database yet'
              : 'You have not logged any candidate submissions yet'
            : 'No records match your active filters'}
        </h2>
        <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
          {totalUnfilteredCount === 0
            ? 'Use the 9-column Data Entry Form to log your first store or warehouse candidate.'
            : 'Try clearing or widening your search query, date range, or dropdown filters.'}
        </p>
        {totalUnfilteredCount === 0 && (
          <button
            type="button"
            onClick={onCreateFirst}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors"
          >
            Log First Submission
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1020px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                <th scope="col" className="px-3 py-3 whitespace-nowrap">
                  Date
                </th>
                <th scope="col" className="px-2.5 py-3 whitespace-nowrap">
                  Manager Name
                </th>
                <th scope="col" className="px-2.5 py-3 whitespace-nowrap">
                  Recruiter Name
                </th>
                <th scope="col" className="px-2.5 py-3 whitespace-nowrap">
                  Client Name
                </th>
                <th scope="col" className="px-2.5 py-3 whitespace-nowrap">
                  Purpose
                </th>
                <th scope="col" className="px-2.5 py-3 whitespace-nowrap">
                  Candidate&apos;s Name
                </th>
                <th scope="col" className="px-2.5 py-3 whitespace-nowrap">
                  Mobile Number
                </th>
                <th
                  scope="col"
                  title="Name of the city where the store/Warehouse is located"
                  className="px-2.5 py-3 whitespace-nowrap"
                >
                  Store / Warehouse City
                </th>
                <th
                  scope="col"
                  title="Candidate's Resume (if available)"
                  className="px-2.5 py-3 whitespace-nowrap"
                >
                  Resume
                </th>
                {isAdmin && (
                  <th scope="col" className="px-2.5 py-3 whitespace-nowrap">
                    Timestamp
                  </th>
                )}
                <th scope="col" className="px-3 py-3 text-right whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px]">
              {records.map((record) => {
                const hasValidResume = isSafeHttpUrl(record.resumeUrl);
                return (
                  <tr
                    key={record.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {/* Col 1: Date */}
                    <td className="px-3 py-2.5 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                      {record.submissionDate}
                    </td>

                    {/* Col 2: Manager Name */}
                    <td className="px-2.5 py-2.5 text-slate-700 whitespace-nowrap">
                      {record.managerName}
                    </td>

                    {/* Col 3: Recruiter Name */}
                    <td className="px-2.5 py-2.5 text-slate-800 font-medium whitespace-nowrap">
                      {record.recruiterName}
                    </td>

                    {/* Col 4: Client Name */}
                    <td className="px-2.5 py-2.5 text-slate-800 whitespace-nowrap">
                      {record.clientName}
                    </td>

                    {/* Col 5: Purpose (unboxed clean typographic label) */}
                    <td className="px-2.5 py-2.5 text-slate-700 whitespace-nowrap">
                      {record.purpose}
                    </td>

                    {/* Col 6: Candidate's Name */}
                    <td className="px-2.5 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                      {record.candidateName}
                    </td>

                    {/* Col 7: Candidate's Mobile Number */}
                    <td className="px-2.5 py-2.5 font-mono text-xs tabular-nums text-slate-800 whitespace-nowrap">
                      {record.candidateMobile}
                    </td>

                    {/* Col 8: City */}
                    <td className="px-2.5 py-2.5 text-slate-700 whitespace-nowrap">
                      {record.city}
                    </td>

                    {/* Col 9: Candidate's Resume (View / Download button) */}
                    <td className="px-2.5 py-2.5 whitespace-nowrap">
                      {hasValidResume ? (
                        <a
                          href={record.resumeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`View / Download Resume for ${record.candidateName}`}
                          title={record.resumeFileName || 'View / Download Resume'}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-900 hover:underline whitespace-nowrap"
                        >
                          <span>View / Download</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    {/* Admin-only System Timestamp */}
                    {isAdmin && (
                      <td className="px-2.5 py-2.5 font-mono text-[11px] tabular-nums text-slate-500 whitespace-nowrap">
                        {formatSystemTimestamp(record.createdAtMs)}
                      </td>
                    )}

                    {/* Row Actions */}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => onEdit(record)}
                          aria-label={`Edit ${record.candidateName}`}
                          className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteRecord(record)}
                          aria-label={`Delete ${record.candidateName}`}
                          className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteRecord && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 shadow-xl">
            <h2 id="delete-modal-title" className="text-base font-bold text-slate-900">
              Delete candidate submission?
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              This will permanently remove{' '}
              <span className="font-semibold text-slate-900">
                {confirmDeleteRecord.candidateName}
              </span>{' '}
              (<span className="font-mono">{confirmDeleteRecord.candidateMobile}</span>) for{' '}
              <span className="font-semibold text-slate-900">{confirmDeleteRecord.clientName}</span>.
              This action cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteRecord(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
