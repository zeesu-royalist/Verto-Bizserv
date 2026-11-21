import React from 'react';
import { LogOut, ShieldOff } from 'lucide-react';
import { UserProfile } from '../types/recruitment';

interface DeactivatedScreenProps {
  profile: UserProfile;
  onSignOut: () => void;
}

export function DeactivatedScreen({ profile, onSignOut }: DeactivatedScreenProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 text-center">
        <div className="w-12 h-12 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center justify-center mx-auto">
          <ShieldOff className="w-6 h-6" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-slate-900">Account Access Deactivated</h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Access for <span className="font-semibold text-slate-900">{profile.email}</span> has been
          suspended by an administrator. All candidate database reads and submissions are blocked
          until reactivated.
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
