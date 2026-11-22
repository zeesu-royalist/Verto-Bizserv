import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Lock,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import {
  getGasApiUrl,
  setGasApiUrl,
} from '../services/gasService';

interface AuthScreenProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  onRegister: (name: string, email: string, pass: string) => Promise<void>;
}

type AuthMode = 'signin' | 'signup';

export function AuthScreen({ onLogin, onRegister }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Settings modal for configuring Google Apps Script URL
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [customApiUrl, setCustomApiUrl] = useState(() => getGasApiUrl());
  const [savedConfigMessage, setSavedConfigMessage] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();

    if (mode === 'signup' && trimmedName.length < 2) {
      setErrorMsg('Enter your full name (at least 2 characters).');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMsg('Enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await onRegister(trimmedName, trimmedEmail, password);
        setInfoMsg('Account created successfully. Signing you in...');
      } else {
        await onLogin(trimmedEmail, password);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed. Please check your credentials.';
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setGasApiUrl(customApiUrl);
    setSavedConfigMessage(true);
    setTimeout(() => {
      setSavedConfigMessage(false);
      setShowConfigModal(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Institutional Brand Panel */}
      <div className="lg:w-[44%] bg-red-950 text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-base">
              V
            </div>
            <span className="text-lg font-bold tracking-tight text-white">Verto Bizserv</span>
          </div>

          <div className="mt-14 max-w-md">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight [text-wrap:balance]">
              Recruitment tracking with Google Sheets & Drive.
            </h1>
            <p className="mt-5 text-red-100/80 text-sm sm:text-base leading-relaxed">
              Log store and warehouse hiring submissions in a standardized 9-column ledger. Each
              recruiter sees only their own pipeline while administrators oversee the unified master
              Google Sheet database.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-red-900/70 space-y-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Row-Level Privacy Isolation</p>
              <p className="text-xs text-red-200/75 mt-0.5 leading-relaxed">
                Recruiters access only their own candidates. The Master Database remains
                consolidated in Google Sheets for Administrators.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Direct Google Drive Resume Storage</p>
              <p className="text-xs text-red-200/75 mt-0.5 leading-relaxed">
                Candidate CVs are stored directly inside your office Google Drive folder with
                instant preview links.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Authentication Workspace */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative">
        {/* Backend Config Trigger */}
        <button
          type="button"
          onClick={() => setShowConfigModal(true)}
          className="absolute top-6 right-6 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          title="Configure Google Apps Script API URL"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Google Sheet API</span>
        </button>

        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {mode === 'signin' ? 'Sign in to Verto Bizserv' : 'Create recruiter account'}
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              {mode === 'signin'
                ? 'Access your isolated recruiter pipeline or Admin Master Database.'
                : 'New accounts start with Recruiter permissions until updated by an Admin.'}
            </p>

            {/* Mode Switch */}
            <div
              role="tablist"
              aria-label="Authentication mode"
              className="mt-6 grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signin'}
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signup'}
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2 leading-relaxed"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {infoMsg && (
              <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{infoMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="auth-full-name"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Full Name
                  </label>
                  <input
                    id="auth-full-name"
                    type="text"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Priya Menon"
                    maxLength={100}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Work Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
              >
                {submitting
                  ? mode === 'signin'
                    ? 'Signing in...'
                    : 'Creating account...'
                  : mode === 'signin'
                    ? 'Sign In'
                    : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Google Apps Script API URL Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Google Apps Script Web App URL</h3>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Paste the Web App URL generated from your Google Sheet&apos;s Apps Script deployment
              (see <code className="text-red-700 font-mono">gas/README.md</code>):
            </p>
            <form onSubmit={handleSaveApiUrl} className="mt-4 space-y-3">
              <input
                type="url"
                value={customApiUrl}
                onChange={(e) => setCustomApiUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
              />
              {savedConfigMessage && (
                <p className="text-xs text-emerald-600 font-medium">✓ API URL saved successfully!</p>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg"
                >
                  Save URL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
