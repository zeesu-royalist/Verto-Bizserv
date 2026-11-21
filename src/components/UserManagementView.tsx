import React, { useMemo, useState } from 'react';
import { AlertCircle, Search, Shield, ShieldAlert, UserCheck, UserX } from 'lucide-react';
import { UserProfile, UserRole } from '../types/recruitment';

interface UserManagementViewProps {
  currentUser: UserProfile;
  users: UserProfile[];
  candidateCountByUid: Record<string, number>;
  onUpdateUser: (
    targetUid: string,
    updates: { role?: UserRole; isActive?: boolean }
  ) => Promise<void>;
}

export function UserManagementView({
  currentUser,
  users,
  candidateCountByUid,
  onUpdateUser,
}: UserManagementViewProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeAdminCount = useMemo(
    () => users.filter((u) => u.role === UserRole.ADMIN && u.isActive).length,
    [users]
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

  const handleToggleRole = async (target: UserProfile) => {
    setErrorMsg(null);
    const nextRole = target.role === UserRole.ADMIN ? UserRole.RECRUITER : UserRole.ADMIN;

    if (target.uid === currentUser.uid && nextRole === UserRole.RECRUITER && activeAdminCount <= 1) {
      setErrorMsg('Cannot demote the last active Administrator. Promote another user first.');
      return;
    }

    setBusyUid(target.uid);
    try {
      await onUpdateUser(target.uid, { role: nextRole });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update user role.');
    } finally {
      setBusyUid(null);
    }
  };

  const handleToggleActive = async (target: UserProfile) => {
    setErrorMsg(null);
    const nextActive = !target.isActive;

    if (target.uid === currentUser.uid && !nextActive) {
      setErrorMsg('You cannot deactivate your own active administrator session.');
      return;
    }

    setBusyUid(target.uid);
    try {
      await onUpdateUser(target.uid, { isActive: nextActive });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update account status.');
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Role-Based Access Control Directory</h2>
          <p className="text-xs text-slate-500 mt-1">
            Promote or demote users between Recruiter (row-isolated) and Admin (Master Database), or
            deactivate access immediately.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Search users"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email..."
              className="pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-600"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['all', UserRole.ADMIN, UserRole.RECRUITER] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setRoleFilter(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  roleFilter === tab
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'all' ? 'All Users' : tab === UserRole.ADMIN ? 'Admins' : 'Recruiters'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Users Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[820px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th scope="col" className="px-6 py-3">
                  User
                </th>
                <th scope="col" className="px-4 py-3">
                  Role
                </th>
                <th scope="col" className="px-4 py-3">
                  Access Status
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Submissions Logged
                </th>
                <th scope="col" className="px-6 py-3 text-right">
                  RBAC Controls
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredUsers.map((user) => {
                const isSelf = user.uid === currentUser.uid;
                const isBusy = busyUid === user.uid;
                const count = candidateCountByUid[user.uid] || 0;

                return (
                  <tr key={user.uid} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{user.name}</span>
                        {isSelf && (
                          <span className="text-xs font-medium text-red-700">(You)</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          user.role === UserRole.ADMIN ? 'text-red-800' : 'text-slate-700'
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        {user.role === UserRole.ADMIN ? 'Admin' : 'Recruiter'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          user.isActive ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {user.isActive ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            Active
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Deactivated
                          </>
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-800">
                      {count}
                    </td>

                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleToggleRole(user)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {user.role === UserRole.ADMIN ? 'Demote to Recruiter' : 'Promote to Admin'}
                        </button>

                        <button
                          type="button"
                          disabled={isBusy || isSelf}
                          onClick={() => handleToggleActive(user)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-40 ${
                            user.isActive
                              ? 'text-red-700 bg-white border-red-200 hover:bg-red-50'
                              : 'text-emerald-700 bg-white border-emerald-200 hover:bg-emerald-50'
                          }`}
                        >
                          {user.isActive ? (
                            <>
                              <UserX className="w-3.5 h-3.5" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              Reactivate
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                    No users match your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
