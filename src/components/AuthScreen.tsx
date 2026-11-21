import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { AlertCircle, CheckCircle2, Lock, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { auth, signInWithGoogleAndDrive } from '../lib/firebase';

interface AuthScreenProps {
  pendingVerificationUser: FirebaseUser | null;
  onVerificationRefresh: () => Promise<void>;
}

type AuthMode = 'signin' | 'signup';

function formatAuthError(code: string | undefined, fallback: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Switch to Sign In instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid work email address.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completing authentication.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method → Email/Password). Use Google Sign-In or enable Email/Password in Firebase Console.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Wait a few moments and try again.';
    default:
      return fallback;
  }
}

export function AuthScreen({
  pendingVerificationUser,
  onVerificationRefresh,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
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
        const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await updateProfile(cred.user, { displayName: trimmedName });
        await sendEmailVerification(cred.user);
        setInfoMsg(
          'Account created. A verification link has been sent to your email address. Verify your inbox, then click Continue.'
        );
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      const message = err instanceof Error ? err.message : 'Authentication failed.';
      setErrorMsg(formatAuthError(code, message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setGoogleSubmitting(true);
    try {
      await signInWithGoogleAndDrive();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      const message = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setErrorMsg(formatAuthError(code, message));
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!pendingVerificationUser) return;
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      await sendEmailVerification(pendingVerificationUser);
      setInfoMsg('Verification email resent. Check your inbox and spam folder.');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      setErrorMsg(formatAuthError(code, 'Could not resend verification email.'));
    }
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
              Recruitment tracking with database-enforced recruiter isolation.
            </h1>
            <p className="mt-5 text-red-100/80 text-sm sm:text-base leading-relaxed">
              Log store and warehouse hiring submissions in a standardized 9-column ledger. Each
              recruiter sees only their own pipeline while administrators oversee the unified master
              database.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-red-900/70 space-y-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Row-Level Security Rules</p>
              <p className="text-xs text-red-200/75 mt-0.5 leading-relaxed">
                Firestore Security Rules restrict reads and writes to matching recruiter UIDs at the
                database layer.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Verified Identity & Audit Trail</p>
              <p className="text-xs text-red-200/75 mt-0.5 leading-relaxed">
                Recruiter identity is locked automatically on every submission and cannot be spoofed
                by non-admin accounts.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Authentication Workspace */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8">
          {pendingVerificationUser ? (
            <div>
              <div className="w-11 h-11 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-700 mb-5">
                <Mail className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Verify your email address</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Security rules require a verified email before reading or submitting candidate
                records. We sent a confirmation link to{' '}
                <span className="font-semibold text-slate-900">{pendingVerificationUser.email}</span>.
              </p>

              {errorMsg && (
                <div
                  role="alert"
                  className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {infoMsg && (
                <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{infoMsg}</span>
                </div>
              )}

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={onVerificationRefresh}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  I have verified my email — Continue
                </button>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className="w-full px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Resend verification email
                </button>
                <button
                  type="button"
                  onClick={() => signOut(auth)}
                  className="w-full px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Sign out and switch account
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {mode === 'signin' ? 'Sign in to Verto Bizserv' : 'Create recruiter account'}
              </h2>
              <p className="mt-1.5 text-sm text-slate-600">
                {mode === 'signin'
                  ? 'Access your isolated recruiter pipeline or Admin Master Database.'
                  : 'New accounts start with Recruiter permissions until promoted by an Admin.'}
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
                  className={`py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
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
                  className={`py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    mode === 'signup'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Google Sign-In Primary Option */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleSubmitting || submitting}
                className="mt-6 w-full inline-flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-60"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                  />
                </svg>
                {googleSubmitting ? 'Signing in with Google...' : 'Sign in with Google'}
              </button>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">or with email</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2 leading-relaxed"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {infoMsg && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2 leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{infoMsg}</span>
                </div>
              )}

              <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
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
                  disabled={submitting || googleSubmitting}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors disabled:opacity-60"
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
          )}
        </div>
      </div>
    </div>
  );
}
